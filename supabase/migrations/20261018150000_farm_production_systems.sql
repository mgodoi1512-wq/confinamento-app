begin;
alter table public.farms add column if not exists production_systems text[] not null default '{}';
alter table public.farms add column if not exists default_production_system text;
alter table public.farms add column if not exists systems_updated_at timestamptz;
alter table public.pens add column if not exists location_type text not null default 'curral' check(location_type in ('curral','piquete','pasto'));
alter table public.lots add column if not exists production_system text check(production_system in ('confinamento','semiconfinamento','pasto'));
alter table public.lots add column if not exists system_started_on date;
alter table public.lots add column if not exists system_updated_at timestamptz;
create table if not exists public.lot_system_history (
 id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms(id), lot_id uuid not null,
 from_system text, to_system text not null check(to_system in ('confinamento','semiconfinamento','pasto')),
 from_pen_id uuid, to_pen_id uuid not null, effective_date date not null, created_by uuid, created_at timestamptz not null default clock_timestamp(),
 request_id uuid, request_payload jsonb, unique(farm_id,request_id),
 foreign key(lot_id,farm_id) references public.lots(id,farm_id), foreign key(to_pen_id,farm_id) references public.pens(id,farm_id)
);
alter table public.lot_system_history enable row level security;
revoke all on public.lot_system_history from public,anon,authenticated;
grant select on public.lot_system_history to authenticated;
drop policy if exists own_farm_history on public.lot_system_history;
create policy own_farm_history on public.lot_system_history for select to authenticated using(farm_id=(select public.current_farm_id()));
create index if not exists lot_system_history_lot on public.lot_system_history(farm_id,lot_id,effective_date,created_at);
create or replace function app_private.validate_production_systems(p_systems jsonb,p_default text) returns text[] language plpgsql set search_path='' as $$
declare modes text[];begin
 if jsonb_typeof(p_systems) is distinct from 'array' then raise exception 'Informe os sistemas de criação da fazenda.';end if;
 select array_agg(v order by v) into modes from jsonb_array_elements_text(p_systems) t(v);
 if coalesce(cardinality(modes),0) not between 1 and 3 or exists(select 1 from unnest(modes) m where m is null or m not in ('confinamento','semiconfinamento','pasto')) or (select count(distinct m) from unnest(modes) m)<>cardinality(modes) then raise exception 'Selecione confinamento, semiconfinamento e/ou a pasto, sem repetir.';end if;
 if p_default is null or not p_default=any(modes) then raise exception 'Escolha um sistema padrão entre os selecionados.';end if;
 return modes;
end $$;
revoke all on function app_private.validate_production_systems(jsonb,text) from public,anon,authenticated;
create or replace function public.app_production_settings(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();old public.farms;modes text[];begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem configurar os sistemas de criação.';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 modes:=app_private.validate_production_systems(p_payload->'systems',p_payload->>'default_system');
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));select * into old from public.farms where id=f for update;
 if old.production_systems=modes and old.default_production_system=p_payload->>'default_system' then return to_jsonb(old);end if;
 if old.systems_updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'Os sistemas foram alterados por outro gestor. Recarregue.';end if;
 if exists(select 1 from public.lots where farm_id=f and status='ativo' and head_count>0 and production_system is not null and not production_system=any(modes)) then raise exception 'Há lotes ativos usando um sistema que você desmarcou. Altere o manejo desses lotes antes de remover o sistema da fazenda.';end if;
 update public.farms set production_systems=modes,default_production_system=p_payload->>'default_system',systems_updated_at=clock_timestamp() where id=f returning * into old;
 return to_jsonb(old);
end $$;
revoke all on function public.app_production_settings(jsonb) from public,anon;
grant execute on function public.app_production_settings(jsonb) to authenticated;
-- Mantém o fluxo atual de cadastro/aprovação/cobrança; exige a escolha na criação.
do $$begin
 if to_regprocedure('app_private.app_tenant_before_systems(text,jsonb)') is null then
  alter function public.app_tenant(text,jsonb) rename to app_tenant_before_systems;
  alter function public.app_tenant_before_systems(text,jsonb) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_tenant_before_systems(text,jsonb) from public,anon,authenticated;
create or replace function public.app_tenant(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare modes text[];r jsonb;fid uuid;begin
 if p_action is distinct from 'create_farm' then return app_private.app_tenant_before_systems(p_action,p_payload);end if;
 if auth.uid() is null then raise exception 'Entre na sua conta.';end if;
 modes:=app_private.validate_production_systems(p_payload->'production_systems',p_payload->>'default_production_system');
 r:=app_private.app_tenant_before_systems(p_action,p_payload);fid:=(r->>'farmId')::uuid;
 update public.farms set production_systems=modes,default_production_system=p_payload->>'default_production_system',systems_updated_at=clock_timestamp() where id=fid and account_owner_id=auth.uid();
 if not found then raise exception 'Não foi possível configurar os sistemas da fazenda.';end if;
 if not 'confinamento'=any(modes) then
  -- Só remove os presets automáticos desta fazenda recém-criada; não toca nas fazendas existentes.
  delete from public.diet_items where farm_id=fid and diet_id in(select id from public.diets where farm_id=fid and name in ('ADAPTAÇÃO 1-3','ADAPTAÇÃO 4-6','ADAPTAÇÃO 7-9','ADAPTAÇÃO 10-12','ADAPTAÇÃO 13-15','APÓS ADAPTAÇÃO'));
  delete from public.diets where farm_id=fid and name in ('ADAPTAÇÃO 1-3','ADAPTAÇÃO 4-6','ADAPTAÇÃO 7-9','ADAPTAÇÃO 10-12','ADAPTAÇÃO 13-15','APÓS ADAPTAÇÃO');
 end if;
 return r;
end $$;
revoke all on function public.app_tenant(text,jsonb) from public,anon;
grant execute on function public.app_tenant(text,jsonb) to authenticated;

create or replace function app_private.guard_production_location() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;modes text[];begin
 if TG_OP='UPDATE' and new.pen_id is distinct from old.pen_id and (exists(select 1 from public.daily_feed_plans where farm_id=new.farm_id and lot_id=new.id and date=public.app_today()) or exists(select 1 from public.feed_logs where farm_id=new.farm_id and lot_id=new.id and date=public.app_today() and total_kg>0)) then raise exception 'Este lote já iniciou o trato de hoje. Transfira no próximo dia, antes do primeiro trato.';end if;
 if TG_OP='UPDATE' and new.pen_id is distinct from old.pen_id then new.system_updated_at:=clock_timestamp();end if;
 if new.production_system is null then return new;end if;
 select production_systems into modes from public.farms where id=new.farm_id;
 if not coalesce(new.production_system=any(modes),false) then raise exception 'O sistema do lote precisa estar habilitado na fazenda.';end if;
 select location_type into kind from public.pens where id=new.pen_id and farm_id=new.farm_id;
 if kind is null or (new.production_system='confinamento' and kind<>'curral') or (new.production_system in ('semiconfinamento','pasto') and kind not in ('piquete','pasto')) then raise exception 'Confinamento exige curral; semiconfinamento e a pasto exigem piquete ou pasto.';end if;
 return new;
end $$;
revoke all on function app_private.guard_production_location() from public,anon,authenticated;
drop trigger if exists guard_production_location on public.lots;
create trigger guard_production_location before insert or update of production_system,pen_id on public.lots for each row execute function app_private.guard_production_location();
create or replace function app_private.guard_location_type() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.location_type is distinct from old.location_type and exists(select 1 from public.lots where farm_id=new.farm_id and pen_id=new.id and status='ativo' and head_count>0 and ((production_system='confinamento' and new.location_type<>'curral') or (production_system in ('semiconfinamento','pasto') and new.location_type not in ('piquete','pasto')))) then raise exception 'O tipo de local é incompatível com o manejo dos lotes presentes.';end if;
 return new;
end $$;
revoke all on function app_private.guard_location_type() from public,anon,authenticated;
drop trigger if exists guard_location_type on public.pens;
create trigger guard_location_type before update of location_type on public.pens for each row execute function app_private.guard_location_type();
-- Contratos de compra, sanidade, estoque e reenvio continuam preservados.
do $$begin
 if to_regprocedure('app_private.app_mutate_before_systems(text,jsonb,uuid)') is null then
  alter function public.app_mutate(text,jsonb,uuid) rename to app_mutate_before_systems;
  alter function public.app_mutate_before_systems(text,jsonb,uuid) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_mutate_before_systems(text,jsonb,uuid) from public,anon,authenticated;
create or replace function public.app_mutate(p_operation text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid;r jsonb;mode text;kind text;ident uuid;config public.farms;l public.lots;begin
 if p_operation is null or p_operation not in ('create_lot','save_pen') then return app_private.app_mutate_before_systems(p_operation,p_payload,p_request_id);end if;
 f:=public.current_farm_id();if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem cadastrar lotes e locais.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 perform pg_advisory_xact_lock(726102122000::bigint);perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 if exists(select 1 from public.app_requests where request_id=p_request_id) then return app_private.app_mutate_before_systems(p_operation,p_payload,p_request_id);end if;
 if p_operation='create_lot' then
  select * into config from public.farms where id=f;
  if cardinality(config.production_systems)=0 or config.default_production_system is null then raise exception 'Informe os sistemas de criação da fazenda antes de cadastrar um lote.';end if;
  mode:=coalesce(nullif(p_payload->'lot'->>'production_system',''),config.default_production_system);
  if not mode=any(config.production_systems) then raise exception 'Selecione um sistema habilitado na fazenda.';end if;
 else
  kind:=coalesce(nullif(p_payload->>'location_type',''),(select location_type from public.pens where id=nullif(p_payload->>'id','')::uuid and farm_id=f),'curral');
  if kind not in ('curral','piquete','pasto') then raise exception 'Tipo de local inválido.';end if;
 end if;
 r:=app_private.app_mutate_before_systems(p_operation,p_payload,p_request_id);
 if p_operation='save_pen' then
  ident:=(r#>>'{}')::uuid;update public.pens set location_type=kind where id=ident and farm_id=f;
 else
  ident:=(r->>'id')::uuid;
  update public.lots set production_system=mode,system_started_on=entry_date,system_updated_at=clock_timestamp() where id=ident and farm_id=f returning * into l;
  insert into public.lot_system_history(farm_id,lot_id,to_system,to_pen_id,effective_date,created_by) values(f,l.id,mode,l.pen_id,l.entry_date,auth.uid());
  r:=to_jsonb(l);
  -- A resposta persistida precisa incluir os novos campos para o replay.
  update public.app_requests set result=r where request_id=p_request_id and farm_id=f;
 end if;
 return r;
end $$;
revoke all on function public.app_mutate(text,jsonb,uuid) from public,anon;
grant execute on function public.app_mutate(text,jsonb,uuid) to authenticated;

create or replace function public.app_change_lot_system(p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();l public.lots;p public.pens;previous public.lot_system_history;mode text;effective date;used integer;begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem alterar o sistema do lote.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 perform pg_advisory_xact_lock(726102122000::bigint);perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 select * into previous from public.lot_system_history where farm_id=f and request_id=p_request_id;
 if found then
  if previous.request_payload is distinct from p_payload or previous.created_by<>auth.uid() then raise exception 'Identificador de alteração já utilizado.';end if;
  return jsonb_build_object('id',previous.lot_id);
 end if;
 select * into l from public.lots where id=(p_payload->>'lot_id')::uuid and farm_id=f for update;
 if not found or l.status<>'ativo' or l.head_count<=0 then raise exception 'Lote ativo indisponível.';end if;
 if l.system_updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'O sistema do lote foi alterado. Recarregue.';end if;
 mode:=p_payload->>'system';if mode is null or mode not in ('confinamento','semiconfinamento','pasto') then raise exception 'Sistema inválido.';end if;
 select * into p from public.pens where id=(p_payload->>'pen_id')::uuid and farm_id=f for update;
 if not found or p.status='manutencao' then raise exception 'Local de destino indisponível.';end if;
 if (l.production_system is not null or p.id is distinct from l.pen_id) and (exists(select 1 from public.daily_feed_plans where farm_id=f and lot_id=l.id and date=public.app_today()) or exists(select 1 from public.feed_logs where farm_id=f and lot_id=l.id and date=public.app_today() and total_kg>0)) then raise exception 'Este lote já iniciou o trato de hoje. Altere o sistema no próximo dia, antes do primeiro trato.';end if;
 effective:=(p_payload->>'effective_date')::date;
 if l.production_system is not null and effective is distinct from public.app_today() then raise exception 'Mudanças de manejo devem ser registradas na data de hoje. Datas anteriores são permitidas apenas para identificar inicialmente um lote legado.';end if;
 if effective is null or to_char(effective,'YYYY-MM-DD')<>p_payload->>'effective_date' or effective<coalesce(l.system_started_on,l.entry_date) or effective>public.app_today() then raise exception 'Informe uma data válida entre o início do manejo atual e hoje.';end if;
 select coalesce(sum(head_count),0) into used from public.lots where farm_id=f and pen_id=p.id and status='ativo' and id<>l.id;
 if used+l.head_count>p.capacity_head then raise exception 'Capacidade do local excedida.';end if;
 if l.production_system=mode and l.pen_id=p.id then return to_jsonb(l);end if;
 update public.lots set production_system=mode,pen_id=p.id,system_started_on=effective,system_updated_at=clock_timestamp() where id=l.id;
 update public.animals set pen_id=p.id where farm_id=f and lot_id=l.id and status in ('ativo','tratamento');
 insert into public.lot_system_history(farm_id,lot_id,from_system,to_system,from_pen_id,to_pen_id,effective_date,created_by,request_id,request_payload) values(f,l.id,l.production_system,mode,l.pen_id,p.id,effective,auth.uid(),p_request_id,p_payload);
 return jsonb_build_object('id',l.id);
end $$;
revoke all on function public.app_change_lot_system(jsonb,uuid) from public,anon;
grant execute on function public.app_change_lot_system(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
