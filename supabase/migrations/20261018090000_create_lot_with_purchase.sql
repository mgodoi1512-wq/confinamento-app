begin;
-- Requer as tabelas de valores de compra da migração 20261018080000.
create table if not exists app_private.stock_lot_creation_requests (
 request_id uuid primary key, farm_id uuid not null, actor_id uuid not null,
 payload jsonb not null,response jsonb not null,created_at timestamptz not null default now()
);
revoke all on app_private.stock_lot_creation_requests from public,anon,authenticated,app_farm_executor;
create or replace function public.app_create_priced_lot(p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();saved app_private.stock_lot_creation_requests;prices jsonb;price jsonb;v numeric;def numeric;
 result jsonb;created_lot_id uuid;created_animal_id uuid;tag text;
begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem cadastrar lotes com preço.';end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Requisição inválida.';end if;
 perform pg_advisory_xact_lock(726102122000::bigint);
 select * into saved from app_private.stock_lot_creation_requests where request_id=p_request_id;
 if found then
  if saved.farm_id<>f or saved.actor_id<>auth.uid() or saved.payload is distinct from p_payload then raise exception 'Identificador de cadastro já utilizado. Recarregue antes de tentar novamente.';end if;
  if not exists(select 1 from public.lots where id=(saved.response->>'id')::uuid and farm_id=f) then raise exception 'O lote deste cadastro não está mais disponível.';end if;
  return saved.response;
 end if;
 if exists(select 1 from public.app_requests where request_id=p_request_id) then raise exception 'Identificador de cadastro já utilizado. Recarregue antes de tentar novamente.';end if;
 prices:=p_payload->'purchase';
 if jsonb_typeof(prices) is distinct from 'object' or jsonb_typeof(prices->'animals') is distinct from 'array' then raise exception 'Dados de compra inválidos.';end if;
 if jsonb_typeof(coalesce(p_payload->'animals','[]'::jsonb)) is distinct from 'array' then raise exception 'Animais inválidos.';end if;
 if prices->'defaultPerHead' is not null and prices->'defaultPerHead'<>'null'::jsonb then
  if jsonb_typeof(prices->'defaultPerHead')<>'number' then raise exception 'Informe um preço de compra numérico por cabeça.';end if;
  def:=(prices->>'defaultPerHead')::numeric;
  if def<0 or def>999999999999 then raise exception 'Preço de compra por cabeça fora do limite.';end if;
 end if;
 if exists(select 1 from jsonb_array_elements(prices->'animals') a group by btrim(a->>'earTag') having count(*)>1) then raise exception 'Não repita o preço do mesmo brinco.';end if;
 for price in select value from jsonb_array_elements(prices->'animals') loop
  tag:=nullif(btrim(price->>'earTag'),'');
  if tag is null or jsonb_typeof(price->'amount') is distinct from 'number' then raise exception 'Informe brinco e preço de compra válidos.';end if;
  v:=(price->>'amount')::numeric;
  if v<0 or v>999999999999 then raise exception 'Preço de compra individual fora do limite.';end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_payload->'animals','[]'::jsonb)) a where btrim(a->>'ear_tag')=tag)<>1 then raise exception 'O preço deve pertencer a um animal deste cadastro.';end if;
 end loop;
 -- A mutação existente mantém permissões, disponibilidade do curral, validação de brincos e protocolos.
 result:=public.app_mutate('create_lot',p_payload-'purchase',p_request_id);
 created_lot_id:=(result->>'id')::uuid;
 if created_lot_id is null or not exists(select 1 from public.lots where id=created_lot_id and farm_id=f) then raise exception 'Não foi possível confirmar o lote criado.';end if;
 if def is not null then insert into public.stock_lot_purchase_defaults(farm_id,lot_id,amount_per_head) values(f,created_lot_id,def);end if;
 for price in select value from jsonb_array_elements(prices->'animals') loop
  tag:=btrim(price->>'earTag');
  select a.id into created_animal_id from public.animals a where a.farm_id=f and a.lot_id=created_lot_id and a.ear_tag=tag;
  if not found then raise exception 'Não foi possível vincular o preço ao animal %.',tag;end if;
  insert into public.stock_animal_purchase_values(farm_id,lot_id,animal_id,amount) values(f,created_lot_id,created_animal_id,(price->>'amount')::numeric);
 end loop;
 insert into app_private.stock_lot_creation_requests(request_id,farm_id,actor_id,payload,response) values(p_request_id,f,auth.uid(),p_payload,result);
 return result;
end $$;
revoke all on function public.app_create_priced_lot(jsonb,uuid) from public,anon;
grant execute on function public.app_create_priced_lot(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
