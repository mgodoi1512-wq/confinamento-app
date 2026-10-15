-- Exclusão por gestor, com isolamento por fazenda.
begin;
grant delete on public.adaptation_plans to app_farm_executor;
create or replace function app_private.app_delete_adaptation(p_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare fid uuid:=public.current_farm_id(); saved public.adaptation_plans%rowtype;
begin
  if fid is null or not public.is_gestor() then raise exception 'Somente gestores ativos podem excluir planos de adaptação.'; end if;
  select * into saved from public.adaptation_plans where id=p_id and farm_id=fid for update;
  if not found then raise exception 'Plano não encontrado na sua fazenda. Atualize os dados.'; end if;
  if saved.updated_at is distinct from p_expected_updated_at then raise exception 'Este plano foi alterado por outro usuário. Atualize os planos antes de excluir.'; end if;
  delete from public.adaptation_plans where id=saved.id and farm_id=fid;
  return jsonb_build_object('id',saved.id);
end $$;
grant create on schema app_private to app_farm_executor;
alter function app_private.app_delete_adaptation(uuid,timestamptz) owner to app_farm_executor;
revoke create on schema app_private from app_farm_executor;
revoke all on function app_private.app_delete_adaptation(uuid,timestamptz) from public,anon,authenticated;
create or replace function public.app_delete_adaptation(p_id uuid,p_expected_updated_at timestamptz)
returns jsonb language sql security definer set search_path='' as $$
  select app_private.app_delete_adaptation(p_id,p_expected_updated_at);
$$;
revoke all on function public.app_delete_adaptation(uuid,timestamptz) from public,anon;
grant execute on function public.app_delete_adaptation(uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
select true as acoes_adaptacao_instaladas;
