begin;
-- Requer 20261018060000_cash_flow_inventory.sql já instalado.
-- Registros existentes mantêm o saldo de abertura e a estimativa atuais.
alter table public.finance_workspace_settings add column if not exists cash_configured boolean not null default true;
create or replace function public.app_finance_workspace(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id(); ident uuid; existing public.cash_entries; item public.stock_items;
 settings public.finance_workspace_settings; amount numeric; qty numeric; d date; settled date; lot uuid; previous timestamptz; result jsonb; link record;
begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem acessar o financeiro e o estoque.'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Dados inválidos.'; end if;
 if p_action='snapshot' then
  return jsonb_build_object('settings',(select to_jsonb(s) from public.finance_workspace_settings s where farm_id=f),
   'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.due_date desc,e.id) from public.cash_entries e where farm_id=f),'[]'::jsonb),
   'items',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from public.stock_items s where farm_id=f),'[]'::jsonb),
   'movements',coalesce((select jsonb_agg(to_jsonb(m)-'request_payload' order by m.created_at desc,m.id) from public.stock_movements m where farm_id=f),'[]'::jsonb),
   'links',coalesce((select jsonb_agg(to_jsonb(l)) from public.stock_feed_links l where farm_id=f),'[]'::jsonb));
 end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 if p_action='estimate_settings' then
  select * into settings from public.finance_workspace_settings where farm_id=f for update;
  if settings.updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'Configurações alteradas por outro usuário. Recarregue.'; end if;
  if (p_payload->>'carcass_yield')::numeric is null or not ((p_payload->>'carcass_yield')::numeric>0 and (p_payload->>'carcass_yield')::numeric<=100) then raise exception 'Informe rendimento maior que zero e até 100%%.'; end if;
  if nullif(p_payload->>'arroba_price','') is not null and ((p_payload->>'arroba_price')::numeric<0 or (p_payload->>'arroba_price')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)) then raise exception 'Informe um preço da arroba válido.'; end if;
  -- Ignora campos de caixa que eventualmente venham no payload de estimativa.
  insert into public.finance_workspace_settings(farm_id,carcass_yield,arroba_price,cash_configured)
   values(f,(p_payload->>'carcass_yield')::numeric,nullif(p_payload->>'arroba_price','')::numeric,false)
   on conflict(farm_id) do update set carcass_yield=excluded.carcass_yield,arroba_price=excluded.arroba_price,updated_at=clock_timestamp();
  return '{}'::jsonb;
 elsif p_action='settings' then
  select * into settings from public.finance_workspace_settings where farm_id=f for update;
  if settings.updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'Configurações alteradas por outro usuário. Recarregue.'; end if;
  if (p_payload->>'opening_date')::date is null or (p_payload->>'opening_date')::date>public.app_today() then raise exception 'Informe uma data inicial até hoje.'; end if;
  if (p_payload->>'opening_balance')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'Informe um saldo finito.'; end if;
  if (p_payload->>'opening_balance')::numeric is null or (p_payload->>'carcass_yield')::numeric is null then raise exception 'Informe saldo e rendimento.'; end if;
  insert into public.finance_workspace_settings(farm_id,opening_date,opening_balance,carcass_yield,arroba_price,cash_configured)
   values(f,(p_payload->>'opening_date')::date,(p_payload->>'opening_balance')::numeric,(p_payload->>'carcass_yield')::numeric,nullif(p_payload->>'arroba_price','')::numeric,true)
   on conflict(farm_id) do update set cash_configured=true,opening_date=excluded.opening_date,opening_balance=excluded.opening_balance,carcass_yield=excluded.carcass_yield,arroba_price=excluded.arroba_price,updated_at=clock_timestamp();
  return '{}'::jsonb;
 elsif p_action in ('save_entry','delete_entry') then
  ident:=(p_payload->>'id')::uuid; if ident is null then raise exception 'Identificador inválido.'; end if;
  select * into existing from public.cash_entries where id=ident for update;
  if found and existing.farm_id<>f then raise exception 'Lançamento indisponível.'; end if;
  previous:=nullif(p_payload->>'expected','')::timestamptz;
  -- Reenvio de cadastro é idempotente; alterações exigem a versão atual.
  if existing.id is not null and p_action='save_entry' and previous is null then
   if existing.direction=p_payload->>'direction' and existing.description=btrim(p_payload->>'description') and existing.category=btrim(p_payload->>'category') and existing.amount=(p_payload->>'amount')::numeric and existing.due_date=(p_payload->>'due_date')::date and existing.settled_on is not distinct from nullif(p_payload->>'settled_on','')::date and existing.lot_id is not distinct from nullif(p_payload->>'lot_id','')::uuid and existing.notes=coalesce(p_payload->>'notes','') then return to_jsonb(existing); end if;
  end if;
  if existing.updated_at is distinct from previous then raise exception 'Lançamento alterado por outro usuário. Recarregue.'; end if;
  if p_action='delete_entry' then delete from public.cash_entries where id=ident and farm_id=f; return '{}'::jsonb; end if;
  amount:=(p_payload->>'amount')::numeric;d:=(p_payload->>'due_date')::date;settled:=nullif(p_payload->>'settled_on','')::date;lot:=nullif(p_payload->>'lot_id','')::uuid;
  if settled>public.app_today() then raise exception 'A data de pagamento ou recebimento não pode ser futura.'; end if;
  if amount is null or round(amount,2)<=0 or amount>999999999999 or d is null then raise exception 'Informe valor positivo e vencimento.'; end if;
  if lot is not null and not exists(select 1 from public.lots where id=lot and farm_id=f) then raise exception 'Lote indisponível.'; end if;
  insert into public.cash_entries(id,farm_id,direction,description,category,amount,due_date,settled_on,lot_id,notes)
   values(ident,f,p_payload->>'direction',btrim(p_payload->>'description'),btrim(p_payload->>'category'),amount,d,settled,lot,coalesce(p_payload->>'notes',''))
   on conflict(id) do update set direction=excluded.direction,description=excluded.description,category=excluded.category,amount=excluded.amount,due_date=excluded.due_date,settled_on=excluded.settled_on,lot_id=excluded.lot_id,notes=excluded.notes,updated_at=clock_timestamp() returning to_jsonb(cash_entries.*) into result;
  return result;
 elsif p_action='save_item' then
  if (p_payload->>'minimum_kg')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'Informe um estoque mínimo finito.'; end if;
  ident:=(p_payload->>'id')::uuid;
  select * into item from public.stock_items where id=ident for update;
  if found and item.farm_id<>f then raise exception 'Item indisponível.'; end if;
  if item.id is not null and item.name=btrim(p_payload->>'name') and item.category=p_payload->>'category' and item.minimum_kg=(p_payload->>'minimum_kg')::numeric then return to_jsonb(item); end if;
  if item.updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'Item alterado por outro usuário. Recarregue.'; end if;
  insert into public.stock_items(id,farm_id,name,category,minimum_kg) values(ident,f,btrim(p_payload->>'name'),p_payload->>'category',(p_payload->>'minimum_kg')::numeric)
   on conflict(id) do update set name=excluded.name,category=excluded.category,minimum_kg=excluded.minimum_kg,updated_at=clock_timestamp() returning to_jsonb(stock_items.*) into result;
  return result;
 elsif p_action='move' then
  ident:=(p_payload->>'id')::uuid;
  select to_jsonb(m) into result from public.stock_movements m where id=ident;
  if found then
   if result->>'farm_id'<>f::text or (select request_payload from public.stock_movements where id=ident) is distinct from p_payload then raise exception 'Identificador de movimentação já utilizado.'; end if; return result;
  end if;
  if p_payload->>'kind' not in ('entrada','saida','perda') or p_payload->>'kind' is null then raise exception 'Tipo de movimentação inválido.'; end if;
  d:=(p_payload->>'movement_date')::date;
  if d is null or d>public.app_today() then raise exception 'Informe uma data de movimentação até hoje.'; end if;
  perform app_private.stock_post(ident,f,(p_payload->>'item_id')::uuid,p_payload->>'kind',(p_payload->>'quantity_kg')::numeric,(p_payload->>'unit_cost')::numeric,d,p_payload->>'notes',null,p_payload);
  return '{}'::jsonb;
 elsif p_action in ('link','unlink') then
  if not exists(select 1 from public.diets where id=(p_payload->>'diet_id')::uuid and farm_id=f) then raise exception 'Dieta indisponível.'; end if;
  if p_action='link' and not exists(select 1 from public.diet_items where diet_id=(p_payload->>'diet_id')::uuid and farm_id=f and ingredient=p_payload->>'ingredient') then raise exception 'Ingrediente da dieta indisponível.'; end if;
  if p_action='unlink' then delete from public.stock_feed_links where farm_id=f and diet_id=(p_payload->>'diet_id')::uuid and ingredient=p_payload->>'ingredient';
  else
   insert into public.stock_feed_links(farm_id,diet_id,ingredient,item_id) values(f,(p_payload->>'diet_id')::uuid,p_payload->>'ingredient',(p_payload->>'item_id')::uuid)
    on conflict(farm_id,diet_id,ingredient) do update set item_id=excluded.item_id;
  end if;
  return '{}'::jsonb;
 end if;
 raise exception 'Operação financeira desconhecida.';
end $$;
revoke all on function public.app_finance_workspace(text,jsonb) from public,anon;
grant execute on function public.app_finance_workspace(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
