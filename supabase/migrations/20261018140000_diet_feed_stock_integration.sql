begin;
alter table public.daily_feed_plans add column if not exists stock_mapping jsonb;
-- Catálogo operacional: não expõe valores/custos do financeiro a operadores.
create or replace function public.app_feed_stock() returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();begin
 if auth.uid() is null or f is null then raise exception 'Acesso à fazenda indisponível.';end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'quantity_kg',s.quantity_kg) order by s.name,s.id) from public.stock_items s where farm_id=f),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(to_jsonb(l)) from public.stock_feed_links l where farm_id=f),'[]'::jsonb));
end $$;
revoke all on function public.app_feed_stock() from public,anon;
grant execute on function public.app_feed_stock() to authenticated;
-- Preserva os demais contratos de app_mutate, inclusive brincos e reenvio.
do $$begin
 if to_regprocedure('app_private.app_mutate_before_stock_diets(text,jsonb,uuid)') is null then
  alter function public.app_mutate(text,jsonb,uuid) rename to app_mutate_before_stock_diets;
  alter function public.app_mutate_before_stock_diets(text,jsonb,uuid) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_mutate_before_stock_diets(text,jsonb,uuid) from public,anon,authenticated;
create or replace function public.app_mutate(p_operation text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid; r jsonb; ident uuid; part jsonb; target uuid; begin
 if p_operation is distinct from 'save_diet' then return app_private.app_mutate_before_stock_diets(p_operation,p_payload,p_request_id);end if;
 f:=public.current_farm_id();if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem alterar dietas.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 -- A mutação legada usa a trava global; mantenha a mesma ordem de aquisição.
 perform pg_advisory_xact_lock(726102122000::bigint);perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 if exists(select 1 from public.app_requests where request_id=p_request_id) then return app_private.app_mutate_before_stock_diets(p_operation,p_payload,p_request_id);end if;
 if p_payload->'stockLinked'='true'::jsonb then
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')=0 then raise exception 'Selecione os itens do estoque para esta dieta.';end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'items') v group by btrim(v->>'ingredient') having count(*)>1) then raise exception 'Não repita o mesmo nome de componente na dieta.';end if;
  for part in select value from jsonb_array_elements(p_payload->'items') loop
   target:=nullif(part->>'stock_item_id','')::uuid;
   if target is null or not exists(select 1 from public.stock_items where id=target and farm_id=f) then raise exception 'Selecione um item do estoque desta fazenda para cada ingrediente.';end if;
  end loop;
 end if;
 r:=app_private.app_mutate_before_stock_diets(p_operation,p_payload,p_request_id);ident:=(r#>>'{}')::uuid;
 if p_payload->'stockLinked'='true'::jsonb then
  delete from public.stock_feed_links where farm_id=f and diet_id=ident;
  for part in select value from jsonb_array_elements(p_payload->'items') loop
   insert into public.stock_feed_links(farm_id,diet_id,ingredient,item_id) values(f,ident,btrim(part->>'ingredient'),(part->>'stock_item_id')::uuid);
  end loop;
 else
  delete from public.stock_feed_links l where l.farm_id=f and l.diet_id=ident and not exists(select 1 from public.diet_items d where d.farm_id=f and d.diet_id=ident and d.ingredient=l.ingredient);
 end if;
 return r;
end $$;
revoke all on function public.app_mutate(text,jsonb,uuid) from public,anon;
grant execute on function public.app_mutate(text,jsonb,uuid) to authenticated;

create or replace function app_private.stock_feed_sync() returns trigger language plpgsql security definer set search_path='' as $$
declare f uuid; ident uuid; row record; part jsonb; parts jsonb; resolved jsonb:='[]'::jsonb; mapping jsonb; target uuid; oldtarget text;
 weight numeric; daily numeric; daily_parts jsonb; q numeric; total numeric; grams numeric; amount numeric; label text; mid uuid; source public.stock_items;
begin
 if TG_OP='UPDATE' and new.ingredient_quantities is not distinct from old.ingredient_quantities and new.diet_id is not distinct from old.diet_id and new.date is not distinct from old.date and new.day_plan_id is not distinct from old.day_plan_id and new.total_kg is not distinct from old.total_kg and new.kg_per_head is not distinct from old.kg_per_head and new.head_count is not distinct from old.head_count then return new;end if;
 if TG_OP='DELETE' then f:=old.farm_id;ident:=old.id;else f:=new.farm_id;ident:=new.id;end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 -- A devolução usa os itens e custos realmente baixados, nunca o vínculo atual.
 for row in select * from app_private.stock_feed_deductions where feed_id=ident order by item_id loop
  perform app_private.stock_post(gen_random_uuid(),f,row.item_id,'estorno',row.quantity_kg,row.total_value/row.quantity_kg,public.app_today(),'Estorno de trato corrigido ou excluído',ident);
 end loop;
 delete from app_private.stock_feed_deductions where feed_id=ident;
 if TG_OP='DELETE' then return old;end if;
 if new.total_kg is null or new.total_kg<0 or new.total_kg in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'Quantidade do trato inválida.';end if;
 if new.total_kg=0 then return new;end if;
 if new.diet_id is null then raise exception 'Selecione uma dieta vinculada ao estoque antes de registrar o trato.';end if;
 if new.day_plan_id is not null then
  select p.stock_mapping into mapping from public.daily_feed_plans p where p.id=new.day_plan_id and p.farm_id=f and p.diet_id=new.diet_id for update;
  if not found then raise exception 'Planejamento do trato indisponível.';end if;
 end if;
 parts:=new.ingredient_quantities;
 -- Tratos de leitura de cocho e registros antigos também passam pela baixa.
 if parts is null or parts='null'::jsonb then
  if new.day_plan_id is not null then select p.ingredients into daily_parts from public.daily_feed_plans p where p.id=new.day_plan_id and p.farm_id=f;
  else
   select w.avg_weight_kg into weight from public.weighings w where w.farm_id=f and w.lot_id=new.lot_id and w.date<=new.date order by w.date desc,w.created_at desc,w.id desc limit 1;
   if weight is null then select l.entry_avg_weight_kg into weight from public.lots l where l.id=new.lot_id and l.farm_id=f;end if;
   if weight is null and new.lot_id is null then
    select case when count(*) filter(where coalesce(w.avg_weight_kg,l.entry_avg_weight_kg) is null or coalesce(w.avg_weight_kg,l.entry_avg_weight_kg)<=0)>0 then null else sum(coalesce(w.avg_weight_kg,l.entry_avg_weight_kg)*l.head_count)/nullif(sum(l.head_count),0) end into weight
    from public.lots l left join lateral(select avg_weight_kg from public.weighings w where w.farm_id=f and w.lot_id=l.id and w.date<=new.date order by w.date desc,w.created_at desc,w.id desc limit 1) w on true
    where l.farm_id=f and l.pen_id=new.pen_id and l.status='ativo' and l.head_count>0 and l.entry_date<=new.date;
   end if;
   if exists(select 1 from public.diet_items d where d.farm_id=f and d.diet_id=new.diet_id and d.body_weight_pct>0) and (weight is null or weight<=0) then raise exception 'Peso médio indisponível para calcular a composição do trato.';end if;
   select jsonb_agg(jsonb_build_object('name',d.ingredient,'dailyKgPerHead',case when d.body_weight_pct is not null then weight*d.body_weight_pct/100 else d.kg_per_head_day end) order by d.ingredient,d.id) into daily_parts from public.diet_items d where d.farm_id=f and d.diet_id=new.diet_id;
  end if;
  select coalesce(sum((v->>'dailyKgPerHead')::numeric),0) into daily from jsonb_array_elements(coalesce(daily_parts,'[]'::jsonb)) v;
  if daily<=0 then raise exception 'A dieta precisa ter componentes válidos para a baixa de estoque.';end if;
  select jsonb_agg(jsonb_build_object('name',v->>'name','totalKg',(v->>'dailyKgPerHead')::numeric/daily*new.total_kg)) into parts from jsonb_array_elements(daily_parts) v;
 end if;
 if jsonb_typeof(parts) is distinct from 'array' or jsonb_array_length(parts)=0 then raise exception 'Detalhamento do trato indisponível. Reabra o formulário.';end if;
 for part in select value from jsonb_array_elements(parts) loop
  if nullif(btrim(part->>'name'),'') is null or jsonb_typeof(part->'totalKg') is distinct from 'number' then raise exception 'Detalhamento do trato inválido.';end if;
  q:=(part->>'totalKg')::numeric;if q<0 or q in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then raise exception 'Quantidade de ingrediente inválida.';end if;
  if q=0 then continue;end if;
  label:=part->>'name';target:=null;
  if mapping is not null then target:=nullif(mapping->>label,'')::uuid;
  elsif TG_OP='UPDATE' then
   select v->>'stockItemId' into oldtarget from jsonb_array_elements(case when jsonb_typeof(old.ingredient_quantities)='array' then old.ingredient_quantities else '[]'::jsonb end) v where v->>'name'=label limit 1;
   target:=nullif(oldtarget,'')::uuid;
  end if;
  if target is null and mapping is null then select l.item_id into target from public.stock_feed_links l where l.farm_id=f and l.diet_id=new.diet_id and l.ingredient=label;end if;
  if target is null then raise exception 'O componente % não está vinculado ao estoque. Edite a dieta e selecione o item correspondente.',label;end if;
  if not exists(select 1 from public.stock_items where id=target and farm_id=f) then raise exception 'Item de estoque indisponível para %.',label;end if;
  resolved:=resolved||jsonb_build_array(part||jsonb_build_object('stockItemId',target));
 end loop;
 select coalesce(sum((v->>'totalKg')::numeric),0) into total from jsonb_array_elements(resolved) v;
 if total<=0 or abs(total-new.total_kg)>.011 then raise exception 'A soma dos ingredientes não corresponde ao total fornecido. Reabra o formulário.';end if;
 -- O primeiro trato fixa também os destinos de estoque do planejamento diário.
 if new.day_plan_id is not null and mapping is null then
  select jsonb_object_agg(v->>'name',v->>'stockItemId') into mapping from jsonb_array_elements(resolved) v;
  update public.daily_feed_plans set stock_mapping=mapping where id=new.day_plan_id and farm_id=f;
 end if;
 new.ingredient_quantities:=resolved;
 grams:=round(new.total_kg*1000);
 -- Agrupa componentes vinculados ao mesmo produto, evitando falso saldo suficiente.
 for row in
  with grouped as(select (v->>'stockItemId')::uuid item_id,sum((v->>'totalKg')::numeric) qty from jsonb_array_elements(resolved) v group by 1),
  raw as(select *,grams*qty/total rawgrams from grouped),
  ranked as(select *,row_number() over(order by rawgrams-floor(rawgrams) desc,item_id) rank,sum(floor(rawgrams)) over() base from raw)
  select item_id,(floor(rawgrams)+case when rank<=grams-base then 1 else 0 end)/1000 qty from ranked order by item_id
 loop
  if row.qty<=0 then continue;end if;
  mid:=gen_random_uuid();
  perform app_private.stock_post(mid,f,row.item_id,'trato',row.qty,null,new.date,'Baixa automática do trato',ident);
  insert into app_private.stock_feed_deductions(feed_id,farm_id,item_id,quantity_kg,unit_cost,total_value)
   select ident,f,row.item_id,row.qty,m.unit_cost,m.total_value from public.stock_movements m where id=mid;
 end loop;
 return new;
end $$;
revoke all on function app_private.stock_feed_sync() from public,anon,authenticated;
drop trigger if exists stock_feed_sync on public.feed_logs;
create trigger stock_feed_sync before insert or update or delete on public.feed_logs for each row execute function app_private.stock_feed_sync();
notify pgrst,'reload schema';
commit;
