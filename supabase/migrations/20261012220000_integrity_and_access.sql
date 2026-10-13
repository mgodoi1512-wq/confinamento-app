-- Instalação de uma única fazenda. Aplicar após backup e revisão de CORRECOES.md.
-- Todo o arquivo deve ser aplicado em uma transação.
begin;
do $$
begin
  if (select count(*) from public.farms) > 1 then
    raise exception 'Esta correção atende uma fazenda por instalação. Revise a separação de fazendas antes de migrar.';
  end if;
end $$;

-- Reconcilia colunas presentes nos tipos entregues mas ausentes no schema base.
do $$
declare t text;
begin
  foreach t in array array['farms','pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events'] loop
    execute format('alter table public.%I add column if not exists owner_id uuid references auth.users(id)', t);
  end loop;
  foreach t in array array['pens','diets','protocols','lots'] loop
    execute format('alter table public.%I add column if not exists farm_id uuid references public.farms(id)', t);
  end loop;
end $$;
alter table public.health_events add column if not exists head_count integer not null default 1 check (head_count > 0);
alter table public.lots add column if not exists initial_head_count integer;
update public.lots l set initial_head_count = head_count + coalesce((select sum(e.head_count) from public.health_events e where e.lot_id = l.id and e.kind = 'obito'), 0) where initial_head_count is null;
alter table public.lots alter column initial_head_count set not null;
alter table public.lots alter column initial_head_count set default 0;
alter table public.trough_readings add column if not exists base_kg_per_head numeric(8,3);

-- PostgreSQL numeric admite NaN; rejeitar novas gravações sem bloquear legado na migração.
do $$
declare c record;
begin
  for c in select table_name,column_name from information_schema.columns where table_schema='public'
    and table_name=any(array['pens','diets','diet_items','lots','animals','weighings','weight_records','feed_logs','trough_readings'])
    and data_type='numeric' loop
    execute format('alter table public.%I add constraint %I check (%I is null or %I::text not in (''NaN'',''Infinity'',''-Infinity'')) not valid',c.table_name,'finite_'||c.column_name,c.column_name,c.column_name);
  end loop;
end $$;

create table public.app_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
-- Apenas gestores existentes são inicialmente liberados. Operadores precisam de aprovação.
insert into public.app_members(user_id, enabled) select id, true from public.profiles where role = 'gestor';
create table public.app_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id),
  operation text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table public.lot_exits (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id),
  reason text not null check (reason in ('abate','venda','obito')),
  head_count integer not null check (head_count > 0),
  animal_ids uuid[] not null default '{}',
  weight_kg numeric(7,2) check (weight_kg > 0 and weight_kg::text <> 'NaN'),
  destination text,
  date date not null,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index lot_exits_lot_date_idx on public.lot_exits(lot_id, date);
create table public.reading_applications (
  reading_id uuid primary key references public.trough_readings(id),
  feed_log_id uuid not null references public.feed_logs(id),
  created_at timestamptz not null default now()
);

create or replace function public.has_app_access() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.app_members where user_id = auth.uid() and enabled);
$$;
create or replace function public.is_gestor() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.has_app_access() and exists(select 1 from public.profiles where id = auth.uid() and role = 'gestor');
$$;
-- Cadastro não concede autorização nem escolhe automaticamente um gestor.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles(id, full_name, role)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), 'operador')
  on conflict(id) do nothing;
  return new;
end $$;

create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role and not public.is_gestor() then
    raise exception 'Somente gestor altera papéis.';
  end if;
  return new;
end $$;

-- Remove políticas permissivas antigas destas tabelas na instalação de uma fazenda.
do $$
declare r record; t text;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename = any(array['farms','profiles','pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events','app_members','app_requests','lot_exits','reading_applications']) loop
    execute format('drop policy %I on public.%I',r.policyname,r.tablename);
  end loop;
  foreach t in array array['farms','pens','diets','diet_items','protocols','protocol_items','lots','animals','weighings','weight_records','feed_logs','trough_readings','health_events','lot_exits','reading_applications'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy approved_read on public.%I for select to authenticated using(public.has_app_access())',t);
    -- Escritas somente por funções validadas. Não confiar em ocultar botões.
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
alter table public.profiles enable row level security;
alter table public.app_members enable row level security;
alter table public.app_requests enable row level security;
revoke all on public.app_requests from anon, authenticated;
revoke all on public.app_members, public.profiles from anon, authenticated;
grant select on public.app_members, public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id = auth.uid() or public.is_gestor());
create policy member_read on public.app_members for select to authenticated using(user_id = auth.uid() or public.is_gestor());

-- Data civil deve corresponder a VITE_FARM_TIME_ZONE. Padrão: São Paulo.
create or replace function public.app_today() returns date
language sql stable set search_path = public, pg_temp as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public.app_mutate(p_operation text, p_payload jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  result jsonb := '{}'::jsonb;
  request public.app_requests%rowtype;
  l public.lots%rowtype;
  a public.animals%rowtype;
  p public.pens%rowtype;
  w public.weighings%rowtype;
  h public.health_events%rowtype;
  d public.diets%rowtype;
  protocol public.protocols%rowtype;
  item record;
  j jsonb;
  arr jsonb;
  ident uuid;
  v_lot_id uuid;
  v_reading_id uuid;
  animal_ids uuid[] := '{}';
  affected_ids uuid[] := '{}';
  head integer;
  present integer;
  anonymous integer;
  used integer;
  weight numeric;
  dt date;
  until_date date;
  reason text;
  kind text;
  target_role text;
  enabled boolean;
  initial numeric;
  adjustment numeric;
  farm_id uuid;
begin
  if uid is null or not public.has_app_access() then raise exception 'Acesso à fazenda não autorizado.'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Requisição inválida.'; end if;
  -- Serializa alterações da instalação. Evita baixa perdida, superlotação e replay concorrente.
  perform pg_advisory_xact_lock(726102122000::bigint);
  if not public.has_app_access() then raise exception 'Acesso à fazenda não autorizado.'; end if;
  select * into request from public.app_requests where request_id = p_request_id;
  if found then
    if request.user_id <> uid or request.operation <> p_operation or request.payload <> p_payload then
      raise exception 'Esta requisição já foi concluída com outros dados. Recarregue a tela antes de continuar.';
    end if;
    return request.result;
  end if;
  select id into farm_id from public.farms order by created_at, id limit 1;

  if p_operation = 'create_lot' then
    j := p_payload->'lot';
    arr := coalesce(p_payload->'animals','[]'::jsonb);
    l := jsonb_populate_record(null::public.lots,j);
    if nullif(btrim(l.code),'') is null or l.head_count is null or l.head_count <= 0 or l.entry_avg_weight_kg is null or l.entry_avg_weight_kg <= 0 or l.target_weight_kg is null or l.target_weight_kg <= 0 or l.entry_date is null or l.entry_date > public.app_today() then raise exception 'Confira código, quantidade, pesos e data de entrada.'; end if;
    if jsonb_typeof(arr) <> 'array' or (jsonb_array_length(arr) > 0 and jsonb_array_length(arr) <> l.head_count) then raise exception 'Informe todos os animais do lote ou use o cadastro pela média.'; end if;
    if l.pen_id is not null then
      select * into p from public.pens where id = l.pen_id for update;
      if not found or p.status = 'manutencao' then raise exception 'Curral indisponível.'; end if;
      select coalesce(sum(head_count),0) into used from public.lots where pen_id = p.id and status = 'ativo';
      if used + l.head_count > p.capacity_head then raise exception 'Capacidade do curral excedida.'; end if;
    end if;
    if l.diet_id is not null and not exists(select 1 from public.diets where id = l.diet_id and is_active) then raise exception 'Dieta indisponível.'; end if;
    if l.protocol_id is not null and not exists(select 1 from public.protocols where id = l.protocol_id and is_active) then raise exception 'Protocolo indisponível.'; end if;
    if jsonb_array_length(arr)>0 then
      select avg((value->>'entry_weight_kg')::numeric) into l.entry_avg_weight_kg from jsonb_array_elements(arr);
    end if;
    insert into public.lots(code,origin,entry_date,breed,category,head_count,initial_head_count,entry_avg_weight_kg,target_weight_kg,pen_id,diet_id,protocol_id,notes,owner_id,farm_id)
    values(btrim(l.code),l.origin,l.entry_date,l.breed,l.category,l.head_count,l.head_count,l.entry_avg_weight_kg,l.target_weight_kg,l.pen_id,l.diet_id,l.protocol_id,l.notes,uid,farm_id) returning * into l;
    for j in select value from jsonb_array_elements(arr) loop
      a := jsonb_populate_record(null::public.animals,j);
      if nullif(btrim(a.ear_tag),'') is null or a.entry_weight_kg is null or a.entry_weight_kg <= 0 then raise exception 'Brinco e peso de entrada são obrigatórios.'; end if;
      insert into public.animals(lot_id,pen_id,ear_tag,sisbov,breed,sex,entry_weight_kg,current_weight_kg,owner_id)
      values(l.id,l.pen_id,btrim(a.ear_tag),nullif(btrim(a.sisbov),''),l.breed,a.sex,a.entry_weight_kg,a.entry_weight_kg,uid);
    end loop;
    if coalesce((p_payload->>'applyProtocol')::boolean,false) and l.protocol_id is not null then
      if not exists(select 1 from public.protocol_items where protocol_id=l.protocol_id) then raise exception 'O protocolo não tem itens para aplicar.'; end if;
      select max(l.entry_date + withdrawal_days) filter(where withdrawal_days > 0) into until_date from public.protocol_items where protocol_id=l.protocol_id;
      for item in select * from public.protocol_items where protocol_id=l.protocol_id loop
        -- Um evento por produto e animal; lote sem identificação guarda o evento coletivo.
        if jsonb_array_length(arr) > 0 then
          insert into public.health_events(animal_id,lot_id,pen_id,kind,product,dose,event_date,withdrawal_until,recorded_by,owner_id)
          select id,l.id,l.pen_id,'protocolo',item.product,item.dose,l.entry_date,case when item.withdrawal_days>0 then l.entry_date+item.withdrawal_days end,uid,uid from public.animals where public.animals.lot_id=l.id;
        else
          insert into public.health_events(lot_id,pen_id,kind,product,dose,event_date,withdrawal_until,head_count,recorded_by,owner_id)
          values(l.id,l.pen_id,'protocolo',item.product,item.dose,l.entry_date,case when item.withdrawal_days>0 then l.entry_date+item.withdrawal_days end,l.head_count,uid,uid);
        end if;
      end loop;
      update public.animals set withdrawal_until=until_date, health_status=case when until_date>public.app_today() then 'carencia' else 'saudavel' end where public.animals.lot_id=l.id;
    end if;
    result := to_jsonb(l);

  elsif p_operation = 'update_lot' then
    select * into l from public.lots where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'Lote não encontrado.'; end if;
    if p_payload ? 'head_count' or p_payload ? 'pen_id' then raise exception 'Use saída ou transferência para alterar saldo e curral.'; end if;
    if p_payload ? 'status' and (p_payload->>'status'<>'encerrado' or l.head_count<>0) then raise exception 'Só é possível encerrar um lote sem cabeças restantes.'; end if;
    if p_payload ? 'target_weight_kg' and ((p_payload->>'target_weight_kg')::numeric is null or (p_payload->>'target_weight_kg')::numeric<=0) then raise exception 'Peso alvo deve ser positivo.'; end if;
    update public.lots set target_weight_kg=coalesce((p_payload->>'target_weight_kg')::numeric,target_weight_kg),status=coalesce(p_payload->>'status',status) where id=l.id;

  elsif p_operation = 'transfer_lot' then
    select * into l from public.lots where id=(p_payload->'lot'->>'id')::uuid for update;
    if not found or l.status<>'ativo' then raise exception 'Lote indisponível.'; end if;
    select * into p from public.pens where id=(p_payload->>'penId')::uuid for update;
    if not found or p.status='manutencao' or p.id=l.pen_id then raise exception 'Curral de destino inválido.'; end if;
    select coalesce(sum(head_count),0) into used from public.lots where pen_id=p.id and status='ativo';
    if used+l.head_count>p.capacity_head then raise exception 'Capacidade do curral excedida.'; end if;
    update public.lots set pen_id=p.id where id=l.id;
    update public.animals set pen_id=p.id where public.animals.lot_id=l.id and status in ('ativo','tratamento');

  elsif p_operation = 'register_exit' then
    select * into l from public.lots where id=(p_payload->'lot'->>'id')::uuid for update;
    if not found or l.status<>'ativo' then raise exception 'Lote indisponível.'; end if;
    head := (p_payload->>'headCount')::integer;
    -- integer cast alone arredonda numeric JSON? Texto decimal não é aceito aqui.
    dt := (p_payload->>'date')::date;
    reason := p_payload->>'reason';
    weight := (p_payload->>'weightKg')::numeric;
    if head is null or head<=0 or head>l.head_count or dt is null or dt<l.entry_date or dt>public.app_today() or reason is null or reason not in ('abate','venda','obito') or (weight is not null and weight<=0) then raise exception 'Saída inválida: confira quantidade, data, motivo e peso.'; end if;
    if coalesce((p_payload->>'closeLot')::boolean,false) and head<>l.head_count then raise exception 'O lote ainda terá animais. Registre o destino do saldo antes de encerrar.'; end if;
    arr := coalesce(p_payload->'animalIds','[]'::jsonb);
    select coalesce(array_agg(value::uuid),'{}'::uuid[]) into animal_ids from jsonb_array_elements_text(arr);
    if cardinality(animal_ids)<>(select count(distinct x) from unnest(animal_ids) x) then raise exception 'Animal repetido na saída.'; end if;
    select count(*) into present from public.animals where public.animals.lot_id=l.id and status in ('ativo','tratamento');
    anonymous := head-cardinality(animal_ids);
    if anonymous<0 or anonymous>greatest(l.head_count-present,0) then raise exception 'Selecione os animais que saíram; quantidade sem identificação excede o saldo.'; end if;
    if (select count(*) from public.animals where id=any(animal_ids) and public.animals.lot_id=l.id and status in ('ativo','tratamento'))<>cardinality(animal_ids) then raise exception 'Um animal selecionado não está mais neste lote.'; end if;
    if reason='abate' then
      if anonymous>0 then raise exception 'Abate exige identificação individual e verificação da carência.'; end if;
      if exists(select 1 from public.animals where id=any(animal_ids) and (status='tratamento' or withdrawal_until>dt)) then raise exception 'Animal em tratamento ou carência não pode sair para abate.'; end if;
      -- Também protege contra carência coletiva/importada, sem apagar a individual.
      if exists(select 1 from public.health_events where public.health_events.lot_id=l.id and animal_id is null and event_date<=dt and withdrawal_until>dt) then raise exception 'O lote ainda está em carência sanitária.'; end if;
    end if;
    update public.animals set status=case reason when 'abate' then 'abatido' when 'venda' then 'vendido' else 'morto' end where id=any(animal_ids);
    update public.lots set head_count=head_count-head,status=case when head_count-head=0 then 'encerrado' else 'ativo' end where id=l.id;
    insert into public.lot_exits(lot_id,reason,head_count,animal_ids,weight_kg,destination,date,recorded_by)
    values(l.id,reason,head,animal_ids,weight,nullif(btrim(p_payload->>'destination'),''),dt,uid) returning id into ident;
    if reason='obito' then
      insert into public.health_events(lot_id,pen_id,kind,diagnosis,event_date,head_count,recorded_by,owner_id)
      values(l.id,l.pen_id,'obito','Óbito registrado na saída',dt,head,uid,uid);
    end if;
    result:=jsonb_build_object('id',ident);

  elsif p_operation='save_weighing' then
    j:=p_payload->'weighing';arr:=coalesce(p_payload->'records','[]'::jsonb);
    w:=jsonb_populate_record(null::public.weighings,j);
    select * into l from public.lots where id=w.lot_id for update;
    if not found or l.status<>'ativo' then raise exception 'Lote indisponível.'; end if;
    if w.date is null or w.date<l.entry_date or w.date>public.app_today() or w.kind is null or w.kind not in ('individual','amostral','lote_completo') or w.head_count_weighed is null or w.head_count_weighed<=0 or w.head_count_weighed>l.head_count or w.avg_weight_kg is null or w.avg_weight_kg<=0 then raise exception 'Confira data, quantidade e peso da pesagem.'; end if;
    if w.kind='lote_completo' and w.head_count_weighed<>l.head_count then raise exception 'Pesagem completa exige todas as cabeças do lote.'; end if;
    if w.kind='individual' then
      if jsonb_array_length(arr)<>w.head_count_weighed then raise exception 'Quantidade de pesos diferente da quantidade de animais.'; end if;
      select coalesce(array_agg((value->>'animal_id')::uuid),'{}'::uuid[]),avg((value->>'weight_kg')::numeric) into animal_ids,weight from jsonb_array_elements(arr);
      if cardinality(animal_ids)<>(select count(distinct x) from unnest(animal_ids) x) or exists(select 1 from jsonb_array_elements(arr) where (value->>'weight_kg')::numeric is null or (value->>'weight_kg')::numeric<=0) then raise exception 'Confira animais e pesos individuais.'; end if;
      if (select count(*) from public.animals where id=any(animal_ids) and public.animals.lot_id=l.id and status in ('ativo','tratamento'))<>cardinality(animal_ids) then raise exception 'Animal fora do lote ou já baixado.'; end if;
      w.avg_weight_kg:=weight;
    elsif jsonb_array_length(arr)>0 then raise exception 'Registros individuais exigem pesagem individual.';
    end if;
    insert into public.weighings(lot_id,pen_id,date,kind,head_count_weighed,avg_weight_kg,notes,recorded_by,owner_id)
    values(l.id,l.pen_id,w.date,w.kind,w.head_count_weighed,w.avg_weight_kg,w.notes,uid,uid) returning * into w;
    for j in select value from jsonb_array_elements(arr) loop
      insert into public.weight_records(weighing_id,animal_id,weight_kg,owner_id) values(w.id,(j->>'animal_id')::uuid,(j->>'weight_kg')::numeric,uid);
    end loop;
    affected_ids:=animal_ids;
    result:=to_jsonb(w);

  elsif p_operation='delete_weighing' then
    select * into w from public.weighings where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'Pesagem não encontrada.'; end if;
    select coalesce(array_agg(animal_id),'{}'::uuid[]) into affected_ids from public.weight_records where weighing_id=w.id;
    delete from public.weighings where id=w.id;

  elsif p_operation='save_health_event' then
    h:=jsonb_populate_record(null::public.health_events,p_payload->'event');
    select * into a from public.animals where id=h.animal_id for update;
    if not found or a.status not in ('ativo','tratamento') then raise exception 'Animal indisponível.'; end if;
    if h.event_date is null or h.event_date>public.app_today() or h.event_date<a.created_at::date and a.lot_id is null then raise exception 'Data do evento inválida.'; end if;
    if a.lot_id is not null then
      select * into l from public.lots where id=a.lot_id for update;
      if l.status<>'ativo' or h.event_date<l.entry_date then raise exception 'Data anterior à entrada ou lote encerrado.'; end if;
    end if;
    if h.kind is null or h.kind not in ('tratamento','vacina','obito') then raise exception 'Tipo de evento inválido.'; end if;
    if h.kind<>'obito' and nullif(btrim(h.product),'') is null then raise exception 'Informe o produto.'; end if;
    if h.withdrawal_until is not null and h.withdrawal_until<h.event_date then raise exception 'Carência anterior à aplicação.'; end if;
    insert into public.health_events(animal_id,lot_id,pen_id,kind,product,dose,diagnosis,event_date,withdrawal_until,notes,head_count,recorded_by,owner_id)
    values(a.id,a.lot_id,a.pen_id,h.kind,h.product,h.dose,h.diagnosis,h.event_date,h.withdrawal_until,h.notes,1,uid,uid) returning * into h;
    if h.kind='obito' then
      update public.animals set status='morto' where id=a.id;
      if a.lot_id is not null then
        if l.head_count<=0 then raise exception 'Lote sem saldo para registrar óbito.'; end if;
        update public.lots set head_count=head_count-1,status=case when head_count=1 then 'encerrado' else status end where id=l.id;
        insert into public.lot_exits(lot_id,reason,head_count,animal_ids,date,recorded_by) values(l.id,'obito',1,array[a.id],h.event_date,uid);
      end if;
    else
      select greatest(a.withdrawal_until,max(withdrawal_until)) into until_date from public.health_events where animal_id=a.id;
      update public.animals set withdrawal_until=until_date,
        status=case when h.kind='tratamento' or a.status='tratamento' then 'tratamento' else 'ativo' end,
        health_status=case when until_date>public.app_today() then 'carencia' when h.kind='tratamento' or a.status='tratamento' then 'tratamento' else a.health_status end
      where id=a.id;
    end if;
    result:=to_jsonb(h);

  elsif p_operation='save_diet' then
    if not public.is_gestor() then raise exception 'Somente gestor altera dietas.'; end if;
    d:=jsonb_populate_record(null::public.diets,p_payload->'diet');
    if nullif(btrim(d.name),'') is null then raise exception 'Nome da dieta obrigatório.'; end if;
    if d.id is null then
      insert into public.diets(name,dry_matter_pct,notes,is_active,owner_id,farm_id) values(btrim(d.name),d.dry_matter_pct,d.notes,coalesce(d.is_active,true),uid,farm_id) returning id into ident;
    else
      update public.diets set name=btrim(d.name),dry_matter_pct=d.dry_matter_pct,notes=d.notes,is_active=coalesce(d.is_active,true) where id=d.id returning id into ident;
      if not found then raise exception 'Dieta não encontrada.'; end if;
    end if;
    delete from public.diet_items where diet_id=ident;
    for j in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
      if nullif(btrim(j->>'ingredient'),'') is not null then
        if (j->>'kg_per_head_day')::numeric is null or (j->>'kg_per_head_day')::numeric<0 then raise exception 'Quantidade do ingrediente inválida.'; end if;
        insert into public.diet_items(diet_id,ingredient,kg_per_head_day,owner_id) values(ident,btrim(j->>'ingredient'),(j->>'kg_per_head_day')::numeric,uid);
      end if;
    end loop;
    result:=to_jsonb(ident);

  elsif p_operation='save_protocol' then
    if not public.is_gestor() then raise exception 'Somente gestor altera protocolos.'; end if;
    protocol:=jsonb_populate_record(null::public.protocols,p_payload->'protocol');
    if nullif(btrim(protocol.name),'') is null then raise exception 'Nome do protocolo obrigatório.'; end if;
    if protocol.id is null then
      insert into public.protocols(name,description,is_active,owner_id,farm_id) values(btrim(protocol.name),protocol.description,coalesce(protocol.is_active,true),uid,farm_id) returning id into ident;
    else
      update public.protocols set name=btrim(protocol.name),description=protocol.description,is_active=coalesce(protocol.is_active,true) where id=protocol.id returning id into ident;
      if not found then raise exception 'Protocolo não encontrado.'; end if;
    end if;
    delete from public.protocol_items where protocol_id=ident;
    for j in select value from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
      if nullif(btrim(j->>'product'),'') is not null then
        insert into public.protocol_items(protocol_id,kind,product,dose,withdrawal_days,owner_id)
        values(ident,j->>'kind',btrim(j->>'product'),j->>'dose',coalesce((j->>'withdrawal_days')::integer,0),uid);
      end if;
    end loop;
    result:=to_jsonb(ident);

  elsif p_operation='save_farm' then
    if not public.is_gestor() then raise exception 'Somente gestor altera a fazenda.'; end if;
    if nullif(btrim(p_payload->>'name'),'') is null then raise exception 'Nome da fazenda obrigatório.'; end if;
    ident:=nullif(p_payload->>'id','')::uuid;
    if ident is null then
      if exists(select 1 from public.farms) then raise exception 'Esta instalação já possui uma fazenda.'; end if;
      insert into public.farms(name,city,state,owner_id) values(btrim(p_payload->>'name'),p_payload->>'city',p_payload->>'state',uid) returning id into ident;
    else
      update public.farms set name=btrim(p_payload->>'name'),city=p_payload->>'city',state=p_payload->>'state' where id=ident;
      if not found then raise exception 'Fazenda não encontrada.'; end if;
    end if;
    result:=to_jsonb(ident);

  elsif p_operation='update_profile' then
    if not public.is_gestor() then raise exception 'Somente gestor altera usuários.'; end if;
    ident:=(p_payload->>'id')::uuid;
    if not exists(select 1 from public.profiles where id=ident) then raise exception 'Usuário não encontrado.'; end if;
    target_role:=p_payload->>'role';enabled:=(p_payload->>'enabled')::boolean;
    if target_role is not null and target_role not in ('gestor','operador') then raise exception 'Perfil inválido.'; end if;
    if (target_role='operador' or enabled=false) and exists(select 1 from public.profiles where id=ident and role='gestor') and exists(select 1 from public.app_members where user_id=ident and public.app_members.enabled) and
      (select count(*) from public.profiles p2 join public.app_members m on m.user_id=p2.id where p2.role='gestor' and m.enabled)<=1 then raise exception 'Mantenha pelo menos um gestor autorizado.'; end if;
    if target_role is not null then update public.profiles set role=target_role where id=ident; end if;
    if p_payload ? 'fullName' then update public.profiles set full_name=p_payload->>'fullName' where id=ident; end if;
    if enabled is not null then insert into public.app_members(user_id,enabled) values(ident,enabled) on conflict(user_id) do update set enabled=excluded.enabled; end if;

  elsif p_operation='save_animal' then
    a:=jsonb_populate_record(null::public.animals,p_payload);
    if nullif(btrim(a.ear_tag),'') is null or a.status is null or a.status not in ('ativo','tratamento') then raise exception 'Use uma saída ou ocorrência para baixar animais; brinco é obrigatório.'; end if;
    if (a.entry_weight_kg is not null and a.entry_weight_kg<=0) or (a.current_weight_kg is not null and a.current_weight_kg<=0) then raise exception 'Peso deve ser positivo.'; end if;
    if a.lot_id is not null then
      select * into l from public.lots where id=a.lot_id for update;
      if not found or l.status<>'ativo' then raise exception 'Lote indisponível.'; end if;
      a.pen_id:=l.pen_id;
    end if;
    if a.id is null then
      if a.lot_id is not null and (select count(*) from public.animals where public.animals.lot_id=l.id and status in ('ativo','tratamento'))>=l.head_count then raise exception 'Todos os animais deste lote já estão identificados.'; end if;
      -- Ao identificar um animal de lote coletivo, herdar carência coletiva vigente.
      select greatest(a.withdrawal_until,max(withdrawal_until)) into until_date from public.health_events where public.health_events.lot_id=a.lot_id and animal_id is null;
      insert into public.animals(lot_id,pen_id,ear_tag,sisbov,breed,sex,entry_weight_kg,current_weight_kg,status,health_status,withdrawal_until,notes,owner_id)
      values(a.lot_id,a.pen_id,btrim(a.ear_tag),nullif(btrim(a.sisbov),''),a.breed,a.sex,a.entry_weight_kg,a.current_weight_kg,a.status,case when until_date>public.app_today() then 'carencia' else coalesce(a.health_status,'saudavel') end,until_date,a.notes,uid) returning id into ident;
    else
      select * into item from public.animals where id=a.id for update;
      if not found or item.status not in ('ativo','tratamento') then raise exception 'Animal indisponível para edição.'; end if;
      if item.lot_id is distinct from a.lot_id then raise exception 'Não altere o lote por edição de cadastro. Use a movimentação do lote.'; end if;
      if item.status='tratamento' and a.status='ativo' and not public.is_gestor() then raise exception 'Somente gestor pode encerrar um tratamento.'; end if;
      select greatest(a.withdrawal_until,item.withdrawal_until,max(withdrawal_until)) into until_date from public.health_events where animal_id=a.id or (public.health_events.lot_id=a.lot_id and animal_id is null);
      update public.animals set pen_id=a.pen_id,ear_tag=btrim(a.ear_tag),sisbov=nullif(btrim(a.sisbov),''),breed=a.breed,sex=a.sex,entry_weight_kg=a.entry_weight_kg,
        current_weight_kg=case when exists(select 1 from public.weight_records where animal_id=a.id) then current_weight_kg else a.current_weight_kg end,
        status=a.status,health_status=case when until_date>public.app_today() then 'carencia' else coalesce(a.health_status,'saudavel') end,withdrawal_until=until_date,notes=a.notes where id=a.id;
      ident:=a.id;
    end if;
    result:=to_jsonb(ident);

  elsif p_operation='delete_animal' then
    if not public.is_gestor() then raise exception 'Somente gestor remove identificações.'; end if;
    ident:=(p_payload->>'id')::uuid;
    if exists(select 1 from public.weight_records where animal_id=ident) or exists(select 1 from public.health_events where animal_id=ident) or exists(select 1 from public.lot_exits where ident=any(public.lot_exits.animal_ids)) then raise exception 'Animal possui histórico e não pode ser excluído.'; end if;
    delete from public.animals where id=ident and status in ('ativo','tratamento');
    if not found then raise exception 'Animal indisponível.'; end if;
    -- Remover identificação não representa saída física; saldo do lote permanece.

  elsif p_operation in ('save_pen','delete_pen','delete_diet','delete_protocol') then
    if not public.is_gestor() then raise exception 'Somente gestor altera cadastros.'; end if;
    ident:=nullif(p_payload->>'id','')::uuid;
    if p_operation='save_pen' then
      p:=jsonb_populate_record(null::public.pens,p_payload);
      if nullif(btrim(p.code),'') is null or p.capacity_head is null or p.capacity_head<=0 then raise exception 'Código e capacidade válidos são obrigatórios.'; end if;
      select coalesce(sum(head_count),0) into used from public.lots where pen_id=ident and status='ativo';
      if used>p.capacity_head or (used>0 and p.status='manutencao') then raise exception 'Curral ocupado: capacidade/status incompatível.'; end if;
      if ident is null then
        insert into public.pens(code,capacity_head,area_m2,status,notes,owner_id,farm_id) values(btrim(p.code),p.capacity_head,p.area_m2,coalesce(p.status,'vazio'),p.notes,uid,farm_id) returning id into ident;
      else
        update public.pens set code=btrim(p.code),capacity_head=p.capacity_head,area_m2=p.area_m2,status=p.status,notes=p.notes where id=ident;
        if not found then raise exception 'Curral não encontrado.'; end if;
      end if;
    elsif p_operation='delete_pen' then
      if exists(select 1 from public.lots where pen_id=ident) or exists(select 1 from public.animals where pen_id=ident) or exists(select 1 from public.feed_logs where pen_id=ident) or exists(select 1 from public.trough_readings where pen_id=ident) or exists(select 1 from public.health_events where pen_id=ident) or exists(select 1 from public.weighings where pen_id=ident) then raise exception 'Curral possui vínculos/histórico. Altere seu status em vez de excluir.'; end if;
      delete from public.pens where id=ident;
    elsif p_operation='delete_diet' then
      if exists(select 1 from public.lots where diet_id=ident) or exists(select 1 from public.feed_logs where diet_id=ident) then raise exception 'Dieta possui histórico. Desative-a em vez de excluir.'; end if;
      delete from public.diets where id=ident;
    else
      if exists(select 1 from public.lots where protocol_id=ident) then raise exception 'Protocolo possui histórico. Desative-o em vez de excluir.'; end if;
      delete from public.protocols where id=ident;
    end if;
    result:=to_jsonb(ident);

  elsif p_operation='save_feed' then
    head:=(p_payload->>'head_count')::integer;weight:=(p_payload->>'kg_per_head')::numeric;
    dt:=(p_payload->>'date')::date;ident:=(p_payload->>'pen_id')::uuid;v_lot_id:=nullif(p_payload->>'lot_id','')::uuid;
    if head is null or head<=0 or weight is null or weight<0 or dt is null or dt>public.app_today() or not exists(select 1 from public.pens where id=ident and status<>'manutencao') then raise exception 'Trato inválido.'; end if;
    if v_lot_id is not null and not exists(select 1 from public.lots where id=v_lot_id and pen_id=ident and status='ativo' and head_count>=head and entry_date<=dt) then raise exception 'Lote não está mais neste curral.'; end if;
    if head>(select coalesce(sum(head_count),0) from public.lots where pen_id=ident and status='ativo') then raise exception 'Quantidade do trato excede o saldo do curral.'; end if;
    insert into public.feed_logs(pen_id,lot_id,date,shift,diet_id,head_count,kg_per_head,total_kg,notes,recorded_by,owner_id)
    values(ident,v_lot_id,dt,p_payload->>'shift',nullif(p_payload->>'diet_id','')::uuid,head,weight,round(head*weight,2),p_payload->>'notes',uid,uid) returning id into ident;
    result:=to_jsonb(ident);

  elsif p_operation='delete_feed' then
    ident:=(p_payload->>'id')::uuid;
    if exists(select 1 from public.reading_applications where feed_log_id=ident) then raise exception 'Trato gerado por leitura possui vínculo. Não pode ser excluído isoladamente.'; end if;
    delete from public.feed_logs where id=ident;

  elsif p_operation='save_reading' then
    ident:=(p_payload->>'pen_id')::uuid;dt:=(p_payload->>'date')::date;
    initial:=(p_payload->>'base_kg_per_head')::numeric;adjustment:=(p_payload->>'adjustment_pct')::numeric;
    if dt is null or dt>public.app_today() or initial is null or initial<0 or adjustment is null or adjustment < -100 or (p_payload->>'score') is null or (p_payload->>'score')::integer not between 0 and 5 then raise exception 'Confira data, score e ajuste de cocho.'; end if;
    if not exists(select 1 from public.pens where id=ident and status<>'manutencao') then raise exception 'Curral indisponível.'; end if;
    select id into v_lot_id from public.lots where pen_id=ident and status='ativo' order by id limit 1;
    if v_lot_id is null then raise exception 'Curral sem lote ativo.'; end if;
    select id into v_reading_id from public.trough_readings where pen_id=ident and date=dt order by created_at desc,id desc limit 1;
    if v_reading_id is not null then
      if exists(select 1 from public.reading_applications where reading_id=v_reading_id) then raise exception 'Esta leitura já gerou um trato e não pode ser reaplicada.'; end if;
      update public.trough_readings set lot_id=v_lot_id,score=(p_payload->>'score')::integer,leftover_kg=(p_payload->>'leftover_kg')::numeric,
        base_kg_per_head=initial,adjustment_pct=adjustment,adjustment_kg=round(initial*adjustment/100,3),notes=p_payload->>'notes',recorded_by=uid where id=v_reading_id;
      ident:=v_reading_id;
    else
      insert into public.trough_readings(pen_id,lot_id,date,score,leftover_kg,base_kg_per_head,adjustment_pct,adjustment_kg,notes,recorded_by,owner_id)
      values(ident,v_lot_id,dt,(p_payload->>'score')::integer,(p_payload->>'leftover_kg')::numeric,initial,adjustment,round(initial*adjustment/100,3),p_payload->>'notes',uid,uid) returning id into ident;
    end if;
    result:=to_jsonb(ident);

  elsif p_operation='apply_readings' then
    dt:=(p_payload->>'date')::date;
    if dt is null or dt<>public.app_today() then raise exception 'Aplicação deve corresponder ao dia atual.'; end if;
    for item in select distinct on (pen_id) * from public.trough_readings where date=dt order by pen_id,created_at desc,id desc loop
      if item.adjustment_pct=0 or exists(select 1 from public.reading_applications where reading_id=item.id) then continue; end if;
      if item.base_kg_per_head is null then raise exception 'Leitura antiga sem oferta base. Faça uma nova leitura antes de aplicar.'; end if;
      select * into l from public.lots where id=item.lot_id and pen_id=item.pen_id and status='ativo';
      if not found then raise exception 'Lote foi movido ou encerrado; revise a leitura.'; end if;
      select coalesce(sum(head_count),0) into head from public.lots where pen_id=item.pen_id and status='ativo';
      if (select count(distinct diet_id) from public.lots where pen_id=item.pen_id and status='ativo')>1 then raise exception 'Curral com dietas distintas: registre o trato por lote.'; end if;
      weight:=round(item.base_kg_per_head*(1+item.adjustment_pct/100),3);
      insert into public.feed_logs(pen_id,lot_id,date,shift,diet_id,head_count,kg_per_head,total_kg,notes,recorded_by,owner_id)
      values(item.pen_id,case when (select count(*) from public.lots where pen_id=item.pen_id and status='ativo')=1 then l.id else null end,dt,'manha',l.diet_id,head,weight,round(head*weight,2),'Oferta da manhã gerada pela leitura de cocho',uid,uid) returning id into ident;
      insert into public.reading_applications(reading_id,feed_log_id) values(item.id,ident);
    end loop;
  else raise exception 'Operação não suportada.';
  end if;

  -- O peso vigente é derivado da última pesagem, não da última requisição.
  if cardinality(affected_ids)>0 then
    update public.animals a2 set current_weight_kg=coalesce((select r.weight_kg from public.weight_records r join public.weighings w2 on w2.id=r.weighing_id where r.animal_id=a2.id order by w2.date desc,w2.created_at desc,w2.id desc,r.id desc limit 1),a2.entry_weight_kg)
    where a2.id=any(affected_ids);
  end if;
  insert into public.app_requests(request_id,user_id,operation,payload,result) values(p_request_id,uid,p_operation,p_payload,coalesce(result,'null'::jsonb));
  return result;
end $$;

-- Não expor funções transacionais por PUBLIC/anon; autorização também é verificada dentro delas.
revoke all on function public.app_mutate(text,jsonb,uuid) from public, anon;
grant execute on function public.app_mutate(text,jsonb,uuid) to authenticated;
revoke all on function public.has_app_access() from public, anon;
grant execute on function public.has_app_access() to authenticated;
revoke all on function public.is_gestor() from public, anon;
grant execute on function public.is_gestor() to authenticated;
commit;
