begin;
-- O brinco identifica um animal dentro de seu lote; SISBOV mantém a regra anterior.
drop index if exists public.animals_farm_tag_unique;
create unique index if not exists animals_farm_lot_tag_unique
 on public.animals(farm_id,coalesce(lot_id,'00000000-0000-0000-0000-000000000000'::uuid),ear_tag);
do $$ begin
 if to_regprocedure('app_private.app_mutate_before_lot_tags(text,jsonb,uuid)') is null then
   alter function public.app_mutate(text,jsonb,uuid) rename to app_mutate_before_lot_tags;
   alter function public.app_mutate_before_lot_tags(text,jsonb,uuid) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_mutate_before_lot_tags(text,jsonb,uuid) from public,anon,authenticated,service_role;
create or replace function public.app_mutate(p_operation text,p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; target_lot uuid; animal_id uuid; tags text[]; confirmed jsonb; clean jsonb; clashes jsonb; old public.animals;
begin
 if p_operation not in ('create_lot','save_animal') or p_operation is null then
   return app_private.app_mutate_before_lot_tags(p_operation,p_payload,p_request_id);
 end if;
 f:=public.current_farm_id();
 if auth.uid() is null or f is null then raise exception 'Acesso à fazenda não autorizado.'; end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Requisição inválida.'; end if;
 -- Mesma ordem de bloqueio da mutação anterior, incluindo a proteção de replay.
 perform pg_advisory_xact_lock(726102122000::bigint);
 confirmed:=coalesce(p_payload->'confirmedDuplicateEarTags','[]'::jsonb);
 if jsonb_typeof(confirmed)<>'array' then raise exception 'Confirmação de brincos inválida.'; end if;
 clean:=p_payload-'confirmedDuplicateEarTags';
 if exists(select 1 from public.app_requests where request_id=p_request_id) then
   return app_private.app_mutate_before_lot_tags(p_operation,clean,p_request_id);
 end if;
 if p_operation='create_lot' then
   if jsonb_typeof(coalesce(clean->'animals','[]'::jsonb))<>'array' then raise exception 'Animais inválidos.'; end if;
   select coalesce(array_agg(btrim(v->>'ear_tag')),'{}'::text[]) into tags from jsonb_array_elements(coalesce(clean->'animals','[]'::jsonb)) v;
   if exists(select 1 from unnest(tags) tag group by tag having count(*)>1) then raise exception 'Não é permitido repetir o mesmo brinco dentro do lote.'; end if;
 else
   animal_id:=nullif(clean->>'id','')::uuid;
   target_lot:=nullif(clean->>'lot_id','')::uuid;
   tags:=array[btrim(clean->>'ear_tag')];
   if animal_id is not null then
     select * into old from public.animals where id=animal_id and farm_id=f;
     if not found then raise exception 'Animal indisponível.'; end if;
     -- Edição de peso/notas, sem mudar brinco nem lote, não exige nova confirmação.
     if old.ear_tag=tags[1] and old.lot_id is not distinct from target_lot then
       return app_private.app_mutate_before_lot_tags(p_operation,clean,p_request_id);
     end if;
   end if;
   if target_lot is not null and not exists(select 1 from public.lots where id=target_lot and farm_id=f) then raise exception 'Lote indisponível.'; end if;
   if exists(select 1 from public.animals where farm_id=f and lot_id is not distinct from target_lot
     and ear_tag=any(tags) and (animal_id is null or id<>animal_id)) then
     raise exception 'Não é permitido repetir o mesmo brinco dentro do lote.';
   end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('earTag',d.ear_tag,'lotCode',d.lot_code) order by d.ear_tag,d.lot_code),'[]'::jsonb) into clashes
  from (select distinct a.ear_tag,coalesce(l.code,'Sem lote') lot_code from public.animals a left join public.lots l on l.id=a.lot_id and l.farm_id=f
   where a.farm_id=f and a.ear_tag=any(tags) and (animal_id is null or a.id<>animal_id)
    and (p_operation='create_lot' or a.lot_id is distinct from target_lot)
    and not (confirmed @> jsonb_build_array(a.ear_tag))) d;
 if jsonb_array_length(clashes)>0 then raise exception 'BRINCOS_OUTROS_LOTES:%',clashes::text; end if;
 return app_private.app_mutate_before_lot_tags(p_operation,clean,p_request_id);
end $$;
revoke all on function public.app_mutate(text,jsonb,uuid) from public,anon;
grant execute on function public.app_mutate(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
