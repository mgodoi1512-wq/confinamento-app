begin;
-- Identifica lotes legados quando a fazenda informa um único sistema.
-- Nunca sobrescreve manejo já identificado nem reclassifica um local físico.
create or replace function public.app_production_settings(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_farm_id();old public.farms;modes text[];l public.lots;identified integer:=0;pending integer;begin
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem configurar os sistemas de criação.';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 modes:=app_private.validate_production_systems(p_payload->'systems',p_payload->>'default_system');
 perform pg_advisory_xact_lock(726102122000::bigint);
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));select * into old from public.farms where id=f for update;
 if old.production_systems is distinct from modes or old.default_production_system is distinct from p_payload->>'default_system' then
  if old.systems_updated_at is distinct from nullif(p_payload->>'expected','')::timestamptz then raise exception 'Os sistemas foram alterados por outro gestor. Recarregue.';end if;
  if exists(select 1 from public.lots where farm_id=f and status='ativo' and head_count>0 and production_system is not null and not production_system=any(modes)) then raise exception 'Há lotes ativos usando um sistema que você desmarcou. Altere o manejo desses lotes antes de remover o sistema da fazenda.';end if;
  update public.farms set production_systems=modes,default_production_system=p_payload->>'default_system',systems_updated_at=clock_timestamp() where id=f returning * into old;
 end if;
 if cardinality(modes)=1 then
  for l in select lots.* from public.lots lots join public.pens pens on pens.id=lots.pen_id and pens.farm_id=lots.farm_id
   where lots.farm_id=f and lots.status='ativo' and lots.head_count>0 and lots.production_system is null
   and ((modes[1]='confinamento' and pens.location_type='curral') or (modes[1] in ('semiconfinamento','pasto') and pens.location_type in ('piquete','pasto')))
   order by lots.id for update of lots
  loop
   update public.lots set production_system=modes[1],system_started_on=l.entry_date,system_updated_at=clock_timestamp() where id=l.id and farm_id=f;
   insert into public.lot_system_history(farm_id,lot_id,to_system,from_pen_id,to_pen_id,effective_date,created_by) values(f,l.id,modes[1],l.pen_id,l.pen_id,l.entry_date,auth.uid());
   identified:=identified+1;
  end loop;
 end if;
 select count(*) into pending from public.lots where farm_id=f and status='ativo' and head_count>0 and production_system is null;
 return to_jsonb(old)||jsonb_build_object('identified_lots',identified,'pending_lots',pending);
end $$;
revoke all on function public.app_production_settings(jsonb) from public,anon;
grant execute on function public.app_production_settings(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
