-- Publica somente os preços de catálogo, sem dados de contas ou integração.
begin;
create or replace function public.app_public_plan_prices()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('monthlyCents', s.monthly_cents, 'annualCents', s.annual_cents)
  from public.platform_billing_settings s where s.singleton = true;
$$;
revoke all on function public.app_public_plan_prices() from public;
grant execute on function public.app_public_plan_prices() to anon, authenticated;
notify pgrst, 'reload schema';
commit;
