begin;
create table if not exists public.stock_lot_purchase_defaults (
 farm_id uuid not null references public.farms(id), lot_id uuid not null,
 amount_per_head numeric(16,2) not null check(amount_per_head>=0 and amount_per_head<'Infinity'::numeric),
 updated_at timestamptz not null default clock_timestamp(),primary key(farm_id,lot_id),
 foreign key(lot_id,farm_id) references public.lots(id,farm_id) on delete cascade
);
create table if not exists public.stock_animal_purchase_values (
 farm_id uuid not null references public.farms(id), lot_id uuid not null, animal_id uuid not null references public.animals(id) on delete cascade,
 amount numeric(16,2) not null check(amount>=0 and amount<'Infinity'::numeric),updated_at timestamptz not null default clock_timestamp(),
 primary key(farm_id,lot_id,animal_id),foreign key(lot_id,farm_id) references public.lots(id,farm_id) on delete cascade
);
do $$ declare t text; begin
 foreach t in array array['stock_lot_purchase_defaults','stock_animal_purchase_values'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('drop policy if exists stock_purchase_manager_read on public.%I',t);
  execute format('create policy stock_purchase_manager_read on public.%I for select to authenticated using(farm_id=(select public.current_farm_id()) and (select public.is_gestor()))',t);
 end loop;
end $$;
create or replace function public.app_stock_animal_values(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id(); l uuid; a uuid; previous timestamptz; old_value numeric; v numeric; begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem acessar os valores dos animais.';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Dados inválidos.';end if;
 l:=(p_payload->>'lot_id')::uuid;
 if l is null or not exists(select 1 from public.lots where id=l and farm_id=f) then raise exception 'Lote indisponível.';end if;
 if p_action='get' then
  return jsonb_build_object('default',(select to_jsonb(d) from public.stock_lot_purchase_defaults d where farm_id=f and lot_id=l),
   'animals',coalesce((select jsonb_agg(to_jsonb(prices) order by prices.animal_id) from public.stock_animal_purchase_values prices where prices.farm_id=f and prices.lot_id=l),'[]'::jsonb));
 end if;
 if p_action not in ('save_default','save_animal') or p_action is null then raise exception 'Operação desconhecida.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 v:=nullif(p_payload->>'amount','')::numeric;
 if v is not null and (v<0 or v in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or v>999999999999) then raise exception 'Informe um valor de compra válido, inclusive zero quando não houver custo.';end if;
 if p_action='save_default' then
  select updated_at,amount_per_head into previous,old_value from public.stock_lot_purchase_defaults where farm_id=f and lot_id=l for update;
 else
  a:=(p_payload->>'animal_id')::uuid;
  if a is null or not exists(select 1 from public.animals where id=a and farm_id=f and lot_id=l) then raise exception 'Animal indisponível neste lote.';end if;
  select updated_at,amount into previous,old_value from public.stock_animal_purchase_values where farm_id=f and lot_id=l and animal_id=a for update;
 end if;
 if previous is distinct from nullif(p_payload->>'expected','')::timestamptz then
  if v is not null and old_value is not distinct from round(v,2) then return '{}'::jsonb;end if;
  raise exception 'Valor alterado por outro usuário. Recarregue antes de salvar.';
 end if;
 if p_action='save_default' then
  if v is null then delete from public.stock_lot_purchase_defaults where farm_id=f and lot_id=l;
  else insert into public.stock_lot_purchase_defaults(farm_id,lot_id,amount_per_head) values(f,l,v)
   on conflict(farm_id,lot_id) do update set amount_per_head=excluded.amount_per_head,updated_at=clock_timestamp();end if;
 else
  if v is null then delete from public.stock_animal_purchase_values where farm_id=f and lot_id=l and animal_id=a;
  else insert into public.stock_animal_purchase_values(farm_id,lot_id,animal_id,amount) values(f,l,a,v)
   on conflict(farm_id,lot_id,animal_id) do update set amount=excluded.amount,updated_at=clock_timestamp();end if;
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.app_stock_animal_values(text,jsonb) from public,anon;
grant execute on function public.app_stock_animal_values(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
