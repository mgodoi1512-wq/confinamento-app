-- Arquivo ausente na entrega recebida, reconstruído a partir do contrato da
-- tela administrativa e dos testes existentes. Não reaplicar em produção sem
-- conferir antes o histórico e as funções já instaladas no seu Supabase.
begin;
do $$ begin
  if to_regprocedure('app_private.app_tenant_before_contact_phone(text,jsonb)') is null then
    alter function public.app_tenant(text,jsonb) rename to app_tenant_before_contact_phone;
    alter function public.app_tenant_before_contact_phone(text,jsonb) set schema app_private;
  end if;
end $$;
revoke all on function app_private.app_tenant_before_contact_phone(text,jsonb) from public,anon,authenticated;

create or replace function public.app_tenant(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if p_action='list_requests' and not public.is_platform_admin() then
    raise exception 'Acesso exclusivo do administrador.';
  end if;
  result:=app_private.app_tenant_before_contact_phone(p_action,p_payload);
  if p_action='list_requests' then
    select coalesce(jsonb_agg(row.value||jsonb_build_object('phone',nullif(btrim(u.raw_user_meta_data->>'phone'),'')) order by row.ordinality),'[]'::jsonb)
    into result
    from jsonb_array_elements(result) with ordinality as row(value,ordinality)
    left join auth.users u on u.id::text=row.value->>'userId';
  end if;
  return result;
end;
$$;
revoke all on function public.app_tenant(text,jsonb) from public,anon;
grant execute on function public.app_tenant(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
