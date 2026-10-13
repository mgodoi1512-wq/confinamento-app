-- Revisão: somente editar peso individual. Exclusão exige remover a pesagem inteira.
-- Compatível com a versão anterior; bloqueia exclusões individuais no servidor.
-- Requer a migração de integridade já aplicada. Executar este arquivo inteiro.
begin;
do $$
begin
  if to_regclass('public.app_requests') is null or to_regprocedure('public.has_app_access()') is null then
    raise exception 'A atualização de integridade precisa ser aplicada antes desta migração.';
  end if;
end $$;

create or replace function public.app_correct_weight_record(
  p_record_id uuid,
  p_weight numeric,
  p_delete boolean,
  p_remove_empty boolean,
  p_expected_weight numeric,
  p_expected_count integer,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  operation text;
  payload jsonb;
  result jsonb;
  request public.app_requests%rowtype;
  record public.weight_records%rowtype;
  weighing public.weighings%rowtype;
  total integer;
  average numeric;
begin
  if uid is null or not public.has_app_access() then
    raise exception 'Acesso à fazenda não autorizado.';
  end if;
  if p_record_id is null or p_request_id is null or p_delete is null or p_remove_empty is null
    or p_expected_weight is null or p_expected_count is null or p_expected_count <= 0 then
    raise exception 'Requisição inválida. Reabra a pesagem e tente novamente.';
  end if;
  if p_delete or p_remove_empty then
    raise exception 'Exclusão individual desabilitada. Exclua a pesagem inteira e cadastre uma nova.';
  end if;
  if (p_weight is null or p_weight::text in ('NaN','Infinity','-Infinity')
    or round(p_weight, 2) <= 0 or p_weight > 99999.99) then
    raise exception 'Informe um peso positivo, de até 99.999,99 kg.';
  end if;
  operation := 'edit_weight_record';
  payload := jsonb_build_object('recordId',p_record_id,'weight',p_weight,'delete',p_delete,
    'removeEmpty',p_remove_empty,'expectedWeight',p_expected_weight,'expectedCount',p_expected_count);

  -- O mesmo bloqueio usado pelas demais gravações serializa pesagens e correções.
  perform pg_advisory_xact_lock(726102122000::bigint);
  if not public.has_app_access() then raise exception 'Acesso à fazenda não autorizado.'; end if;
  select * into request from public.app_requests where request_id = p_request_id;
  if found then
    if request.user_id <> uid or request.operation <> operation or request.payload <> payload then
      raise exception 'Esta requisição já foi concluída com outros dados. Reabra a pesagem.';
    end if;
    return request.result;
  end if;

  select * into record from public.weight_records where id = p_record_id for update;
  if not found then raise exception 'O registro não existe mais. Reabra a pesagem.'; end if;
  select * into weighing from public.weighings where id = record.weighing_id for update;
  if not found or weighing.kind <> 'individual' then
    raise exception 'Esta ação é permitida apenas em pesagens individuais.';
  end if;
  select count(*) into total from public.weight_records where weighing_id = weighing.id;
  if record.weight_kg is distinct from p_expected_weight or total <> p_expected_count then
    raise exception 'A pesagem mudou desde que você abriu a ação. Feche a janela e confira os dados atualizados.';
  end if;

  update public.weight_records set weight_kg = round(p_weight, 2) where id = record.id;
  select count(*), avg(weight_kg) into total, average
  from public.weight_records where weighing_id = weighing.id;
  update public.weighings set head_count_weighed = total, avg_weight_kg = average
  where id = weighing.id returning avg_weight_kg into average;

  -- Mesmo numa correção retroativa, o peso atual é o da última medição válida.
  update public.animals a set current_weight_kg = coalesce((
    select r.weight_kg
    from public.weight_records r join public.weighings w on w.id = r.weighing_id
    where r.animal_id = a.id
    order by w.date desc, w.created_at desc, w.id desc, r.id desc
    limit 1
  ), a.entry_weight_kg)
  where a.id = record.animal_id;

  result := jsonb_build_object('weighingId',weighing.id,'weighingDeleted',false,
    'headCount',total,'avgWeight',average);
  insert into public.app_requests(request_id,user_id,operation,payload,result)
  values(p_request_id,uid,operation,payload,result);
  return result;
end $$;

revoke all on function public.app_correct_weight_record(uuid,numeric,boolean,boolean,numeric,integer,uuid) from public, anon;
grant execute on function public.app_correct_weight_record(uuid,numeric,boolean,boolean,numeric,integer,uuid) to authenticated;
commit;
