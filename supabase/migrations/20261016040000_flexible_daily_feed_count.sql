-- Execute como postgres após as atualizações de planejamento e períodos.
begin;
alter table public.daily_feed_plans add column if not exists meal_count integer;
-- Mantém referências e registros antigos; guarda apenas a quantidade de tratos.
update public.daily_feed_plans p set meal_count=greatest(
 (select count(*) from jsonb_array_elements(p.schedule) s where (s->>'percent')::numeric>0),
 (select count(distinct shift) from public.feed_logs f where f.farm_id=p.farm_id and f.lot_id=p.lot_id and f.date=p.date and f.total_kg>0),1)
where meal_count is null;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.daily_feed_plans'::regclass and conname='daily_feed_plans_meal_count_check') then
  alter table public.daily_feed_plans add constraint daily_feed_plans_meal_count_check check(meal_count between 1 and 3);
 end if;
end $$;
create or replace function app_private.app_record_planned_feed(p_payload jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 fid uuid:=public.current_farm_id(); uid uuid:=app_private.app_request_user_id();
 l public.lots%rowtype; plan public.daily_feed_plans%rowtype; previous public.feed_logs%rowtype;
 d public.diets%rowtype; ingredient record; ingredients jsonb:='[]'; default_schedule jsonb;
 schedule jsonb:=p_payload->'schedule'; slot jsonb; weight numeric; kg numeric; daily numeric:=0;
 ident uuid; actual numeric; actual_items jsonb; note text; ingredient_index integer:=0; expected_item jsonb;
begin
 if fid is null or uid is null then raise exception 'Acesso à fazenda indisponível.'; end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Registro inválido.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(fid::text,0));
 select * into previous from public.feed_logs where farm_id=fid and planned_request_id=p_request_id;
 if found then
  if previous.planned_request_payload is distinct from p_payload or previous.recorded_by::text<>uid::text then raise exception 'Chave de registro já utilizada.'; end if;
  return to_jsonb(previous);
 end if;
 if jsonb_typeof(p_payload->'mealCount') is distinct from 'number' or not ((p_payload->>'mealCount')::numeric between 1 and 3)
   or trunc((p_payload->>'mealCount')::numeric)<>(p_payload->>'mealCount')::numeric then raise exception 'Informe de um a três tratos no dia.'; end if;
 if p_payload->>'date' is distinct from public.app_today()::text then raise exception 'A data mudou. Reabra o formulário para o dia atual.'; end if;
 select * into l from public.lots where id=(p_payload->>'lotId')::uuid and farm_id=fid for update;
 if not found or l.status<>'ativo' or l.pen_id is null or l.entry_date>public.app_today() or l.head_count<=0 then raise exception 'Selecione um lote ativo da sua fazenda.'; end if;
 if not exists(select 1 from public.pens where id=l.pen_id and farm_id=fid and status<>'manutencao') then raise exception 'Curral indisponível.'; end if;
 if jsonb_typeof(p_payload->'headCount') is distinct from 'number' or (p_payload->>'headCount')::numeric<>l.head_count then raise exception 'O saldo de animais mudou. Recarregue o formulário.'; end if;
 select * into plan from public.daily_feed_plans where farm_id=fid and lot_id=l.id and date=public.app_today();
 if found then
  if plan.pen_id<>l.pen_id then raise exception 'O lote mudou de curral após o primeiro trato. Revise o planejamento com o gestor.'; end if;
  if p_payload->>'dietId' is distinct from plan.diet_id::text or (p_payload->>'mealCount')::integer<>plan.meal_count then raise exception 'O planejamento do dia já foi fixado. Recarregue os dados.'; end if;
 else
  perform app_private.validate_feed_schedule(schedule);
  select s.schedule into default_schedule from public.farm_feed_settings s where farm_id=fid;
  default_schedule:=coalesce(default_schedule,'[{"shift":"manha","time":"08:00","percent":33.33},{"shift":"tarde","time":"14:00","percent":33.33},{"shift":"noite","time":"18:00","percent":33.34}]'::jsonb);

  select * into d from public.diets where id=(p_payload->>'dietId')::uuid and farm_id=fid and is_active for share;
  if not found then raise exception 'Selecione uma dieta ativa da sua fazenda.'; end if;
  if exists(select 1 from public.feed_logs where farm_id=fid and lot_id=l.id and date=public.app_today() and (diet_id is distinct from d.id or head_count<>l.head_count))
    or exists(select 1 from public.feed_logs where farm_id=fid and pen_id=l.pen_id and date=public.app_today() and lot_id is null) then
   raise exception 'Há tratos antigos sem referência compatível com o plano. Revise o histórico; o planejamento pode ser iniciado no próximo dia.';
  end if;
  select avg_weight_kg into weight from public.weighings where farm_id=fid and lot_id=l.id and date between l.entry_date and public.app_today() order by date desc,created_at desc,id desc limit 1;
  weight:=coalesce(weight,l.entry_avg_weight_kg);
  if weight is null or weight<=0 then raise exception 'Informe um peso médio válido para o lote.'; end if;
  for ingredient in select * from public.diet_items di where di.farm_id=fid and di.diet_id=d.id order by di.ingredient,di.id for share loop
   kg:=case when ingredient.body_weight_pct is not null then weight*ingredient.body_weight_pct/100 else ingredient.kg_per_head_day end;
   if kg is null or kg<0 or kg='NaN'::numeric then raise exception 'Ingrediente inválido.'; end if;
   if jsonb_typeof(p_payload->'ingredients') is distinct from 'array' then raise exception 'Recarregue os ingredientes da dieta.'; end if;
   expected_item:=p_payload->'ingredients'->ingredient_index;
   if expected_item is null or expected_item->>'name' is distinct from ingredient.ingredient
     or (expected_item->>'bodyWeightPct')::numeric is distinct from ingredient.body_weight_pct
     or jsonb_typeof(expected_item->'dailyKgPerHead') is distinct from 'number'
     or abs((expected_item->>'dailyKgPerHead')::numeric-kg)>0.000001 then
     raise exception 'Os ingredientes da dieta foram alterados. Recarregue o formulário.';
   end if;
   ingredient_index:=ingredient_index+1;
   daily:=daily+kg;
   ingredients:=ingredients||jsonb_build_array(jsonb_build_object('name',ingredient.ingredient,'bodyWeightPct',ingredient.body_weight_pct,'dailyKgPerHead',kg));
  end loop;
  if jsonb_typeof(p_payload->'ingredients') is distinct from 'array' or jsonb_array_length(p_payload->'ingredients')<>ingredient_index then raise exception 'Recarregue os ingredientes da dieta.'; end if;
  if daily<=0 then raise exception 'A dieta precisa ter ingredientes com quantidades positivas.'; end if;
  if jsonb_typeof(p_payload->'referenceWeight') is distinct from 'number' or jsonb_typeof(p_payload->'headCount') is distinct from 'number'
    or jsonb_typeof(p_payload->'dailyKgPerHead') is distinct from 'number' then raise exception 'Referência do cálculo inválida.'; end if;
  if abs((p_payload->>'referenceWeight')::numeric-weight)>0.000001 or (p_payload->>'headCount')::numeric<>l.head_count
    or abs((p_payload->>'dailyKgPerHead')::numeric-daily)>0.000001 then raise exception 'Peso, animais ou dieta foram alterados. Recarregue o formulário.'; end if;
  insert into public.daily_feed_plans(farm_id,lot_id,pen_id,date,diet_id,diet_name,head_count,average_weight_kg,ingredients,schedule,daily_kg_per_head,daily_total_kg,meal_count)
   values(fid,l.id,l.pen_id,public.app_today(),d.id,d.name,l.head_count,weight,ingredients,schedule,daily,daily*l.head_count,(p_payload->>'mealCount')::integer) returning * into plan;
 end if;
 if p_payload->>'shift' is null or p_payload->>'shift' not in ('manha','tarde','noite') then raise exception 'Selecione manhã, tarde ou noite.'; end if;
 if exists(select 1 from public.feed_logs where farm_id=fid and lot_id=l.id and date=plan.date and shift=p_payload->>'shift') then
  raise exception 'Este turno já possui trato para o lote nesta data.';
 end if;
 if (select count(distinct shift) from public.feed_logs where farm_id=fid and lot_id=l.id and date=plan.date and total_kg>0)>=plan.meal_count then
  raise exception 'Todos os % tratos planejados para hoje já foram registrados.',plan.meal_count;
 end if;
 if jsonb_typeof(p_payload->'actualKgPerHead') is distinct from 'number' then raise exception 'Quantidade fornecida inválida.'; end if;
 actual:=(p_payload->>'actualKgPerHead')::numeric;
 if not (actual between 0.001 and 99999.999) or actual*l.head_count>99999999.99 then raise exception 'Quantidade fornecida fora do limite.'; end if;
 actual:=round(actual,3); note:=nullif(btrim(p_payload->>'notes'),'');
 if length(note)>2000 then raise exception 'Observações devem ter até 2000 caracteres.'; end if;
 select jsonb_agg(jsonb_build_object('name',i->>'name','kgPerHead',(i->>'dailyKgPerHead')::numeric/plan.daily_kg_per_head*actual,
  'totalKg',(i->>'dailyKgPerHead')::numeric/plan.daily_kg_per_head*actual*l.head_count)) into actual_items from jsonb_array_elements(plan.ingredients) i;
 insert into public.feed_logs(farm_id,pen_id,lot_id,date,shift,diet_id,head_count,kg_per_head,total_kg,notes,recorded_by,owner_id,day_plan_id,planned_time,ingredient_quantities,planned_request_id,planned_request_payload)
 values(fid,plan.pen_id,plan.lot_id,plan.date,p_payload->>'shift',plan.diet_id,l.head_count,actual,round(actual*l.head_count,2),note,uid,uid,plan.id,null,actual_items,p_request_id,p_payload)
 returning * into previous;
 return to_jsonb(previous);
end $$;

notify pgrst,'reload schema';
commit;
select true as registro_simplificado_instalado;
