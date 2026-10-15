-- Página Adaptação: um plano por lote, isolado por fazenda.
-- Execute integralmente no SQL Editor antes de publicar o site.
begin;
create table if not exists public.adaptation_plans (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null default public.current_farm_id() references public.farms(id),
  lot_id uuid not null,
  parameters jsonb not null check(jsonb_typeof(parameters)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adaptation_plans_lot_farm_fk foreign key(lot_id,farm_id) references public.lots(id,farm_id),
  constraint adaptation_plans_farm_lot_unique unique(farm_id,lot_id)
);
alter table public.adaptation_plans enable row level security;
revoke all on public.adaptation_plans from public,anon,authenticated;
grant select on public.adaptation_plans to authenticated;
grant select,insert,update on public.adaptation_plans to app_farm_executor;
drop policy if exists tenant_read on public.adaptation_plans;
create policy tenant_read on public.adaptation_plans for select to authenticated,app_farm_executor using(farm_id=(select public.current_farm_id()));
drop policy if exists tenant_write on public.adaptation_plans;
create policy tenant_write on public.adaptation_plans for all to app_farm_executor
using(farm_id=(select public.current_farm_id())) with check(farm_id=(select public.current_farm_id()));

create or replace function app_private.app_save_adaptation(p_lot_id uuid,p_parameters jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  fid uuid:=public.current_farm_id(); saved public.adaptation_plans%rowtype; item jsonb; field text; value numeric;
begin
  if fid is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem salvar planos de adaptação.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(fid::text||':adaptation:'||p_lot_id::text,0));
  if not exists(select 1 from public.lots where id=p_lot_id and farm_id=fid and status='ativo') then raise exception 'Selecione um lote ativo da sua fazenda.'; end if;
  if p_parameters is null or jsonb_typeof(p_parameters)<>'object' then raise exception 'Parâmetros de adaptação inválidos.'; end if;
  foreach field in array array['headCount','averageWeightKg','feedPriceKg','roughagePriceKg','totalDays','postFeedPct','postRoughagePct'] loop
    if jsonb_typeof(p_parameters->field) is distinct from 'number' then raise exception 'Campo numérico inválido: %.',field; end if;
    value:=(p_parameters->>field)::numeric;
    if not (value between 0 and 1000000) then raise exception 'Valor fora do limite: %.',field; end if;
  end loop;
  if (p_parameters->>'headCount')::numeric<1 or trunc((p_parameters->>'headCount')::numeric)<>(p_parameters->>'headCount')::numeric
    or not ((p_parameters->>'averageWeightKg')::numeric between 0.001 and 100000)
    or not ((p_parameters->>'totalDays')::numeric between 15 and 3650) or trunc((p_parameters->>'totalDays')::numeric)<>(p_parameters->>'totalDays')::numeric
    or (p_parameters->>'postFeedPct')::numeric>100 or (p_parameters->>'postRoughagePct')::numeric>100 then raise exception 'Confira animais, peso, dias e percentuais.'; end if;
  if jsonb_typeof(p_parameters->'startDate') is distinct from 'string' or not (p_parameters->>'startDate' ~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Data de início inválida.'; end if;
  perform (p_parameters->>'startDate')::date;
  if jsonb_typeof(p_parameters->'phases') is distinct from 'array' then raise exception 'Informe as cinco etapas de adaptação.'; end if;
  if jsonb_array_length(p_parameters->'phases')<>5 then raise exception 'Informe as cinco etapas de adaptação.'; end if;
  for item in select * from jsonb_array_elements(p_parameters->'phases') loop
    if jsonb_typeof(item->'days') is distinct from 'number' or (item->>'days')::numeric<>3 then raise exception 'Cada etapa deve ter 3 dias.'; end if;
    foreach field in array array['feedPct','roughagePct'] loop
      if jsonb_typeof(item->field) is distinct from 'number' then raise exception 'Percentual da etapa inválido.'; end if;
      if not ((item->>field)::numeric between 0 and 100) then raise exception 'Percentual da etapa deve estar entre 0 e 100.'; end if;
    end loop;
  end loop;
  select * into saved from public.adaptation_plans where farm_id=fid and lot_id=p_lot_id for update;
  if found then
    if saved.parameters=p_parameters then return to_jsonb(saved); end if;
    if saved.updated_at is distinct from p_expected_updated_at then raise exception 'Este plano foi alterado por outro usuário. Recarregue os planos antes de salvar.'; end if;
    update public.adaptation_plans set parameters=p_parameters,updated_at=clock_timestamp() where id=saved.id returning * into saved;
  else
    if p_expected_updated_at is not null then raise exception 'Plano não encontrado. Recarregue os dados.'; end if;
    insert into public.adaptation_plans(farm_id,lot_id,parameters) values(fid,p_lot_id,p_parameters) returning * into saved;
  end if;
  return to_jsonb(saved);
end $$;
-- O executor não recebe CREATE em public. A rotina com RLS fica no schema interno.
grant create on schema app_private to app_farm_executor;
alter function app_private.app_save_adaptation(uuid,jsonb,timestamptz) owner to app_farm_executor;
revoke create on schema app_private from app_farm_executor;
revoke all on function app_private.app_save_adaptation(uuid,jsonb,timestamptz) from public,anon,authenticated;

create or replace function public.app_save_adaptation(p_lot_id uuid,p_parameters jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language sql security definer set search_path='' as $$
  select app_private.app_save_adaptation(p_lot_id,p_parameters,p_expected_updated_at);
$$;
revoke all on function public.app_save_adaptation(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.app_save_adaptation(uuid,jsonb,timestamptz) to authenticated;
commit;
select to_regclass('public.adaptation_plans') is not null as pagina_adaptacao_instalada;
