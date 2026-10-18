begin;
-- Acrescenta somente dados de apresentação ao resumo autenticado já existente.
do $$ begin
 if to_regprocedure('app_private.app_my_production_plan_before_presentation()') is null then
   alter function public.app_my_production_plan() rename to app_my_production_plan_before_presentation;
   alter function public.app_my_production_plan_before_presentation() set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_my_production_plan_before_presentation() from public,anon,authenticated,service_role;
create or replace function public.app_my_production_plan() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; f uuid; c public.farm_billing_controls; farm_name text;
begin
 result:=app_private.app_my_production_plan_before_presentation();
 -- O resumo anterior valida auth.uid() e a fazenda do próprio usuário.
 f:=public.app_billing_farm_id();
 select name into farm_name from public.farms where id=f;
 select * into c from public.farm_billing_controls where farm_id=f;
 return result||jsonb_build_object('farmName',farm_name,'courtesy',jsonb_build_object(
   'enabled',coalesce(c.courtesy_enabled,false),
   'active',coalesce(c.courtesy_enabled and (c.courtesy_expires_on is null or c.courtesy_expires_on>=public.app_today()),false),
   'expiresOn',c.courtesy_expires_on));
end $$;
revoke all on function public.app_my_production_plan() from public,anon;
grant execute on function public.app_my_production_plan() to authenticated;
notify pgrst,'reload schema';
commit;
