-- Execute integralmente como postgres. Instale antes de publicar o front-end.
begin;
create table if not exists public.farm_feed_settings (
 farm_id uuid primary key references public.farms(id), schedule jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.daily_feed_plans (
 id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms(id),
 lot_id uuid not null, pen_id uuid not null, date date not null,
 diet_id uuid not null, diet_name text not null, head_count integer not null,
 average_weight_kg numeric not null, ingredients jsonb not null, schedule jsonb not null,
 daily_kg_per_head numeric not null, daily_total_kg numeric not null,
 created_at timestamptz not null default now(),
 unique(farm_id,lot_id,date), unique(id,farm_id),
 foreign key(lot_id,farm_id) references public.lots(id,farm_id),
 foreign key(pen_id,farm_id) references public.pens(id,farm_id),
 foreign key(diet_id,farm_id) references public.diets(id,farm_id)
);
alter table public.feed_logs add column if not exists day_plan_id uuid;
alter table public.feed_logs add column if not exists planned_time text;
alter table public.feed_logs add column if not exists ingredient_quantities jsonb;
alter table public.feed_logs add column if not exists planned_request_id uuid;
alter table public.feed_logs add column if not exists planned_request_payload jsonb;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.feed_logs'::regclass and conname='feed_logs_day_plan_farm_fk') then
  alter table public.feed_logs add constraint feed_logs_day_plan_farm_fk foreign key(day_plan_id,farm_id) references public.daily_feed_plans(id,farm_id);
 end if;
end $$;
create unique index if not exists feed_planned_slot_unique on public.feed_logs(day_plan_id,shift) where day_plan_id is not null;
create unique index if not exists feed_planned_request_unique on public.feed_logs(farm_id,planned_request_id) where planned_request_id is not null;

do $$ declare t text; begin
 foreach t in array array['farm_feed_settings','daily_feed_plans'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant select,insert,update on public.%I to app_farm_executor',t);
  execute format('drop policy if exists feed_tenant_read on public.%I',t);
  execute format('create policy feed_tenant_read on public.%I for select to authenticated using(farm_id=(select public.current_farm_id()))',t);
  execute format('drop policy if exists feed_tenant_write on public.%I',t);
  execute format('create policy feed_tenant_write on public.%I for all to app_farm_executor using(farm_id=(select public.current_farm_id())) with check(farm_id=(select public.current_farm_id()))',t);
 end loop;
end $$;

create or replace function app_private.validate_feed_schedule(p_schedule jsonb)
returns void language plpgsql set search_path='' as $$
declare item jsonb; idx integer:=0; pct numeric; total numeric:=0; last_time text:=''; shift_name text;
begin
 if p_schedule is null or jsonb_typeof(p_schedule) is distinct from 'array' or jsonb_array_length(p_schedule)<>3 then raise exception 'Informe os três turnos do planejamento.'; end if;
 for item in select * from jsonb_array_elements(p_schedule) loop
  idx:=idx+1; shift_name:=(array['manha','tarde','noite'])[idx];
  if item->>'shift' is distinct from shift_name or jsonb_typeof(item->'percent') is distinct from 'number' then raise exception 'Turno ou percentual inválido.'; end if;
  pct:=(item->>'percent')::numeric;
  if not (pct between 0 and 100) then raise exception 'Percentual inválido.'; end if;
  if item->>'time' is null or not (item->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Horário inválido.'; end if;
  if pct>0 then
   if item->>'time'<=last_time then raise exception 'Os horários precisam estar em sequência.'; end if;
   last_time:=item->>'time';
  end if;
  total:=total+pct;
 end loop;
 if abs(total-100)>0.000001 then raise exception 'Os percentuais dos tratos devem somar 100%%.'; end if;
end $$;
revoke all on function app_private.validate_feed_schedule(jsonb) from public,anon,authenticated;
grant execute on function app_private.validate_feed_schedule(jsonb) to app_farm_executor;

create or replace function app_private.app_save_feed_schedule(p_schedule jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare fid uuid:=public.current_farm_id(); saved public.farm_feed_settings%rowtype;
begin
 if fid is null or not public.is_gestor() then raise exception 'Somente gestores podem alterar o padrão dos horários.'; end if;
 perform app_private.validate_feed_schedule(p_schedule);
 perform pg_advisory_xact_lock(hashtextextended(fid::text,0));
 select * into saved from public.farm_feed_settings where farm_id=fid for update;
 if found then
  if saved.schedule=p_schedule then return to_jsonb(saved); end if;
  if saved.updated_at is distinct from p_expected_updated_at then raise exception 'Horários alterados por outro usuário. Recarregue a página.'; end if;
  update public.farm_feed_settings set schedule=p_schedule,updated_at=clock_timestamp() where farm_id=fid returning * into saved;
 else
  if p_expected_updated_at is not null then raise exception 'Recarregue os horários.'; end if;
  insert into public.farm_feed_settings(farm_id,schedule) values(fid,p_schedule) returning * into saved;
 end if;
 return to_jsonb(saved);
end $$;

-- Protege também abas antigas e aplicação de leitura de cocho. Legado preservado.
create or replace function app_private.guard_feed_slot()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.farm_id::text,0));
 if new.lot_id is not null then
  if exists(select 1 from public.feed_logs where farm_id=new.farm_id and lot_id=new.lot_id and date=new.date and shift=new.shift and id<>new.id) then
   raise exception 'Este turno já possui trato para o lote nesta data. Confira o histórico antes de registrar novamente.';
  end if;
  if exists(select 1 from public.daily_feed_plans where farm_id=new.farm_id and lot_id=new.lot_id and date=new.date)
    and new.day_plan_id is null then raise exception 'Este lote possui planejamento diário. Registre pelo novo formulário de trato.'; end if;
 elsif exists(select 1 from public.daily_feed_plans where farm_id=new.farm_id and pen_id=new.pen_id and date=new.date) then
  raise exception 'Selecione o lote e use o formulário com planejamento diário.';
 end if;
 return new;
end $$;
revoke all on function app_private.guard_feed_slot() from public,anon,authenticated;
drop trigger if exists feed_slot_guard on public.feed_logs;
create trigger feed_slot_guard before insert on public.feed_logs for each row execute function app_private.guard_feed_slot();

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
 if p_payload->>'date' is distinct from public.app_today()::text then raise exception 'A data mudou. Reabra o formulário para o dia atual.'; end if;
 select * into l from public.lots where id=(p_payload->>'lotId')::uuid and farm_id=fid for update;
 if not found or l.status<>'ativo' or l.pen_id is null or l.entry_date>public.app_today() or l.head_count<=0 then raise exception 'Selecione um lote ativo da sua fazenda.'; end if;
 if not exists(select 1 from public.pens where id=l.pen_id and farm_id=fid and status<>'manutencao') then raise exception 'Curral indisponível.'; end if;
 if jsonb_typeof(p_payload->'headCount') is distinct from 'number' or (p_payload->>'headCount')::numeric<>l.head_count then raise exception 'O saldo de animais mudou. Recarregue o formulário.'; end if;
 select * into plan from public.daily_feed_plans where farm_id=fid and lot_id=l.id and date=public.app_today();
 if found then
  if plan.pen_id<>l.pen_id then raise exception 'O lote mudou de curral após o primeiro trato. Revise o planejamento com o gestor.'; end if;
  if p_payload->>'dietId' is distinct from plan.diet_id::text or schedule is distinct from plan.schedule then raise exception 'O planejamento do dia já foi fixado. Recarregue os dados.'; end if;
 else
  perform app_private.validate_feed_schedule(schedule);
  select s.schedule into default_schedule from public.farm_feed_settings s where farm_id=fid;
  default_schedule:=coalesce(default_schedule,'[{"shift":"manha","time":"08:00","percent":33.33},{"shift":"tarde","time":"14:00","percent":33.33},{"shift":"noite","time":"18:00","percent":33.34}]'::jsonb);
  if not public.is_gestor() and schedule is distinct from default_schedule then raise exception 'Use os horários definidos pelo gestor.'; end if;
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
  insert into public.daily_feed_plans(farm_id,lot_id,pen_id,date,diet_id,diet_name,head_count,average_weight_kg,ingredients,schedule,daily_kg_per_head,daily_total_kg)
   values(fid,l.id,l.pen_id,public.app_today(),d.id,d.name,l.head_count,weight,ingredients,schedule,daily,daily*l.head_count) returning * into plan;
 end if;
 select value into slot from jsonb_array_elements(plan.schedule) where value->>'shift'=p_payload->>'shift';
 if slot is null or (slot->>'percent')::numeric<=0 then raise exception 'Turno não previsto no planejamento.'; end if;
 if jsonb_typeof(p_payload->'actualKgPerHead') is distinct from 'number' then raise exception 'Quantidade fornecida inválida.'; end if;
 actual:=(p_payload->>'actualKgPerHead')::numeric;
 if not (actual between 0.001 and 99999.999) or actual*l.head_count>99999999.99 then raise exception 'Quantidade fornecida fora do limite.'; end if;
 actual:=round(actual,3); note:=nullif(btrim(p_payload->>'notes'),'');
 if length(note)>2000 then raise exception 'Observações devem ter até 2000 caracteres.'; end if;
 select jsonb_agg(jsonb_build_object('name',i->>'name','kgPerHead',(i->>'dailyKgPerHead')::numeric/plan.daily_kg_per_head*actual,
  'totalKg',(i->>'dailyKgPerHead')::numeric/plan.daily_kg_per_head*actual*l.head_count)) into actual_items from jsonb_array_elements(plan.ingredients) i;
 insert into public.feed_logs(farm_id,pen_id,lot_id,date,shift,diet_id,head_count,kg_per_head,total_kg,notes,recorded_by,owner_id,day_plan_id,planned_time,ingredient_quantities,planned_request_id,planned_request_payload)
 values(fid,plan.pen_id,plan.lot_id,plan.date,p_payload->>'shift',plan.diet_id,l.head_count,actual,round(actual*l.head_count,2),note,uid,uid,plan.id,slot->>'time',actual_items,p_request_id,p_payload)
 returning * into previous;
 return to_jsonb(previous);
end $$;

-- Tratos planejados preservam a dieta congelada mesmo se ela for inativada depois.
create or replace function app_private.require_active_feed_diet()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.day_plan_id is not null then
  if not exists(select 1 from public.daily_feed_plans p where p.id=new.day_plan_id and p.farm_id=new.farm_id and p.diet_id=new.diet_id and p.lot_id=new.lot_id and p.pen_id=new.pen_id and p.date=new.date) then raise exception 'Plano de trato inválido.'; end if;
 elsif new.diet_id is not null and not exists(select 1 from public.diets d where d.id=new.diet_id and d.farm_id=new.farm_id and d.is_active) then
  raise exception 'A dieta selecionada está inativa ou indisponível. Selecione uma dieta ativa antes de registrar o trato.';
 end if;
 return new;
end $$;

grant create on schema app_private to app_farm_executor;
alter function app_private.app_save_feed_schedule(jsonb,timestamptz) owner to app_farm_executor;
alter function app_private.app_record_planned_feed(jsonb,uuid) owner to app_farm_executor;
revoke create on schema app_private from app_farm_executor;
revoke all on function app_private.app_save_feed_schedule(jsonb,timestamptz),app_private.app_record_planned_feed(jsonb,uuid) from public,anon,authenticated;
create or replace function public.app_save_feed_schedule(p_schedule jsonb,p_expected_updated_at timestamptz default null)
returns jsonb language sql security definer set search_path='' as $$ select app_private.app_save_feed_schedule(p_schedule,p_expected_updated_at) $$;
create or replace function public.app_record_planned_feed(p_payload jsonb,p_request_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select app_private.app_record_planned_feed(p_payload,p_request_id) $$;
revoke all on function public.app_save_feed_schedule(jsonb,timestamptz),public.app_record_planned_feed(jsonb,uuid) from public,anon;
grant execute on function public.app_save_feed_schedule(jsonb,timestamptz),public.app_record_planned_feed(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regclass('public.daily_feed_plans') is not null as planejamento_trato_instalado;
