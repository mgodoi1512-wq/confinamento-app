-- Execute integralmente como postgres, após 20261016020000_daily_feed_plans.sql.
begin;
create or replace function app_private.feed_period_schedule(p_schedule jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_agg(jsonb_build_object('shift',value->>'shift','percent',value->'percent') order by ordinal)
 from jsonb_array_elements(p_schedule) with ordinality as s(value,ordinal)
$$;
revoke all on function app_private.feed_period_schedule(jsonb) from public,anon,authenticated;
grant execute on function app_private.feed_period_schedule(jsonb) to app_farm_executor;
create or replace function app_private.validate_feed_schedule(p_schedule jsonb)
returns void language plpgsql set search_path='' as $$
declare item jsonb; idx integer:=0; pct numeric; total numeric:=0; shift_name text;
begin
 if p_schedule is null or jsonb_typeof(p_schedule) is distinct from 'array' or jsonb_array_length(p_schedule)<>3 then raise exception 'Informe os três turnos do planejamento.'; end if;
 for item in select * from jsonb_array_elements(p_schedule) loop
  idx:=idx+1; shift_name:=(array['manha','tarde','noite'])[idx];
  if item->>'shift' is distinct from shift_name or jsonb_typeof(item->'percent') is distinct from 'number' then raise exception 'Turno ou percentual inválido.'; end if;
  pct:=(item->>'percent')::numeric;
  if not (pct between 0 and 100) then raise exception 'Percentual inválido.'; end if;
  total:=total+pct;
 end loop;
 if abs(total-100)>0.000001 then raise exception 'Os percentuais dos tratos devem somar 100%%.'; end if;
end $$;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('app_private.app_record_planned_feed(jsonb,uuid)'::regprocedure);
 if position('schedule is distinct from plan.schedule' in definition)>0 then
  definition:=replace(definition,'schedule is distinct from plan.schedule','app_private.feed_period_schedule(schedule) is distinct from app_private.feed_period_schedule(plan.schedule)');
  definition:=replace(definition,'schedule is distinct from default_schedule','app_private.feed_period_schedule(schedule) is distinct from app_private.feed_period_schedule(default_schedule)');
  definition:=replace(definition,$old$slot->>'time',actual_items$old$,$new$null,actual_items$new$);
  execute definition;
 elsif position('app_private.feed_period_schedule(schedule)' in definition)=0 then
  raise exception 'Instale primeiro a atualização de planejamento diário de trato.';
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
select true as selecao_periodos_instalada;
