-- Financeiro: cálculo de custos salvo por fazenda, com acesso de gestores.
begin;
create table if not exists public.farm_cost_sheets (
 farm_id uuid primary key default public.current_farm_id() references public.farms(id),
 parameters jsonb not null check(jsonb_typeof(parameters)='object'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.farm_cost_sheets enable row level security;
revoke all on public.farm_cost_sheets from public,anon,authenticated;
grant select on public.farm_cost_sheets to authenticated;
grant select,insert,update on public.farm_cost_sheets to app_farm_executor;
drop policy if exists finance_read on public.farm_cost_sheets;
create policy finance_read on public.farm_cost_sheets for select to authenticated
using(farm_id=(select public.current_farm_id()) and (select public.is_gestor()));
drop policy if exists finance_write on public.farm_cost_sheets;
create policy finance_write on public.farm_cost_sheets for all to app_farm_executor
using(farm_id=(select public.current_farm_id()) and (select public.is_gestor()))
with check(farm_id=(select public.current_farm_id()) and (select public.is_gestor()));

create or replace function app_private.app_save_cost_sheet(p_parameters jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare fid uuid:=public.current_farm_id(); saved public.farm_cost_sheets%rowtype;
 key text; item jsonb; field text; value numeric; total_share numeric:=0; fields text[];
begin
 if fid is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem salvar os custos da fazenda.'; end if;
 if p_parameters is null or jsonb_typeof(p_parameters)<>'object' then raise exception 'Dados de custos inválidos.'; end if;
 foreach key in array array['energy','protein','nucleus','silage'] loop
  item:=p_parameters->key;
  if key='silage' and item='null'::jsonb then continue; end if;
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'Confira os dados de %.',key; end if;
  if key='silage' then
   fields:=array['price','freight'];
   if coalesce(item->>'priceUnit','') not in ('kg','ton') then raise exception 'Unidade de preço da silagem inválida.'; end if;
   if coalesce(item->>'freightUnit','') not in ('kg','ton','load') then raise exception 'Unidade de frete da silagem inválida.'; end if;
  else
   fields:=array['bagKg','bagPrice','sharePct','freight'];
   if jsonb_typeof(item->'name') is distinct from 'string' or length(btrim(item->>'name')) not between 1 and 100 then raise exception 'Nome do ingrediente inválido.'; end if;
   if coalesce(item->>'freightUnit','') not in ('bag','ton','load') then raise exception 'Unidade de frete do ingrediente inválida.'; end if;
  end if;
  foreach field in array fields loop
   if jsonb_typeof(item->field) is distinct from 'number' then raise exception 'Campo numérico inválido: %.',field; end if;
   value:=(item->>field)::numeric;
   if not (value between 0 and 1000000000) then raise exception 'Valor fora do limite: %.',field; end if;
  end loop;
  if key<>'silage' then
   if not ((item->>'bagKg')::numeric between 0.001 and 1000000) or (item->>'sharePct')::numeric>100 then raise exception 'Confira o peso da saca e a participação na mistura.'; end if;
   total_share:=total_share+(item->>'sharePct')::numeric;
  end if;
  if item->'loadKg' is distinct from 'null'::jsonb then
   if jsonb_typeof(item->'loadKg') is distinct from 'number' then raise exception 'Peso da carga inválido.'; end if;
   if not ((item->>'loadKg')::numeric between 0.001 and 1000000000) then raise exception 'Peso da carga deve ser positivo.'; end if;
  end if;
  if item->>'freightUnit'='load' and (item->>'freight')::numeric>0 and (item->'loadKg'='null'::jsonb) then raise exception 'Informe o peso total da carga em kg para dividir o frete.'; end if;
 end loop;
 if abs(total_share-100)>0.000001 then raise exception 'A composição da ração deve somar 100%%.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(fid::text||':finance-costs',0));
 select * into saved from public.farm_cost_sheets where farm_id=fid for update;
 if found then
  if saved.parameters=p_parameters then return to_jsonb(saved); end if;
  if saved.updated_at is distinct from p_expected_updated_at then raise exception 'Os custos foram alterados por outro usuário. Recarregue os valores salvos antes de salvar.'; end if;
  update public.farm_cost_sheets set parameters=p_parameters,updated_at=clock_timestamp() where farm_id=fid returning * into saved;
 else
  if p_expected_updated_at is not null then raise exception 'Custos não encontrados. Recarregue os dados.'; end if;
  insert into public.farm_cost_sheets(farm_id,parameters) values(fid,p_parameters) returning * into saved;
 end if;
 return to_jsonb(saved);
end $$;
grant create on schema app_private to app_farm_executor;
alter function app_private.app_save_cost_sheet(jsonb,timestamptz) owner to app_farm_executor;
revoke create on schema app_private from app_farm_executor;
revoke all on function app_private.app_save_cost_sheet(jsonb,timestamptz) from public,anon,authenticated;
create or replace function public.app_save_cost_sheet(p_parameters jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language sql security definer set search_path='' as $$
 select app_private.app_save_cost_sheet(p_parameters,p_expected_updated_at);
$$;
revoke all on function public.app_save_cost_sheet(jsonb,timestamptz) from public,anon;
grant execute on function public.app_save_cost_sheet(jsonb,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
select true as pagina_financeiro_instalada;
