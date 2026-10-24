begin;
do $$ begin
 if to_regprocedure('app_private.app_mutate_before_herd_count(text,jsonb,uuid)') is null then
  alter function public.app_mutate(text,jsonb,uuid) rename to app_mutate_before_herd_count;
  alter function public.app_mutate_before_herd_count(text,jsonb,uuid) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_mutate_before_herd_count(text,jsonb,uuid) from public,anon,authenticated;
create or replace function public.app_mutate(p_operation text,p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; a public.animals; l public.lots; result jsonb;
begin
 if p_operation is null or p_operation not in ('create_lot','delete_animal') then
  return app_private.app_mutate_before_herd_count(p_operation,p_payload,p_request_id);
 end if;
 f:=public.current_farm_id();
 if auth.uid() is null or f is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem corrigir o rebanho.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados inválidos.';end if;
 perform pg_advisory_xact_lock(726102122000::bigint);
 perform pg_advisory_xact_lock(hashtextextended(f::text,0));
 -- A cadeia anterior valida ator, fazenda, operação e payload em reenvios.
 if exists(select 1 from public.app_requests where request_id=p_request_id) then
  return app_private.app_mutate_before_herd_count(p_operation,p_payload,p_request_id);
 end if;
 if p_operation='create_lot' then
  if jsonb_typeof(p_payload->'animals') is distinct from 'array' then raise exception 'Cadastre um animal para cada cabeça do lote.';end if;
  if jsonb_array_length(p_payload->'animals')=0 or jsonb_array_length(p_payload->'animals') is distinct from (p_payload->'lot'->>'head_count')::integer then raise exception 'Cadastre um animal para cada cabeça do lote.';end if;
  return app_private.app_mutate_before_herd_count(p_operation,p_payload,p_request_id);
 end if;
 select * into a from public.animals where id=(p_payload->>'id')::uuid and farm_id=f for update;
 if not found or a.status not in ('ativo','tratamento') then raise exception 'Animal indisponível.';end if;
 if a.lot_id is not null then
  select * into l from public.lots where id=a.lot_id and farm_id=f for update;
  if not found or l.status<>'ativo' or l.head_count<1 or l.initial_head_count<1 then raise exception 'Saldo do lote inconsistente. Confira o lote antes de excluir.';end if;
 end if;
 -- Mantém as restrições de histórico e a exclusão autorizada na função original.
 result:=app_private.app_mutate_before_herd_count(p_operation,p_payload,p_request_id);
 if a.lot_id is not null then
  update public.lots set head_count=head_count-1, initial_head_count=initial_head_count-1,
   status=case when head_count=1 then 'encerrado' else status end
  where id=a.lot_id and farm_id=f;
 end if;
 return result;
end;
$$;
revoke all on function public.app_mutate(text,jsonb,uuid) from public,anon;
grant execute on function public.app_mutate(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
