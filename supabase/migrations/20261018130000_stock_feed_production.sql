begin;
-- A receita identifica a composição; o lote de produção registra cada mistura.
create table if not exists public.stock_feed_recipes (
 id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms(id),
 item_id uuid not null, signature text not null, composition jsonb not null,
 created_at timestamptz not null default clock_timestamp(), unique(farm_id,signature), unique(item_id),
 foreign key(item_id,farm_id) references public.stock_items(id,farm_id)
);
create table if not exists public.stock_feed_productions (
 id uuid primary key, farm_id uuid not null references public.farms(id), recipe_id uuid not null references public.stock_feed_recipes(id),
 quantity_kg numeric(16,3) not null check(quantity_kg>0), total_cost numeric(18,4) not null check(total_cost>=0),
 production_date date not null, composition jsonb not null, notes text not null default '', request_payload jsonb not null,
 created_by uuid not null, created_at timestamptz not null default clock_timestamp()
);
alter table public.stock_movements add column if not exists production_id uuid references public.stock_feed_productions(id);
create index if not exists stock_movements_production on public.stock_movements(production_id) where production_id is not null;
do $$ declare t text; begin
 foreach t in array array['stock_feed_recipes','stock_feed_productions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('drop policy if exists production_manager_read on public.%I',t);
  execute format('create policy production_manager_read on public.%I for select to authenticated using(farm_id=(select public.current_farm_id()) and (select public.is_gestor()))',t);
 end loop;
end $$;
create or replace function public.app_stock_production(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 f uuid:=public.current_farm_id(); ident uuid; qty numeric; d date; note text; line jsonb; lines jsonb; signature_value text;
 recipe public.stock_feed_recipes; previous public.stock_feed_productions; ingredient public.stock_items;
 total numeric:=0; pct numeric:=0; need numeric; composition_value jsonb; base_name text; product_name text; suffix integer:=1;
 target uuid; mid uuid; allocated jsonb:='[]'::jsonb; result jsonb;
begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem produzir ração.'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('name',s.name) order by s.name,r.id) from public.stock_feed_recipes r join public.stock_items s on s.id=r.item_id and s.farm_id=r.farm_id where r.farm_id=f),'[]'::jsonb);
 end if;
 if p_action is distinct from 'produce' then raise exception 'Operação desconhecida.'; end if;
 ident:=(p_payload->>'id')::uuid;
 if ident is null then raise exception 'Identificador da produção inválido.'; end if;
 -- Mesma trava do estoque manual e das baixas de trato: impede saldo duplo.
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 select * into previous from public.stock_feed_productions where id=ident;
 if found then
  if previous.farm_id<>f or previous.request_payload is distinct from p_payload then raise exception 'Identificador de produção já utilizado. Reabra o formulário para outra produção.';end if;
  return to_jsonb(previous);
 end if;
 if jsonb_typeof(p_payload->'quantity_kg') is distinct from 'number' then raise exception 'Informe a quantidade numérica em kg.';end if;
 qty:=(p_payload->>'quantity_kg')::numeric;
 if qty not between .001 and 9999999.999 or qty<>round(qty,3) then raise exception 'Informe uma quantidade positiva em kg, com até três casas decimais.';end if;
 d:=(p_payload->>'production_date')::date;
 if d is null or to_char(d,'YYYY-MM-DD')<>p_payload->>'production_date' or d>public.app_today() then raise exception 'Informe uma data de produção válida, até hoje.';end if;
 note:=coalesce(p_payload->>'notes','');if length(note)>2000 then raise exception 'As observações devem ter até 2.000 caracteres.';end if;
 lines:=p_payload->'composition';
 if jsonb_typeof(lines) is distinct from 'array' then raise exception 'Informe a composição da ração.';end if;
 if jsonb_array_length(lines) not between 3 and 10 then raise exception 'Informe energia, proteína, núcleo e até sete ingredientes adicionais.';end if;
 for line in select value from jsonb_array_elements(lines) loop
  if jsonb_typeof(line) is distinct from 'object' or jsonb_typeof(line->'percent') is distinct from 'number' or line->>'role' is null or line->>'role' not in ('energia','proteina','nucleo','outros') then raise exception 'Componente da ração inválido.';end if;
  pct:=(line->>'percent')::numeric;
  if pct not between .001 and 100 or pct<>round(pct,3) or nullif(line->>'item_id','')::uuid is null then raise exception 'Confira ingrediente e percentual positivo com até três casas decimais.';end if;
 end loop;
 if (select sum((v->>'percent')::numeric) from jsonb_array_elements(lines) v)<>100 then raise exception 'Os percentuais devem somar exatamente 100%%.';end if;
 if (select count(distinct (v->>'item_id')::uuid) from jsonb_array_elements(lines) v)<>jsonb_array_length(lines) then raise exception 'Não repita o mesmo ingrediente na composição.';end if;
 if exists(select 1 from unnest(array['energia','proteina','nucleo']) required(role) where (select count(*) from jsonb_array_elements(lines) v where v->>'role'=required.role)<>1) then raise exception 'Informe uma fonte de energia, uma de proteína e um núcleo.';end if;
 -- Ordem estável: energia, proteína, núcleo e adicionais por identificador.
 select jsonb_agg(jsonb_build_object('item_id',(v->>'item_id')::uuid,'role',v->>'role','percent',trim_scale((v->>'percent')::numeric)) order by case v->>'role' when 'energia' then 1 when 'proteina' then 2 when 'nucleo' then 3 else 4 end,(v->>'item_id')::uuid)
 into composition_value from jsonb_array_elements(lines) v;
 signature_value:=md5(composition_value::text);
 select * into recipe from public.stock_feed_recipes where farm_id=f and signature=signature_value;
 if found and recipe.composition<>composition_value then raise exception 'Não foi possível identificar esta composição. Contate o suporte.';end if;
 -- Trava os insumos em ordem determinística, antes de qualquer movimentação.
 perform 1 from public.stock_items where farm_id=f and id in(select (v->>'item_id')::uuid from jsonb_array_elements(composition_value) v) order by id for update;
 -- Rateio em gramas pelo maior resto. A soma das baixas será exatamente a produção.
 for line in
  with raw as(select v,ord,qty*1000*(v->>'percent')::numeric/100 grams from jsonb_array_elements(composition_value) with ordinality t(v,ord)),
  ranked as(select *,row_number() over(order by grams-floor(grams) desc,ord) rank,sum(floor(grams)) over() allocated_grams from raw)
  select v||jsonb_build_object('quantity_kg',(floor(grams)+case when rank<=qty*1000-allocated_grams then 1 else 0 end)/1000) from ranked order by ord
 loop
  need:=(line->>'quantity_kg')::numeric;
  select * into ingredient from public.stock_items where farm_id=f and id=(line->>'item_id')::uuid;
  if not found or ingredient.category<>'ingrediente' then raise exception 'Selecione somente ingredientes do estoque desta fazenda.';end if;
  if need<=0 then raise exception 'Quantidade muito pequena para esta composição. Aumente os kg a produzir.';end if;
  if ingredient.quantity_kg<need then raise exception 'Estoque insuficiente de %: disponível % kg, necessário % kg.',ingredient.name,ingredient.quantity_kg,need;end if;
  allocated:=allocated||jsonb_build_array(line||jsonb_build_object('name',ingredient.name));
 end loop;
 if recipe.id is null then
  select 'Ração '||string_agg(replace(trim(trailing '.' from trim(trailing '0' from to_char((v->>'percent')::numeric,'FM990.000'))),'.',','),'-' order by ord)
   into base_name from jsonb_array_elements(composition_value) with ordinality t(v,ord);
  product_name:=base_name;
  -- Percentuais iguais com insumos diferentes são produtos distintos.
  while exists(select 1 from public.stock_items where farm_id=f and lower(btrim(name))=lower(product_name)) loop
   suffix:=suffix+1;product_name:=base_name||' ('||suffix||')';
  end loop;
  target:=gen_random_uuid();
  insert into public.stock_items(id,farm_id,name,category) values(target,f,product_name,'racao');
  insert into public.stock_feed_recipes(farm_id,item_id,signature,composition) values(f,target,signature_value,composition_value) returning * into recipe;
 end if;
 select name into product_name from public.stock_items where id=recipe.item_id and farm_id=f and category='racao' for update;
 if not found then raise exception 'O produto desta composição precisa permanecer na categoria Ração pronta.';end if;
 insert into public.stock_feed_productions(id,farm_id,recipe_id,quantity_kg,total_cost,production_date,composition,notes,request_payload,created_by)
 values(ident,f,recipe.id,qty,0,d,allocated,note,p_payload,auth.uid());
 for line in select value from jsonb_array_elements(allocated) loop
  mid:=gen_random_uuid();
  perform app_private.stock_post(mid,f,(line->>'item_id')::uuid,'saida',(line->>'quantity_kg')::numeric,null,d,'Produção de '||product_name||' · '||ident::text,null,null);
  update public.stock_movements set production_id=ident where id=mid;
  select total+total_value into total from public.stock_movements where id=mid;
 end loop;
 mid:=gen_random_uuid();
 perform app_private.stock_post(mid,f,recipe.item_id,'entrada',qty,total/qty,d,'Produção de '||product_name||' · '||ident::text||case when note<>'' then ' · '||note else '' end,null,null);
 update public.stock_movements set production_id=ident where id=mid;
 update public.stock_feed_productions set total_cost=total where id=ident returning to_jsonb(stock_feed_productions.*) into result;
 return result;
end $$;
revoke all on function public.app_stock_production(text,jsonb) from public,anon;
grant execute on function public.app_stock_production(text,jsonb) to authenticated;
-- Evita transformar um produto/insumo de uma receita em outra categoria.
create or replace function app_private.stock_recipe_category_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.category is distinct from old.category and exists(select 1 from public.stock_feed_recipes r where r.farm_id=old.farm_id and (r.item_id=old.id or exists(select 1 from jsonb_array_elements(r.composition) v where (v->>'item_id')::uuid=old.id))) then
  raise exception 'Este item participa de uma composição de ração; sua categoria não pode ser alterada.';
 end if;
 return new;
end $$;
revoke all on function app_private.stock_recipe_category_guard() from public,anon,authenticated;
drop trigger if exists stock_recipe_category_guard on public.stock_items;
create trigger stock_recipe_category_guard before update of category on public.stock_items for each row execute function app_private.stock_recipe_category_guard();
notify pgrst,'reload schema';
commit;
