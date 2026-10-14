-- Aplicar UMA vez, integralmente, após backup. Requer as migrações anteriores.
begin;
set local search_path=public,pg_temp;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='app_farm_executor') then
  raise exception 'O papel app_farm_executor já existe. Não reaplique esta migração.';
 end if;
 create role app_farm_executor nologin noinherit nobypassrls;
end $$;
grant app_farm_executor to postgres;
grant usage on schema public, auth, app_private to app_farm_executor;
grant create on schema app_private to app_farm_executor;
grant execute on function auth.uid() to app_farm_executor;

create table public.platform_admins (
 user_id uuid primary key references auth.users(id), created_at timestamptz not null default now()
);
create table public.account_access (
 user_id uuid primary key references auth.users(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 source text not null default 'customer' check(source in ('customer','team','legacy')),
 decided_by uuid references auth.users(id), decided_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.farm_members (
 user_id uuid primary key references auth.users(id),
 farm_id uuid not null references public.farms(id),
 role text not null check(role in ('gestor','operador')),
 enabled boolean not null default true, created_at timestamptz not null default now()
);
create index farm_members_farm_idx on public.farm_members(farm_id);
create table public.farm_invitations (
 id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms(id),
 email text not null check(length(email)<=254 and position('@' in email)>1),
 role text not null check(role in ('gestor','operador')),
 invited_by uuid not null references auth.users(id),
 status text not null default 'pending' check(status in ('pending','accepted','cancelled')),
 expires_at timestamptz not null default now()+interval '14 days',
 created_at timestamptz not null default now()
);
create unique index farm_invitation_pending_email on public.farm_invitations(lower(email)) where status='pending';
create table public.platform_audit (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id),
 action text not null, target_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.farms add column account_owner_id uuid references auth.users(id);

-- O histórico existente é preservado na fazenda original, incluindo usuários liberados.
do $$ declare fid uuid; uid uuid; t text; begin
 if (select count(*) from public.farms)>1 then raise exception 'Há mais de uma fazenda anterior. É necessário mapear o legado antes desta migração.'; end if;
 select id into fid from public.farms limit 1;
 if fid is null and exists(select 1 from public.pens union all select 1 from public.lots union all select 1 from public.animals) then
  raise exception 'Há registros sem fazenda. Cadastre a fazenda original antes de migrar.';
 end if;
 insert into public.account_access(user_id,status,source)
 select u.id,case when coalesce(m.enabled,false) then 'approved' else 'pending' end,'legacy'
 from auth.users u left join public.app_members m on m.user_id::text=u.id::text;
 if fid is not null then
  select u.id into uid from public.farms f join auth.users u on u.id::text=f.owner_id::text where f.id=fid;
  if uid is null then
   select u.id into uid from auth.users u join public.profiles p on p.id::text=u.id::text
    join public.app_members m on m.user_id::text=u.id::text where m.enabled and p.role='gestor' order by p.created_at limit 1;
  end if;
  if uid is null then raise exception 'Não foi possível identificar o responsável da fazenda original.'; end if;
  update public.farms set account_owner_id=uid where id=fid;
  update public.account_access set status='approved' where user_id=uid;
  insert into public.farm_members(user_id,farm_id,role)
  select u.id,fid,p.role from auth.users u join public.profiles p on p.id::text=u.id::text
   join public.app_members m on m.user_id::text=u.id::text where m.enabled;
  insert into public.farm_members(user_id,farm_id,role) values(uid,fid,'gestor') on conflict(user_id) do update set role='gestor';
 end if;
 foreach t in array array['pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events','lot_exits','reading_applications','app_requests'] loop
  execute format('alter table public.%I add column if not exists farm_id uuid references public.farms(id)',t);
  execute format('update public.%I set farm_id=$1 where farm_id is null',t) using fid;
  -- Descartar apenas chaves antigas de repetição sem fazenda quando a instalação era vazia.
  if t='app_requests' and fid is null then delete from public.app_requests; end if;
  execute format('alter table public.%I alter column farm_id set not null',t);
  execute format('create index %I on public.%I(farm_id)',t||'_tenant_idx',t);
 end loop;
end $$;
alter table public.farms alter column account_owner_id set not null;
create unique index farm_account_owner_unique on public.farms(account_owner_id);

create function public.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_admins where user_id=auth.uid())
$$;
create function public.current_farm_id() returns uuid language sql stable security definer set search_path='' as $$
 select m.farm_id from public.farm_members m join public.account_access a on a.user_id=m.user_id
 join public.farms f on f.id=m.farm_id join public.account_access o on o.user_id=f.account_owner_id
 where m.user_id=auth.uid() and m.enabled and a.status='approved' and o.status='approved'
$$;
create or replace function public.has_app_access() returns boolean language sql stable security definer set search_path='' as $$
 select public.current_farm_id() is not null
$$;
create or replace function public.is_gestor() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.farm_members where user_id=auth.uid() and farm_id=public.current_farm_id() and role='gestor' and enabled)
$$;

-- Toda inscrição pública começa pendente; metadata não concede privilégios.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name,role) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),'operador') on conflict(id) do nothing;
 insert into public.account_access(user_id) values(new.id) on conflict(user_id) do nothing;
 return new;
end $$;

-- Referências compostas impedem associar animais, lotes ou registros de outra fazenda.
do $$ declare t text; r record; col text; target text; begin
 foreach t in array array['pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events','lot_exits'] loop
  execute format('alter table public.%I add constraint %I unique(id,farm_id)',t,t||'_id_farm_unique');
 end loop;
 for r in select c.conrelid::regclass::text as source,c.confrelid::regclass::text as dest,a.attname as column_name
 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 where c.contype='f' and cardinality(c.conkey)=1 and c.connamespace='public'::regnamespace
  and c.conrelid::regclass::text=any(array['pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events','lot_exits','reading_applications'])
  and c.confrelid::regclass::text=any(array['pens','diets','protocols','lots','animals','weighings','feed_logs','trough_readings']) loop
  execute format('alter table public.%I add constraint %I foreign key(%I,farm_id) references public.%I(id,farm_id)',r.source,r.source||'_'||r.column_name||'_tenant_fk',r.column_name,r.dest);
 end loop;
 -- Códigos e brincos são únicos dentro da fazenda, permitindo os mesmos códigos em clientes diferentes.
 for r in select c.conrelid::regclass::text as tab,c.conname,a.attname
 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 where c.contype='u' and cardinality(c.conkey)=1 and c.connamespace='public'::regnamespace
 and ((c.conrelid='public.pens'::regclass and a.attname='code') or (c.conrelid='public.lots'::regclass and a.attname='code') or (c.conrelid='public.animals'::regclass and a.attname in ('ear_tag','sisbov'))) loop
  execute format('alter table public.%I drop constraint %I',r.tab,r.conname);
 end loop;
end $$;
create unique index pens_farm_code_unique on public.pens(farm_id,code);
create unique index lots_farm_code_unique on public.lots(farm_id,code);
create unique index animals_farm_tag_unique on public.animals(farm_id,ear_tag);
create unique index animals_farm_sisbov_unique on public.animals(farm_id,sisbov);

-- Inclusive funções de gravação são executadas por papel SEM bypass de RLS.
do $$ declare t text; r record; begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['farms','profiles','app_members','app_requests','pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events','lot_exits','reading_applications']) loop
  execute format('drop policy %I on public.%I',r.policyname,r.tablename);
 end loop;
 foreach t in array array['pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events','lot_exits','reading_applications','app_requests'] loop
  execute format('alter table public.%I alter column farm_id set default public.current_farm_id()',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to app_farm_executor',t);
  if t<>'app_requests' then execute format('grant select on public.%I to authenticated',t); end if;
  execute format('create policy tenant_read on public.%I for select to authenticated,app_farm_executor using(farm_id=(select public.current_farm_id()))',t);
  execute format('create policy tenant_write on public.%I for all to app_farm_executor using(farm_id=(select public.current_farm_id())) with check(farm_id=(select public.current_farm_id()))',t);
 end loop;
end $$;
revoke all on public.farms,public.profiles,public.app_members from anon,authenticated;
grant select on public.farms,public.profiles to authenticated,app_farm_executor;
grant update on public.farms to app_farm_executor;
create policy tenant_farm on public.farms for select to authenticated,app_farm_executor using(id=(select public.current_farm_id()));
create policy tenant_farm_update on public.farms for update to app_farm_executor using(id=(select public.current_farm_id())) with check(id=(select public.current_farm_id()));
create policy own_profile on public.profiles for select to authenticated,app_farm_executor using(id::text=(select auth.uid())::text);
do $$ declare t text; begin
 foreach t in array array['platform_admins','account_access','farm_members','farm_invitations','platform_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated, app_farm_executor',t);
 end loop;
end $$;

-- Encapsula as funções antigas, mantendo os contratos usados pelo front-end.
alter function public.app_mutate(text,jsonb,uuid) rename to app_mutate_legacy;
alter function public.app_mutate_legacy(text,jsonb,uuid) set schema app_private;
alter function app_private.app_mutate_legacy(text,jsonb,uuid) owner to app_farm_executor;
revoke all on function app_private.app_mutate_legacy(text,jsonb,uuid) from public,anon,authenticated;
create function public.app_mutate(p_operation text,p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_operation='update_profile' then raise exception 'Gerencie os papéis pela equipe da fazenda.'; end if;
 if p_operation='save_farm' and nullif(p_payload->>'id','') is null then raise exception 'Use o cadastro de fazenda após aprovação.'; end if;
 return app_private.app_mutate_legacy(p_operation,p_payload,p_request_id);
end $$;
alter function public.app_correct_weight_record(uuid,numeric,boolean,boolean,numeric,integer,uuid) set schema app_private;
alter function app_private.app_correct_weight_record(uuid,numeric,boolean,boolean,numeric,integer,uuid) owner to app_farm_executor;
revoke all on function app_private.app_correct_weight_record(uuid,numeric,boolean,boolean,numeric,integer,uuid) from public,anon,authenticated;
create function public.app_correct_weight_record(p_record_id uuid,p_weight numeric,p_delete boolean,p_remove_empty boolean,p_expected_weight numeric,p_expected_count integer,p_request_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select app_private.app_correct_weight_record(p_record_id,p_weight,p_delete,p_remove_empty,p_expected_weight,p_expected_count,p_request_id)
$$;
alter function public.app_apply_readings(date,uuid) set schema app_private;
alter function app_private.app_apply_readings(date,uuid) owner to app_farm_executor;
revoke all on function app_private.app_apply_readings(date,uuid) from public,anon,authenticated;
create function public.app_apply_readings(p_date date,p_request_id uuid) returns jsonb
language sql security definer set search_path='' as $$ select app_private.app_apply_readings(p_date,p_request_id) $$;
-- O bloqueio passa a ser por fazenda, sem serializar clientes independentes.
do $$ declare r record; definition text; begin
 for r in select p.oid from pg_proc p where p.pronamespace='app_private'::regnamespace loop
  definition:=pg_get_functiondef(r.oid);
  definition:=replace(definition,'726102122000::bigint','hashtextextended(public.current_farm_id()::text,0)');
  execute definition;
 end loop;
end $$;

create function public.app_tenant(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); fid uuid:=public.current_farm_id(); target uuid; item public.farm_invitations%rowtype;
 access_row public.account_access%rowtype; member public.farm_members%rowtype; result jsonb;
 email_value text; role_value text; status_value text; enabled_value boolean;
begin
 if uid is null then raise exception 'Entre na sua conta para continuar.'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Dados inválidos.'; end if;
 select * into access_row from public.account_access where user_id=uid;
 if p_action='context' then
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'farmName',f.name,'role',i.role,'expiresAt',i.expires_at)),'[]') into result
  from public.farm_invitations i join public.farms f on f.id=i.farm_id join auth.users u on lower(u.email)=lower(i.email)
  where u.id=uid and i.status='pending' and i.expires_at>now();
  return jsonb_build_object('isAdmin',public.is_platform_admin(),'status',coalesce(access_row.status,'pending'),
   'farmId',fid,'role',(select role from public.farm_members where user_id=uid and farm_id=fid and enabled),
   'invitations',result,'hasMembership',exists(select 1 from public.farm_members where user_id=uid));
 end if;

 if p_action in ('list_requests','decide_request') then
  if not public.is_platform_admin() then raise exception 'Acesso exclusivo do administrador do sistema.'; end if;
  if p_action='list_requests' then
   return coalesce((select jsonb_agg(jsonb_build_object('userId',a.user_id,'name',p.full_name,'email',u.email,
    'status',a.status,'source',a.source,'createdAt',a.created_at,'confirmed',u.email_confirmed_at is not null,
    'farmName',f.name,'isAdmin',exists(select 1 from public.platform_admins ad where ad.user_id=a.user_id)) order by a.created_at desc)
   from public.account_access a join auth.users u on u.id=a.user_id join public.profiles p on p.id::text=a.user_id::text
    left join public.farms f on f.account_owner_id=a.user_id where a.source<>'team'),'[]');
  end if;
  target:=(p_payload->>'userId')::uuid; status_value:=p_payload->>'status';
  if target=uid or exists(select 1 from public.platform_admins where user_id=target) then raise exception 'Não altere a conta administrativa por esta página.'; end if;
  if status_value is null or status_value not in ('approved','rejected','suspended') then raise exception 'Decisão inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,71));
  if not exists(select 1 from public.account_access where user_id=target and source<>'team') then raise exception 'Cliente não encontrado.'; end if;
  if status_value='approved' and not exists(select 1 from auth.users where id=target and email_confirmed_at is not null) then raise exception 'O cliente precisa confirmar o e-mail antes da aprovação.'; end if;
  update public.account_access set status=status_value,decided_by=uid,decided_at=now() where user_id=target;
  insert into public.platform_audit(actor_id,action,target_id,details) values(uid,'decide_request',target,jsonb_build_object('status',status_value));
  return jsonb_build_object('ok',true);
 end if;

 if p_action='accept_invite' then
  if access_row.status in ('rejected','suspended') then raise exception 'Sua conta está bloqueada. Contate o administrador.'; end if;
  select * into item from public.farm_invitations where id=(p_payload->>'invitationId')::uuid for update;
  if not found or item.status<>'pending' or item.expires_at<=now() then raise exception 'Convite indisponível ou expirado.'; end if;
  if not exists(select 1 from auth.users where id=uid and lower(email)=lower(item.email) and email_confirmed_at is not null) then raise exception 'Confirme o e-mail da conta que recebeu o convite.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(item.farm_id::text,0));
  if not exists(select 1 from public.farms f join public.account_access a on a.user_id=f.account_owner_id where f.id=item.farm_id and a.status='approved') then raise exception 'A fazenda não está liberada.'; end if;
  if exists(select 1 from public.farm_members where user_id=uid) then raise exception 'Esta conta já pertence a uma fazenda. Use uma conta separada.'; end if;
  update public.account_access set status='approved',source='team' where user_id=uid;
  insert into public.farm_members(user_id,farm_id,role) values(uid,item.farm_id,item.role);
  update public.farm_invitations set status='accepted' where id=item.id;
  insert into public.platform_audit(actor_id,action,target_id,details) values(uid,'accept_invite',item.id,jsonb_build_object('farmId',item.farm_id));
  return jsonb_build_object('ok',true);
 end if;

 if p_action='create_farm' then
  if access_row.status<>'approved' or access_row.status is null then raise exception 'Aguarde a aprovação do administrador.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,71));
  if exists(select 1 from public.farm_members where user_id=uid) or exists(select 1 from public.farms where account_owner_id=uid) then raise exception 'Esta conta já possui vínculo com uma fazenda.'; end if;
  if nullif(btrim(p_payload->>'name'),'') is null or length(p_payload->>'name')>150 then raise exception 'Informe o nome da fazenda, até 150 caracteres.'; end if;
  insert into public.farms(name,city,state,owner_id,account_owner_id)
   values(btrim(p_payload->>'name'),nullif(btrim(p_payload->>'city'),''),nullif(btrim(p_payload->>'state'),''),uid,uid) returning id into target;
  insert into public.farm_members(user_id,farm_id,role) values(uid,target,'gestor');
  return jsonb_build_object('farmId',target);
 end if;

 if fid is null or not public.is_gestor() then raise exception 'Somente gestores da fazenda gerenciam a equipe.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(fid::text,0));
 if not public.is_gestor() then raise exception 'Acesso revogado.'; end if;
 if p_action='list_team' then
  return coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'name',p.full_name,'email',u.email,'role',m.role,'enabled',m.enabled,
    'isOwner',m.user_id=f.account_owner_id) order by m.created_at)
   from public.farm_members m join auth.users u on u.id=m.user_id join public.profiles p on p.id::text=m.user_id::text
    join public.farms f on f.id=m.farm_id where m.farm_id=fid),'[]');
 elsif p_action='list_invites' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expiresAt',expires_at)
   order by created_at desc) from public.farm_invitations where farm_id=fid and status='pending' and expires_at>now()),'[]');
 elsif p_action='invite_team' then
  email_value:=lower(btrim(p_payload->>'email')); role_value:=p_payload->>'role';
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if role_value is null or role_value not in ('gestor','operador') then raise exception 'Perfil inválido.'; end if;
  -- Libera um convite vencido sem permitir tomar convites válidos de outra fazenda.
  update public.farm_invitations set status='cancelled' where lower(email)=email_value and status='pending' and expires_at<=now();
  if exists(select 1 from auth.users u join public.farm_members m on m.user_id=u.id where lower(u.email)=email_value) then raise exception 'Esta conta já faz parte de uma fazenda.'; end if;
  if exists(select 1 from auth.users u join public.account_access a on a.user_id=u.id where lower(u.email)=email_value and a.status in ('rejected','suspended')) then raise exception 'A conta indicada não está disponível para convite.'; end if;
  insert into public.farm_invitations(farm_id,email,role,invited_by) values(fid,email_value,role_value,uid) returning id into target;
  return jsonb_build_object('invitationId',target);
 elsif p_action='cancel_invite' then
  update public.farm_invitations set status='cancelled' where id=(p_payload->>'invitationId')::uuid and farm_id=fid and status='pending';
  if not found then raise exception 'Convite não encontrado.'; end if;
  return jsonb_build_object('ok',true);
 elsif p_action='update_member' then
  target:=(p_payload->>'userId')::uuid; role_value:=p_payload->>'role'; enabled_value:=(p_payload->>'enabled')::boolean;
  select * into member from public.farm_members where user_id=target and farm_id=fid for update;
  if not found then raise exception 'Integrante não encontrado nesta fazenda.'; end if;
  if target=uid or exists(select 1 from public.farms where id=fid and account_owner_id=target) then raise exception 'Não altere seu próprio acesso nem o responsável da fazenda.'; end if;
  if role_value is not null and role_value not in ('gestor','operador') then raise exception 'Perfil inválido.'; end if;
  if (role_value='operador' or enabled_value=false) and member.role='gestor' and member.enabled and
   (select count(*) from public.farm_members where farm_id=fid and role='gestor' and enabled)<=1 then raise exception 'Mantenha um gestor ativo.'; end if;
  update public.farm_members set role=coalesce(role_value,role),enabled=coalesce(enabled_value,enabled) where user_id=target and farm_id=fid;
  insert into public.platform_audit(actor_id,action,target_id,details) values(uid,'update_member',target,p_payload||jsonb_build_object('farmId',fid));
  return jsonb_build_object('ok',true);
 else raise exception 'Operação inválida.';
 end if;
end $$;

-- Lista fechada de funções expostas. Nenhuma credencial privilegiada no navegador.
revoke all on function public.app_tenant(text,jsonb),public.current_farm_id(),public.is_platform_admin(),public.has_app_access(),public.is_gestor(),public.app_mutate(text,jsonb,uuid),public.app_apply_readings(date,uuid),public.app_correct_weight_record(uuid,numeric,boolean,boolean,numeric,integer,uuid) from public,anon;
grant execute on function public.app_tenant(text,jsonb),public.is_platform_admin(),public.current_farm_id(),public.has_app_access(),public.is_gestor(),public.app_mutate(text,jsonb,uuid),public.app_apply_readings(date,uuid),public.app_correct_weight_record(uuid,numeric,boolean,boolean,numeric,integer,uuid) to authenticated;
grant execute on function public.current_farm_id(),public.has_app_access(),public.is_gestor(),public.app_today() to app_farm_executor;
revoke create on schema public from public,anon,authenticated,app_farm_executor;
revoke create on schema app_private from app_farm_executor;
notify pgrst,'reload schema';
commit;
