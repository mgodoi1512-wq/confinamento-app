begin;
create table if not exists public.finance_workspace_settings (
 farm_id uuid primary key references public.farms(id), opening_date date not null default public.app_today(),
 opening_balance numeric(16,2) not null default 0, carcass_yield numeric(5,2) not null default 50 check(carcass_yield>0 and carcass_yield<=100),
 arroba_price numeric(12,2) check(arroba_price>=0), updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.cash_entries (
 id uuid primary key, farm_id uuid not null references public.farms(id), direction text not null check(direction in ('entrada','saida')),
 description text not null check(length(btrim(description)) between 1 and 200), category text not null check(length(btrim(category)) between 1 and 100),
 amount numeric(16,2) not null check(amount>0), due_date date not null, settled_on date, lot_id uuid,
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default clock_timestamp(),
 foreign key(lot_id,farm_id) references public.lots(id,farm_id)
);
create index if not exists cash_entries_farm_dates on public.cash_entries(farm_id,due_date,settled_on);
create table if not exists public.stock_items (
 id uuid primary key, farm_id uuid not null references public.farms(id), name text not null check(length(btrim(name)) between 1 and 150),
 category text not null check(category in ('racao','volumoso','ingrediente')), minimum_kg numeric(16,3) not null default 0 check(minimum_kg>=0),
 quantity_kg numeric(16,3) not null default 0 check(quantity_kg>=0), stock_value numeric(18,4) not null default 0 check(stock_value>=0),
 updated_at timestamptz not null default clock_timestamp(), unique(id,farm_id)
);
create unique index if not exists stock_items_name_farm on public.stock_items(farm_id,lower(btrim(name)));
create table if not exists public.stock_movements (
 id uuid primary key, farm_id uuid not null references public.farms(id), item_id uuid not null,
 kind text not null check(kind in ('entrada','saida','perda','trato','estorno')), quantity_kg numeric(16,3) not null check(quantity_kg>0),
 unit_cost numeric(16,6) not null check(unit_cost>=0), total_value numeric(18,4) not null, movement_date date not null, notes text not null default '', source_feed_id uuid,
 request_payload jsonb, created_by uuid, created_at timestamptz not null default clock_timestamp(),
 foreign key(item_id,farm_id) references public.stock_items(id,farm_id)
);
create index if not exists stock_movements_farm_date on public.stock_movements(farm_id,movement_date,created_at);
create table if not exists public.stock_feed_links (
 farm_id uuid not null references public.farms(id), diet_id uuid not null, ingredient text not null, item_id uuid not null,
 primary key(farm_id,diet_id,ingredient), foreign key(diet_id,farm_id) references public.diets(id,farm_id) on delete cascade,
 foreign key(item_id,farm_id) references public.stock_items(id,farm_id)
);
create table if not exists app_private.stock_feed_deductions (
 feed_id uuid not null, farm_id uuid not null, item_id uuid not null, quantity_kg numeric not null, unit_cost numeric not null, total_value numeric not null,
 primary key(feed_id,item_id), foreign key(item_id,farm_id) references public.stock_items(id,farm_id)
);
revoke all on app_private.stock_feed_deductions from public,anon,authenticated,app_farm_executor;
do $$ declare t text; begin
 foreach t in array array['finance_workspace_settings','cash_entries','stock_items','stock_movements','stock_feed_links'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('drop policy if exists finance_manager_read on public.%I',t);
  execute format('create policy finance_manager_read on public.%I for select to authenticated using(farm_id=(select public.current_farm_id()) and (select public.is_gestor()))',t);
 end loop;
end $$;
-- Somente esta função interna altera os saldos. Saídas usam o custo médio atual.
create or replace function app_private.stock_post(p_id uuid,p_farm uuid,p_item uuid,p_kind text,p_qty numeric,p_cost numeric,p_date date,p_note text,p_feed uuid default null,p_request jsonb default null)
returns void language plpgsql security definer set search_path='' as $$
declare s public.stock_items; q numeric:=round(p_qty,3); c numeric; value numeric; begin
 select * into s from public.stock_items where id=p_item and farm_id=p_farm for update;
 if not found then raise exception 'Item de estoque indisponível.'; end if;
 if q is null or q<=0 or q>9999999999 then raise exception 'Informe uma quantidade positiva em kg.'; end if;
 if p_kind in ('entrada','estorno') then
  c:=p_cost; if c is null or c<0 or c>99999999 then raise exception 'Informe o custo por kg, inclusive zero quando não houver custo.'; end if;
  value:=s.stock_value+q*c;
  update public.stock_items set quantity_kg=quantity_kg+q,stock_value=round(value,4),updated_at=clock_timestamp() where id=p_item;
 else
  if q>s.quantity_kg then raise exception 'Estoque insuficiente de %: disponível % kg, necessário % kg. Registre a entrada ou revise o vínculo automático.',s.name,s.quantity_kg,q; end if;
  c:=case when s.quantity_kg>0 then s.stock_value/s.quantity_kg else 0 end;
  value:=case when q=s.quantity_kg then 0 else greatest(0,s.stock_value-q*c) end;
  update public.stock_items set quantity_kg=quantity_kg-q,stock_value=round(value,4),updated_at=clock_timestamp() where id=p_item;
 end if;
 insert into public.stock_movements(id,farm_id,item_id,kind,quantity_kg,unit_cost,movement_date,notes,source_feed_id,request_payload,created_by,total_value)
 values(p_id,p_farm,p_item,p_kind,q,round(c,6),p_date,coalesce(p_note,''),p_feed,p_request,auth.uid(),abs(round(value,4)-s.stock_value));
end $$;
revoke all on function app_private.stock_post(uuid,uuid,uuid,text,numeric,numeric,date,text,uuid,jsonb) from public,anon,authenticated;

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
 if p_action='settings' then
  select * into settings from public.finance_workspace_settings where farm_id=f for update;
  if settings.updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'Configurações alteradas por outro usuário. Recarregue.'; end if;
  if (p_payload->>'opening_date')::date is null or (p_payload->>'opening_date')::date>public.app_today() then raise exception 'Informe uma data inicial até hoje.'; end if;
  if (p_payload->>'opening_balance')::numeric in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'Informe um saldo finito.'; end if;
  if (p_payload->>'opening_balance')::numeric is null or (p_payload->>'carcass_yield')::numeric is null then raise exception 'Informe saldo e rendimento.'; end if;
  insert into public.finance_workspace_settings(farm_id,opening_date,opening_balance,carcass_yield,arroba_price)
   values(f,(p_payload->>'opening_date')::date,(p_payload->>'opening_balance')::numeric,(p_payload->>'carcass_yield')::numeric,nullif(p_payload->>'arroba_price','')::numeric)
   on conflict(farm_id) do update set opening_date=excluded.opening_date,opening_balance=excluded.opening_balance,carcass_yield=excluded.carcass_yield,arroba_price=excluded.arroba_price,updated_at=clock_timestamp();
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

create or replace function app_private.stock_feed_sync() returns trigger language plpgsql security definer set search_path='' as $$
declare f uuid; ident uuid; row record; begin
 if TG_OP='UPDATE' and new.ingredient_quantities is not distinct from old.ingredient_quantities and new.diet_id is not distinct from old.diet_id and new.date is not distinct from old.date then return new; end if;
 if TG_OP='DELETE' then f:=old.farm_id;ident:=old.id;else f:=new.farm_id;ident:=new.id;end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 for row in select * from app_private.stock_feed_deductions where feed_id=ident order by item_id loop
  perform app_private.stock_post(gen_random_uuid(),f,row.item_id,'estorno',row.quantity_kg,row.total_value/row.quantity_kg,public.app_today(),'Estorno de trato corrigido ou excluído',ident);
 end loop;
 delete from app_private.stock_feed_deductions where feed_id=ident;
 if TG_OP<>'DELETE' and jsonb_typeof(new.ingredient_quantities)='array' then
  for row in select l.item_id,round(sum((v->>'totalKg')::numeric),3) qty from jsonb_array_elements(new.ingredient_quantities) v
   join public.stock_feed_links l on l.farm_id=f and l.diet_id=new.diet_id and l.ingredient=v->>'name' group by l.item_id order by l.item_id loop
   if row.qty>0 then
    perform app_private.stock_post(gen_random_uuid(),f,row.item_id,'trato',row.qty,null,new.date,'Baixa automática do trato',ident);
    insert into app_private.stock_feed_deductions(feed_id,farm_id,item_id,quantity_kg,unit_cost,total_value)
     select ident,f,row.item_id,row.qty,m.unit_cost,m.total_value from public.stock_movements m where m.source_feed_id=ident and m.item_id=row.item_id and m.kind='trato' order by m.created_at desc limit 1;
   end if;
  end loop;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
revoke all on function app_private.stock_feed_sync() from public,anon,authenticated;
drop trigger if exists stock_feed_sync on public.feed_logs;
create trigger stock_feed_sync after insert or update or delete on public.feed_logs for each row execute function app_private.stock_feed_sync();
notify pgrst,'reload schema';
commit;
