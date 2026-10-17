begin;
-- Ambiente de homologação separado: não participa da autorização da fazenda.
create table if not exists public.billing_sandbox_orders (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check(plan in ('monthly','annual')),
  method text not null check(method in ('PIX','CREDIT_CARD')),
  amount_cents integer not null check(amount_cents >= 100),
  status text not null default 'creating',
  archived boolean not null default false,
  customer_id text,
  payment_id text unique,
  invoice_url text,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  check((valid_from is null) = (valid_until is null))
);
create index if not exists billing_sandbox_orders_farm on public.billing_sandbox_orders(farm_id,created_at desc);
alter table public.billing_sandbox_orders enable row level security;
revoke all on public.billing_sandbox_orders from public,anon,authenticated;

create or replace function public.app_my_plan() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid; own boolean; result jsonb;
begin
  f := public.current_farm_id();
  if auth.uid() is null or f is null then raise exception 'Acesso não autorizado.'; end if;
  select account_owner_id=auth.uid() into own from public.farms where id=f;
  select jsonb_build_object(
    'environment','sandbox','mode',s.mode,'monthlyCents',s.monthly_cents,'annualCents',s.annual_cents,
    'isOwner',own,'canTest',own and public.is_platform_admin(),
    'orders',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'archived',o.archived,'plan',o.plan,'method',o.method,'amountCents',o.amount_cents,'status',o.status,
      'invoiceUrl',o.invoice_url,'validFrom',o.valid_from,'validUntil',o.valid_until,'checkedAt',o.checked_at,
      'createdAt',o.created_at) order by o.created_at desc)
      from (select * from public.billing_sandbox_orders where farm_id=f and own order by created_at desc limit 10) o),'[]'::jsonb)
  ) into result from public.platform_billing_settings s where singleton;
  if result is null then raise exception 'Instale o controle de cobrança da etapa 1.'; end if;
  return result;
end $$;
revoke all on function public.app_my_plan() from public,anon;
grant execute on function public.app_my_plan() to authenticated;

-- Somente a Edge Function autenticada usa esta operação, com identidade validada no Auth.
create or replace function public.app_billing_sandbox_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; o public.billing_sandbox_orders; fresh boolean := false; cents integer; st text; observed timestamptz;
begin
  select x.id into f from public.farms x
  join public.farm_members m on m.farm_id=x.id and m.user_id=p_user_id and m.enabled
  join public.account_access a on a.user_id=p_user_id and a.status='approved'
  where x.account_owner_id=p_user_id
    and exists(select 1 from public.platform_admins where user_id=p_user_id);
  if f is null then raise exception 'Teste exclusivo do administrador titular de uma fazenda aprovada.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
  if p_action='prepare' then
    if p_payload->>'plan' not in ('monthly','annual') or p_payload->>'method' not in ('PIX','CREDIT_CARD')
       or p_payload->>'plan' is null or p_payload->>'method' is null then raise exception 'Plano ou pagamento inválido.'; end if;
    select * into o from public.billing_sandbox_orders where farm_id=f and not archived
      and status not in ('REFUNDED','DELETED')
      and (status not in ('CONFIRMED','RECEIVED') or valid_until is null or valid_until>public.app_today())
      order by created_at desc limit 1;
    if o.id is null then
      select case when p_payload->>'plan'='annual' then annual_cents else monthly_cents end into cents
      from public.platform_billing_settings where singleton;
      if cents is null then raise exception 'Configuração de cobrança ausente.'; end if;
      insert into public.billing_sandbox_orders(farm_id,user_id,plan,method,amount_cents)
        values(f,p_user_id,p_payload->>'plan',p_payload->>'method',cents) returning * into o;
      fresh:=true;
    end if;
  else
    select * into o from public.billing_sandbox_orders where id=(p_payload->>'id')::uuid and farm_id=f for update;
    if o.id is null then raise exception 'Pagamento não encontrado nesta fazenda.'; end if;
    if p_action='customer' then
      if o.customer_id is not null and o.customer_id<>p_payload->>'customerId' then raise exception 'Cliente divergente.'; end if;
      update public.billing_sandbox_orders set customer_id=p_payload->>'customerId' where id=o.id returning * into o;
    elsif p_action='sync' then
      observed:=(p_payload->>'observedAt')::timestamptz;
      if observed is null or observed>now()+interval '1 minute' then raise exception 'Data de consulta inválida.'; end if;
      -- Uma consulta que começou antes da última aplicada não sobrescreve a situação mais recente.
      if o.checked_at is not null and observed<o.checked_at then return to_jsonb(o); end if;
      if o.customer_id is null or p_payload->>'customerId' is distinct from o.customer_id
         or p_payload->>'externalReference' is distinct from o.id::text
         or (p_payload->>'amountCents')::integer is distinct from o.amount_cents
         or p_payload->>'method' is distinct from o.method
         or (o.payment_id is not null and o.payment_id is distinct from p_payload->>'paymentId')
         or coalesce(p_payload->>'paymentId','')='' then raise exception 'Cobrança divergente.'; end if;
      st:=p_payload->>'status';
      if st not in ('PENDING','RECEIVED','CONFIRMED','OVERDUE','REFUNDED','RECEIVED_IN_CASH','REFUND_REQUESTED',
        'REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL',
        'DUNNING_REQUESTED','DUNNING_RECEIVED','AWAITING_RISK_ANALYSIS','AUTHORIZED','DELETED',
        'APPROVED_BY_RISK_ANALYSIS') or st is null then raise exception 'Situação desconhecida.'; end if;
      if p_payload->>'invoiceUrl' is null or p_payload->>'invoiceUrl' !~ '^https://(sandbox\.asaas\.com|www\.asaas\.com)/i/[A-Za-z0-9_-]+$' then raise exception 'Link de pagamento inválido.'; end if;
      update public.billing_sandbox_orders set payment_id=p_payload->>'paymentId',invoice_url=p_payload->>'invoiceUrl',
        status=st,checked_at=observed,
        valid_from=case when valid_from is null and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD')) then public.app_today() else valid_from end,
        valid_until=case when valid_until is null and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD'))
          then (public.app_today()+case when plan='annual' then interval '1 year' else interval '1 month' end)::date else valid_until end
        where id=o.id returning * into o;
    elsif p_action='archive' then
      if o.status not in ('RECEIVED','REFUNDED','DELETED') and not (o.status='CONFIRMED' and o.method='CREDIT_CARD') then
        raise exception 'Conclua ou cancele o pagamento no Sandbox antes de encerrar o teste.';
      end if;
      update public.billing_sandbox_orders set archived=true where id=o.id returning * into o;
    elsif p_action<>'get' then raise exception 'Operação inválida.';
    end if;
  end if;
  return to_jsonb(o)||jsonb_build_object('fresh',fresh);
end $$;
revoke all on function public.app_billing_sandbox_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_billing_sandbox_server(text,uuid,jsonb) to service_role;
commit;
