begin;
-- Ambiente de homologação separado: não participa da autorização da fazenda.
create table if not exists public.billing_production_orders (
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
create index if not exists billing_production_orders_farm on public.billing_production_orders(farm_id,created_at desc);
alter table public.billing_production_orders enable row level security;
revoke all on public.billing_production_orders from public,anon,authenticated;

create or replace function public.app_my_production_plan() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid; own boolean; result jsonb;
begin
  f := public.current_farm_id();
  if auth.uid() is null or f is null then raise exception 'Acesso não autorizado.'; end if;
  select account_owner_id=auth.uid() into own from public.farms where id=f;
  select jsonb_build_object(
    'environment','production','mode',s.mode,'monthlyCents',s.monthly_cents,'annualCents',s.annual_cents,
    'isOwner',own,'canTest',own and public.is_platform_admin(),
    'orders',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'archived',o.archived,'plan',o.plan,'method',o.method,'amountCents',o.amount_cents,'status',o.status,
      'invoiceUrl',o.invoice_url,'validFrom',o.valid_from,'validUntil',o.valid_until,'checkedAt',o.checked_at,
      'createdAt',o.created_at) order by o.created_at desc)
      from (select * from public.billing_production_orders where farm_id=f and own order by created_at desc limit 10) o),'[]'::jsonb)
  ) into result from public.platform_billing_settings s where singleton;
  if result is null then raise exception 'Instale o controle de cobrança da etapa 1.'; end if;
  return result;
end $$;
revoke all on function public.app_my_production_plan() from public,anon;
grant execute on function public.app_my_production_plan() to authenticated;

-- Somente a Edge Function autenticada usa esta operação, com identidade validada no Auth.
create or replace function public.app_billing_production_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; o public.billing_production_orders; fresh boolean := false; cents integer; st text; observed timestamptz;
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
    select * into o from public.billing_production_orders where farm_id=f and not archived
      and status not in ('REFUNDED','DELETED')
      and (status not in ('CONFIRMED','RECEIVED') or valid_until is null or valid_until>public.app_today())
      order by created_at desc limit 1;
    if o.id is null then
      select case when p_payload->>'plan'='annual' then annual_cents else monthly_cents end into cents
      from public.platform_billing_settings where singleton;
      if cents is null then raise exception 'Configuração de cobrança ausente.'; end if;
      insert into public.billing_production_orders(farm_id,user_id,plan,method,amount_cents)
        values(f,p_user_id,p_payload->>'plan',p_payload->>'method',cents) returning * into o;
      fresh:=true;
    end if;
  else
    select * into o from public.billing_production_orders where id=(p_payload->>'id')::uuid and farm_id=f for update;
    if o.id is null then raise exception 'Pagamento não encontrado nesta fazenda.'; end if;
    if p_action='customer' then
      if o.customer_id is not null and o.customer_id<>p_payload->>'customerId' then raise exception 'Cliente divergente.'; end if;
      update public.billing_production_orders set customer_id=p_payload->>'customerId' where id=o.id returning * into o;
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
      if p_payload->>'invoiceUrl' is null or p_payload->>'invoiceUrl' !~ '^https://(www\.asaas\.com|asaas\.com)/i/[A-Za-z0-9_-]+$' then raise exception 'Link de pagamento inválido.'; end if;
      update public.billing_production_orders set payment_id=p_payload->>'paymentId',invoice_url=p_payload->>'invoiceUrl',
        status=st,checked_at=observed,
        valid_from=case when valid_from is null and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD')) then public.app_today() else valid_from end,
        valid_until=case when valid_until is null and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD'))
          then (public.app_today()+case when plan='annual' then interval '1 year' else interval '1 month' end)::date else valid_until end
        where id=o.id returning * into o;
    elsif p_action='archive' then
      if o.status not in ('RECEIVED','REFUNDED','DELETED') and not (o.status='CONFIRMED' and o.method='CREDIT_CARD') then
        raise exception 'Conclua ou cancele o pagamento no Sandbox antes de encerrar o teste.';
      end if;
      update public.billing_production_orders set archived=true where id=o.id returning * into o;
    elsif p_action<>'get' then raise exception 'Operação inválida.';
    end if;
  end if;
  return to_jsonb(o)||jsonb_build_object('fresh',fresh);
end $$;
revoke all on function public.app_billing_production_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_billing_production_server(text,uuid,jsonb) to service_role;

alter table public.billing_production_orders add column if not exists refunded_cents integer not null default 0 check(refunded_cents>=0);
alter table public.billing_production_orders add column if not exists last_sync_source text;
alter table public.billing_production_orders add column if not exists last_webhook_at timestamptz;
-- Somente metadados: nenhum corpo bruto, documento, cartão ou segredo é armazenado.
create table if not exists public.billing_production_webhook_events (
  event_id text primary key,
  event_type text not null,
  payment_id text not null,
  order_id uuid references public.billing_production_orders(id) on delete set null,
  state text not null check(state in ('processing','failed','processed','ignored')),
  claim_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text
);
alter table public.billing_production_webhook_events enable row level security;
revoke all on public.billing_production_webhook_events from public,anon,authenticated;
create index if not exists billing_production_webhook_order on public.billing_production_webhook_events(order_id,received_at desc);
create or replace function public.app_apply_production_verified_payment(p_order_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.billing_production_orders; observed timestamptz; st text; f uuid; refunded integer;
begin
  select farm_id into f from public.billing_production_orders where id=p_order_id;
  if f is null then raise exception 'Pagamento não encontrado.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
  select * into o from public.billing_production_orders where id=p_order_id for update;
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
      refunded:=coalesce((p_payload->>'refundedCents')::integer,o.refunded_cents);
      if refunded<0 or refunded>o.amount_cents then raise exception 'Estorno divergente.'; end if;
      st:=p_payload->>'status';
      if st not in ('PENDING','RECEIVED','CONFIRMED','OVERDUE','REFUNDED','RECEIVED_IN_CASH','REFUND_REQUESTED',
        'REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL',
        'DUNNING_REQUESTED','DUNNING_RECEIVED','AWAITING_RISK_ANALYSIS','AUTHORIZED','DELETED',
        'APPROVED_BY_RISK_ANALYSIS') or st is null then raise exception 'Situação desconhecida.'; end if;
      if p_payload->>'invoiceUrl' is null or p_payload->>'invoiceUrl' !~ '^https://(www\.asaas\.com|asaas\.com)/i/[A-Za-z0-9_-]+$' then raise exception 'Link de pagamento inválido.'; end if;
      update public.billing_production_orders set payment_id=p_payload->>'paymentId',invoice_url=p_payload->>'invoiceUrl',
        status=st,checked_at=observed,refunded_cents=refunded,last_sync_source=case when p_payload->>'source'='webhook' then 'webhook' else 'manual' end,
        last_webhook_at=case when p_payload->>'source'='webhook' then now() else last_webhook_at end,
        valid_from=case when valid_from is null and refunded=0 and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD')) then public.app_today() else valid_from end,
        valid_until=case when valid_until is null and refunded=0 and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD'))
          then (public.app_today()+case when plan='annual' then interval '1 year' else interval '1 month' end)::date else valid_until end
        where id=o.id returning * into o;

  return to_jsonb(o);
end $$;
revoke all on function public.app_apply_production_verified_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_apply_production_verified_payment(uuid,jsonb) to service_role;

create or replace function public.app_billing_production_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; o public.billing_production_orders; fresh boolean := false; cents integer; st text; observed timestamptz;
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
    select * into o from public.billing_production_orders where farm_id=f and not archived
      and status not in ('REFUNDED','DELETED')
      and (status not in ('CONFIRMED','RECEIVED') or valid_until is null or valid_until>public.app_today())
      order by created_at desc limit 1;
    if o.id is null then
      select case when p_payload->>'plan'='annual' then annual_cents else monthly_cents end into cents
      from public.platform_billing_settings where singleton;
      if cents is null then raise exception 'Configuração de cobrança ausente.'; end if;
      insert into public.billing_production_orders(farm_id,user_id,plan,method,amount_cents)
        values(f,p_user_id,p_payload->>'plan',p_payload->>'method',cents) returning * into o;
      fresh:=true;
    end if;
  else
    select * into o from public.billing_production_orders where id=(p_payload->>'id')::uuid and farm_id=f for update;
    if o.id is null then raise exception 'Pagamento não encontrado nesta fazenda.'; end if;
    if p_action='customer' then
      if o.customer_id is not null and o.customer_id<>p_payload->>'customerId' then raise exception 'Cliente divergente.'; end if;
      update public.billing_production_orders set customer_id=p_payload->>'customerId' where id=o.id returning * into o;
    elsif p_action='sync' then
      return public.app_apply_production_verified_payment(o.id,p_payload-'source');
    elsif p_action='archive' then
      if o.status not in ('RECEIVED','REFUNDED','DELETED') and not (o.status='CONFIRMED' and o.method='CREDIT_CARD') then
        raise exception 'Conclua ou cancele o pagamento no Sandbox antes de encerrar o teste.';
      end if;
      update public.billing_production_orders set archived=true where id=o.id returning * into o;
    elsif p_action<>'get' then raise exception 'Operação inválida.';
    end if;
  end if;
  return to_jsonb(o)||jsonb_build_object('fresh',fresh);
end $$;
revoke all on function public.app_billing_production_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_billing_production_server(text,uuid,jsonb) to service_role;
create or replace function public.app_my_production_plan() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid; own boolean; result jsonb;
begin
  f := public.current_farm_id();
  if auth.uid() is null or f is null then raise exception 'Acesso não autorizado.'; end if;
  select account_owner_id=auth.uid() into own from public.farms where id=f;
  select jsonb_build_object(
    'environment','production','mode',s.mode,'monthlyCents',s.monthly_cents,'annualCents',s.annual_cents,
    'isOwner',own,'canTest',own and public.is_platform_admin(),
    'orders',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'archived',o.archived,'plan',o.plan,'method',o.method,'amountCents',o.amount_cents,'status',o.status,
      'invoiceUrl',o.invoice_url,'validFrom',o.valid_from,'validUntil',o.valid_until,'checkedAt',o.checked_at,
      'createdAt',o.created_at,'refundedCents',o.refunded_cents,'lastSyncSource',o.last_sync_source,'lastWebhookAt',o.last_webhook_at) order by o.created_at desc)
      from (select * from public.billing_production_orders where farm_id=f and own order by created_at desc limit 10) o),'[]'::jsonb)
  ) into result from public.platform_billing_settings s where singleton;
  if result is null then raise exception 'Instale o controle de cobrança da etapa 1.'; end if;
  return result;
end $$;
revoke all on function public.app_my_production_plan() from public,anon;
grant execute on function public.app_my_production_plan() to authenticated;


create or replace function public.app_production_webhook(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.billing_production_webhook_events; o public.billing_production_orders; result jsonb;
  event_key text:=p_payload->>'eventId'; token uuid;
begin
  if event_key is null or length(event_key)>255 or event_key not like 'evt_%' then raise exception 'Evento inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(event_key,1703));
  select * into e from public.billing_production_webhook_events where event_id=event_key for update;
  if p_action='claim' then
    if coalesce(p_payload->>'paymentId','')='' or length(p_payload->>'paymentId')>255
       or p_payload->>'eventType' not like 'PAYMENT_%' then raise exception 'Cobrança inválida.'; end if;
    if e.event_id is not null then
      if e.payment_id is distinct from p_payload->>'paymentId' or e.event_type is distinct from p_payload->>'eventType' then raise exception 'Evento divergente.'; end if;
      if e.state in ('processed','ignored') then return jsonb_build_object('duplicate',true); end if;
      if e.lease_until>now() then return jsonb_build_object('busy',true); end if;
    end if;
    select * into o from public.billing_production_orders
      where payment_id=p_payload->>'paymentId'
         or (id::text=p_payload->>'externalReference' and (payment_id is null or payment_id=p_payload->>'paymentId'))
      order by created_at desc limit 1;
    if o.id is null then
      insert into public.billing_production_webhook_events(event_id,event_type,payment_id,state,processed_at)
      values(event_key,p_payload->>'eventType',p_payload->>'paymentId','ignored',now())
      on conflict(event_id) do update set state='ignored',processed_at=now(),lease_until=null;
      return jsonb_build_object('ignored',true);
    end if;
    token:=gen_random_uuid();
    insert into public.billing_production_webhook_events(event_id,event_type,payment_id,order_id,state,claim_token,lease_until,attempts)
      values(event_key,p_payload->>'eventType',p_payload->>'paymentId',o.id,'processing',token,now()+interval '30 seconds',1)
      on conflict(event_id) do update set order_id=excluded.order_id,state='processing',claim_token=excluded.claim_token,
        lease_until=excluded.lease_until,attempts=public.billing_production_webhook_events.attempts+1,error_code=null;
    return jsonb_build_object('claimToken',token,'order',to_jsonb(o));
  end if;
  if e.event_id is null or e.claim_token is distinct from (p_payload->>'claimToken')::uuid then raise exception 'Reserva do evento inválida.'; end if;
  if e.state='processed' then return jsonb_build_object('duplicate',true); end if;
  if e.state<>'processing' then raise exception 'Evento sem processamento ativo.'; end if;
  if p_action='fail' then
    update public.billing_production_webhook_events set state='failed',lease_until=null,error_code='VERIFY_OR_APPLY_FAILED' where event_id=event_key;
    return jsonb_build_object('retry',true);
  elsif p_action='complete' then
    if p_payload->'payment'->>'paymentId' is distinct from e.payment_id then raise exception 'Cobrança divergente.'; end if;
    result:=public.app_apply_production_verified_payment(e.order_id,(p_payload->'payment')||jsonb_build_object('source','webhook'));
    update public.billing_production_webhook_events set state='processed',processed_at=now(),lease_until=null,error_code=null where event_id=event_key;
    return jsonb_build_object('processed',true);
  end if;
  raise exception 'Operação inválida.';
end $$;
revoke all on function public.app_production_webhook(text,jsonb) from public,anon,authenticated;
grant execute on function public.app_production_webhook(text,jsonb) to service_role;

create table if not exists public.billing_production_subscriptions (
 id uuid primary key default gen_random_uuid(),
 farm_id uuid not null references public.farms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 plan text not null check(plan in ('monthly','annual')),
 method text not null check(method in ('PIX','CREDIT_CARD')),
 amount_cents integer not null check(amount_cents>=100),
 status text not null default 'creating' check(status in ('creating','ACTIVE','INACTIVE','EXPIRED','canceling','CANCELLED')),
 customer_id text,
 provider_id text unique,
 first_due_on date not null default public.app_today(),
 next_due_on date,
 created_at timestamptz not null default now(),
 checked_at timestamptz,
 cancelled_at timestamptz
);
create unique index if not exists production_one_subscription_per_farm on public.billing_production_subscriptions(farm_id) where status<>'CANCELLED';
alter table public.billing_production_subscriptions enable row level security;
revoke all on public.billing_production_subscriptions from public,anon,authenticated;
alter table public.billing_production_orders add column if not exists subscription_id uuid references public.billing_production_subscriptions(id);
alter table public.billing_production_orders add column if not exists provider_subscription_id text;
alter table public.billing_production_orders add column if not exists due_on date;
alter table public.billing_production_orders add column if not exists provider_reference text;
alter table public.billing_production_webhook_events add column if not exists subscription_id uuid references public.billing_production_subscriptions(id) on delete set null;

create or replace function public.app_production_period_end(p_due date,p_anchor date,p_plan text) returns date
language sql immutable set search_path='' as $$
 select (target+(least(extract(day from p_anchor)::int,extract(day from target+interval '1 month -1 day')::int)-1)*interval '1 day')::date
 from (select date_trunc('month',p_due+case when p_plan='annual' then interval '1 year' else interval '1 month' end) as target) x
$$;
revoke all on function public.app_production_period_end(date,date,text) from public,anon,authenticated;
grant execute on function public.app_production_period_end(date,date,text) to service_role;

create or replace function public.app_save_production_verified_subscription(p_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.billing_production_subscriptions; checked timestamptz; state text;
begin
 select * into s from public.billing_production_subscriptions where id=p_id;
 if s.id is null then raise exception 'Assinatura não encontrada.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.farm_id::text,1702));
 select * into s from public.billing_production_subscriptions where id=p_id for update;
 checked:=(p_payload->>'observedAt')::timestamptz;
 if checked is null or checked>now()+interval '1 minute' then raise exception 'Consulta inválida.'; end if;
 if s.checked_at is not null and checked<s.checked_at then return to_jsonb(s); end if;
 if s.customer_id is null or p_payload->>'customerId' is distinct from s.customer_id
   or p_payload->>'externalReference' is distinct from s.id::text
   or p_payload->>'method' is distinct from s.method
   or p_payload->>'cycle' is distinct from (case when s.plan='annual' then 'YEARLY' else 'MONTHLY' end)
   or (p_payload->>'amountCents')::int is distinct from s.amount_cents
   or coalesce(p_payload->>'providerId','')=''
   or (s.provider_id is not null and s.provider_id is distinct from p_payload->>'providerId') then raise exception 'Assinatura divergente.'; end if;
 state:=p_payload->>'status';
 if state not in ('ACTIVE','INACTIVE','EXPIRED','CANCELLED') or state is null then raise exception 'Situação da assinatura inválida.'; end if;
 -- Cancelamento concluído nunca é desfeito por resposta antiga de criação/consulta.
 if s.status='CANCELLED' and state<>'CANCELLED' then return to_jsonb(s); end if;
 if s.status='canceling' and state<>'CANCELLED' then state:='canceling'; end if;
 update public.billing_production_subscriptions set provider_id=p_payload->>'providerId',status=state,
   next_due_on=case when state='CANCELLED' then null else (p_payload->>'nextDueDate')::date end,
   checked_at=checked,cancelled_at=case when state='CANCELLED' then coalesce(cancelled_at,now()) else cancelled_at end
   where id=s.id returning * into s;
 if state='CANCELLED' then
   update public.billing_production_orders set status='DELETED',checked_at=greatest(coalesce(checked_at,checked),checked)
   where subscription_id=s.id and status in ('creating','PENDING','OVERDUE','AWAITING_RISK_ANALYSIS','AUTHORIZED');
 end if;
 return to_jsonb(s);
end $$;
revoke all on function public.app_save_production_verified_subscription(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_save_production_verified_subscription(uuid,jsonb) to service_role;

create or replace function public.app_production_subscription_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; s public.billing_production_subscriptions; fresh boolean:=false; cents int; cfg public.platform_billing_settings; acc public.account_access; first_day date; ent jsonb;
begin
 select x.id into f from public.farms x join auth.users u on u.id=x.account_owner_id where x.account_owner_id=p_user_id and u.email_confirmed_at is not null;
 if f is null then raise exception 'Somente o titular com e-mail confirmado pode gerenciar pagamentos.'; end if;
 select * into cfg from public.platform_billing_settings where singleton;
 select * into acc from public.account_access where user_id=p_user_id;
 perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
 if p_action='prepare' then
   if acc.status in ('rejected','suspended') or not exists(select 1 from public.farm_members where user_id=p_user_id and farm_id=f and enabled) then raise exception 'Cadastro indisponível para nova cobrança.'; end if;
   if acc.status<>'approved' and not (acc.status='pending' and acc.source='customer' and cfg.mode='automatic') then raise exception 'Aguarde a aprovação administrativa.'; end if;
   if not cfg.integration_ready or not (cfg.mode='automatic' or exists(select 1 from public.platform_admins where user_id=p_user_id)) then raise exception 'A cobrança em produção não foi ativada.'; end if;
   if (p_payload->>'priceVersion')::timestamptz is distinct from cfg.updated_at then raise exception 'Os valores foram atualizados. Recarregue a página e confirme novamente.'; end if;
   if (p_payload->>'productionConsent')::boolean is distinct from true then raise exception 'Confirme a contratação real.'; end if;
   ent:=public.app_production_entitlement(f);
   if ent->>'reason' in ('manual_release','courtesy') and not exists(select 1 from public.platform_admins where user_id=p_user_id) then raise exception 'Esta fazenda tem liberação sem cobrança. Consulte o administrador.'; end if;

   if coalesce(p_payload->>'plan','') not in ('monthly','annual') or coalesce(p_payload->>'method','') not in ('PIX','CREDIT_CARD') then raise exception 'Plano inválido.'; end if;
   select * into s from public.billing_production_subscriptions where farm_id=f and status<>'CANCELLED';
   if s.id is null then
     if exists(select 1 from public.billing_production_orders where farm_id=f and subscription_id is null and not archived and status not in ('REFUNDED','DELETED')) then
       raise exception 'Encerre o teste avulso anterior antes de iniciar a assinatura.';
     end if;
     select case when p_payload->>'plan'='annual' then annual_cents else monthly_cents end into cents from public.platform_billing_settings where singleton;
     select greatest(public.app_today(),coalesce(max(valid_until),public.app_today())) into first_day from public.billing_production_orders
       where farm_id=f and valid_from<=public.app_today() and refunded_cents=0 and (status='RECEIVED' or (status='CONFIRMED' and method='CREDIT_CARD'));
     insert into public.billing_production_subscriptions(farm_id,user_id,plan,method,amount_cents,first_due_on,next_due_on)
       values(f,p_user_id,p_payload->>'plan',p_payload->>'method',cents,first_day,first_day) returning * into s;
     fresh:=true;
   end if;
 else
   select * into s from public.billing_production_subscriptions where id=(p_payload->>'id')::uuid and farm_id=f for update;
   if s.id is null then raise exception 'Assinatura não encontrada nesta fazenda.'; end if;
   if p_action='customer' then
     if s.customer_id is not null and s.customer_id is distinct from p_payload->>'customerId' then raise exception 'Cliente divergente.'; end if;
     update public.billing_production_subscriptions set customer_id=p_payload->>'customerId' where id=s.id returning * into s;
   elsif p_action='save' then
     return public.app_save_production_verified_subscription(s.id,p_payload);
   elsif p_action='cancel_begin' then
     if s.provider_id is null then raise exception 'Recupere a assinatura antes de cancelar.'; end if;
     if s.status<>'CANCELLED' then update public.billing_production_subscriptions set status='canceling' where id=s.id returning * into s; end if;
   elsif p_action<>'get' then raise exception 'Ação inválida.';
   end if;
 end if;
 return to_jsonb(s)||jsonb_build_object('fresh',fresh);
end $$;
revoke all on function public.app_production_subscription_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_production_subscription_server(text,uuid,jsonb) to service_role;

-- Entrada única para cada cobrança verificada; usada pelo webhook e pela conciliação manual.
create or replace function public.app_ingest_production_subscription_payment(p_subscription_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.billing_production_subscriptions; o public.billing_production_orders; due date;
begin
 select * into s from public.billing_production_subscriptions where id=p_subscription_id;
 if s.id is null then raise exception 'Assinatura inexistente.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.farm_id::text,1702));
 if p_payload->>'providerSubscriptionId' is distinct from s.provider_id or s.provider_id is null
   or p_payload->>'customerId' is distinct from s.customer_id
   or p_payload->>'method' is distinct from s.method or (p_payload->>'amountCents')::int is distinct from s.amount_cents
   or coalesce(p_payload->>'paymentId','')='' then raise exception 'Cobrança de assinatura divergente.'; end if;
 due:=(p_payload->>'dueDate')::date;
 if due is null or due<s.first_due_on then raise exception 'Vencimento inválido.'; end if;
 select * into o from public.billing_production_orders where payment_id=p_payload->>'paymentId';
 if o.id is null then
   insert into public.billing_production_orders(farm_id,user_id,plan,method,amount_cents,subscription_id,due_on,provider_reference,customer_id,payment_id,provider_subscription_id)
     values(s.farm_id,s.user_id,s.plan,s.method,s.amount_cents,s.id,due,s.id::text,s.customer_id,p_payload->>'paymentId',s.provider_id) returning * into o;
 elsif o.subscription_id is distinct from s.id or o.farm_id is distinct from s.farm_id then raise exception 'Pagamento de outra assinatura.';
 end if;
 return public.app_apply_production_verified_payment(o.id,p_payload||jsonb_build_object('externalReference',s.id::text));
end $$;
revoke all on function public.app_ingest_production_subscription_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_ingest_production_subscription_payment(uuid,jsonb) to service_role;

create or replace function public.app_apply_production_verified_payment(p_order_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.billing_production_orders; observed timestamptz; st text; f uuid; refunded integer; s public.billing_production_subscriptions; period_from date; period_end date;
begin
  select farm_id into f from public.billing_production_orders where id=p_order_id;
  if f is null then raise exception 'Pagamento não encontrado.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
  select * into o from public.billing_production_orders where id=p_order_id for update;
      observed:=(p_payload->>'observedAt')::timestamptz;
      if observed is null or observed>now()+interval '1 minute' then raise exception 'Data de consulta inválida.'; end if;
      -- Uma consulta que começou antes da última aplicada não sobrescreve a situação mais recente.
      if o.checked_at is not null and observed<o.checked_at then return to_jsonb(o); end if;
      if o.customer_id is null or p_payload->>'customerId' is distinct from o.customer_id
         or p_payload->>'externalReference' is distinct from coalesce(o.provider_reference,o.id::text)
         or (p_payload->>'amountCents')::integer is distinct from o.amount_cents
         or p_payload->>'method' is distinct from o.method
         or (o.payment_id is not null and o.payment_id is distinct from p_payload->>'paymentId')
         or coalesce(p_payload->>'paymentId','')='' then raise exception 'Cobrança divergente.'; end if;
      if o.subscription_id is not null then
        select * into s from public.billing_production_subscriptions where id=o.subscription_id;
        if p_payload->>'providerSubscriptionId' is distinct from s.provider_id or (p_payload->>'dueDate')::date is distinct from o.due_on then raise exception 'Assinatura ou período divergente.'; end if;
      end if;
      period_from:=coalesce(o.due_on,public.app_today());
      period_end:=case when o.subscription_id is not null then public.app_production_period_end(period_from,s.first_due_on,o.plan)
        else (period_from+case when o.plan='annual' then interval '1 year' else interval '1 month' end)::date end;
      refunded:=coalesce((p_payload->>'refundedCents')::integer,o.refunded_cents);
      if refunded<0 or refunded>o.amount_cents then raise exception 'Estorno divergente.'; end if;
      st:=p_payload->>'status';
      if st not in ('PENDING','RECEIVED','CONFIRMED','OVERDUE','REFUNDED','RECEIVED_IN_CASH','REFUND_REQUESTED',
        'REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL',
        'DUNNING_REQUESTED','DUNNING_RECEIVED','AWAITING_RISK_ANALYSIS','AUTHORIZED','DELETED',
        'APPROVED_BY_RISK_ANALYSIS') or st is null then raise exception 'Situação desconhecida.'; end if;
      if p_payload->>'invoiceUrl' is null or p_payload->>'invoiceUrl' !~ '^https://(www\.asaas\.com|asaas\.com)/i/[A-Za-z0-9_-]+$' then raise exception 'Link de pagamento inválido.'; end if;
      update public.billing_production_orders set payment_id=p_payload->>'paymentId',invoice_url=p_payload->>'invoiceUrl',
        status=st,checked_at=observed,refunded_cents=refunded,last_sync_source=case when p_payload->>'source'='webhook' then 'webhook' else 'manual' end,
        last_webhook_at=case when p_payload->>'source'='webhook' then now() else last_webhook_at end,
        valid_from=case when valid_from is null and refunded=0 and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD')) then period_from else valid_from end,
        valid_until=case when valid_until is null and refunded=0 and (st='RECEIVED' or (st='CONFIRMED' and method='CREDIT_CARD'))
          then period_end else valid_until end
        where id=o.id returning * into o;

  perform public.app_maybe_approve_paid_owner(o.farm_id);
  return to_jsonb(o);
end $$;
revoke all on function public.app_apply_production_verified_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_apply_production_verified_payment(uuid,jsonb) to service_role;


create or replace function public.app_my_production_plan() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f uuid; own boolean; result jsonb; s public.billing_production_subscriptions; through_day date; simulated text;
begin
  f := public.app_billing_farm_id();
  if auth.uid() is null or f is null then raise exception 'Acesso não autorizado.'; end if;
  select account_owner_id=auth.uid() into own from public.farms where id=f;
  select * into s from public.billing_production_subscriptions where farm_id=f and own order by created_at desc limit 1;
  select max(valid_until) into through_day from public.billing_production_orders where farm_id=f and subscription_id=s.id
    and refunded_cents=0 and (status='RECEIVED' or (status='CONFIRMED' and method='CREDIT_CARD')) and valid_from<=public.app_today();
  simulated:=case when through_day>public.app_today() then 'paid'
    when through_day is not null and public.app_today()<through_day+3 and s.status='ACTIVE' then 'grace'
    when through_day is not null then 'expired' else 'awaiting_payment' end;
  select jsonb_build_object(
    'environment','production','mode',cfg.mode,'monthlyCents',cfg.monthly_cents,'annualCents',cfg.annual_cents,
    'graceDays',3,'simulatedStatus',case when own then simulated else null end,'paidThrough',case when own then through_day else null end,
    'subscription',case when s.id is null then null else jsonb_build_object('id',s.id,'plan',s.plan,'method',s.method,'amountCents',s.amount_cents,
      'status',s.status,'nextDueOn',case when s.status='CANCELLED' then null else coalesce((select min(due_on) from public.billing_production_orders where subscription_id=s.id and status in ('creating','PENDING','OVERDUE','AUTHORIZED','AWAITING_RISK_ANALYSIS')),s.next_due_on) end,'firstDueOn',s.first_due_on,'cancelledAt',s.cancelled_at,'checkedAt',s.checked_at) end,
    'isOwner',own,'canTest',own,
    'canCreate',own and cfg.integration_ready and (cfg.mode='automatic' or public.is_platform_admin())
      and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
      and exists(select 1 from public.account_access where user_id=auth.uid() and (status='approved' or (status='pending' and source='customer' and cfg.mode='automatic')))
      and exists(select 1 from public.farm_members where user_id=auth.uid() and farm_id=f and enabled)
      and (public.is_platform_admin() or public.app_production_entitlement(f)->>'reason' not in ('manual_release','courtesy')),
    'newSubscriptionStartsOn',greatest(public.app_today(),coalesce((select max(valid_until) from public.billing_production_orders where farm_id=f and valid_from<=public.app_today() and refunded_cents=0 and (status='RECEIVED' or (status='CONFIRMED' and method='CREDIT_CARD'))),public.app_today())),'billingVersion',cfg.updated_at,'access',public.app_production_entitlement(f),
    'orders',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'subscriptionId',o.subscription_id,'dueOn',o.due_on,'archived',o.archived,'plan',o.plan,'method',o.method,'amountCents',o.amount_cents,'status',o.status,
      'invoiceUrl',o.invoice_url,'validFrom',o.valid_from,'validUntil',o.valid_until,'checkedAt',o.checked_at,
      'createdAt',o.created_at,'refundedCents',o.refunded_cents,'lastSyncSource',o.last_sync_source,'lastWebhookAt',o.last_webhook_at) order by coalesce(o.due_on,o.created_at::date) desc,o.created_at desc)
      from (select * from public.billing_production_orders where farm_id=f and own order by coalesce(due_on,created_at::date) desc,created_at desc limit 30) o),'[]'::jsonb)
  ) into result from public.platform_billing_settings cfg where cfg.singleton;
  if result is null then raise exception 'Instale o controle de cobrança da etapa 1.'; end if;
  return result;
end $$;
revoke all on function public.app_my_production_plan() from public,anon;
grant execute on function public.app_my_production_plan() to authenticated;



create or replace function public.app_production_webhook(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.billing_production_webhook_events; o public.billing_production_orders; result jsonb; s public.billing_production_subscriptions; is_subscription boolean;
  event_key text:=p_payload->>'eventId'; token uuid;
begin
  if event_key is null or length(event_key)>255 or event_key not like 'evt_%' then raise exception 'Evento inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(event_key,1703));
  select * into e from public.billing_production_webhook_events where event_id=event_key for update;
  if p_action='claim' then
    if coalesce(p_payload->>'paymentId','')='' or length(p_payload->>'paymentId')>255
       or (p_payload->>'eventType' not like 'PAYMENT_%' and p_payload->>'eventType' not like 'SUBSCRIPTION_%') then raise exception 'Cobrança inválida.'; end if;
    if e.event_id is not null then
      if e.payment_id is distinct from p_payload->>'paymentId' or e.event_type is distinct from p_payload->>'eventType' then raise exception 'Evento divergente.'; end if;
      if e.state in ('processed','ignored') then return jsonb_build_object('duplicate',true); end if;
      if e.lease_until>now() then return jsonb_build_object('busy',true); end if;
    end if;
    is_subscription:=p_payload->>'eventType' like 'SUBSCRIPTION_%';
    select * into s from public.billing_production_subscriptions where
      provider_id=case when is_subscription then p_payload->>'paymentId' else p_payload->>'providerSubscriptionId' end;
    if s.id is null and coalesce(p_payload->>'externalReference','')<>'' then
      select * into s from public.billing_production_subscriptions where id::text=p_payload->>'externalReference';
    end if;
    if not is_subscription then
    select * into o from public.billing_production_orders
      where payment_id=p_payload->>'paymentId'
         or (id::text=p_payload->>'externalReference' and (payment_id is null or payment_id=p_payload->>'paymentId'))
      order by created_at desc limit 1;
    end if;
    if s.id is null and o.subscription_id is not null then select * into s from public.billing_production_subscriptions where id=o.subscription_id; end if;
    if o.id is null and s.id is null then
      insert into public.billing_production_webhook_events(event_id,event_type,payment_id,state,processed_at)
      values(event_key,p_payload->>'eventType',p_payload->>'paymentId','ignored',now())
      on conflict(event_id) do update set state='ignored',processed_at=now(),lease_until=null;
      return jsonb_build_object('ignored',true);
    end if;
    token:=gen_random_uuid();
    insert into public.billing_production_webhook_events(event_id,event_type,payment_id,order_id,subscription_id,state,claim_token,lease_until,attempts)
      values(event_key,p_payload->>'eventType',p_payload->>'paymentId',o.id,s.id,'processing',token,now()+interval '30 seconds',1)
      on conflict(event_id) do update set order_id=excluded.order_id,subscription_id=excluded.subscription_id,state='processing',claim_token=excluded.claim_token,
        lease_until=excluded.lease_until,attempts=public.billing_production_webhook_events.attempts+1,error_code=null;
    return jsonb_build_object('claimToken',token,'order',case when o.id is null then null else to_jsonb(o) end,'subscription',case when s.id is null then null else to_jsonb(s) end);
  end if;
  if e.event_id is null or e.claim_token is distinct from (p_payload->>'claimToken')::uuid then raise exception 'Reserva do evento inválida.'; end if;
  if e.state='processed' then return jsonb_build_object('duplicate',true); end if;
  if e.state<>'processing' then raise exception 'Evento sem processamento ativo.'; end if;
  if p_action='fail' then
    update public.billing_production_webhook_events set state='failed',lease_until=null,error_code='VERIFY_OR_APPLY_FAILED' where event_id=event_key;
    return jsonb_build_object('retry',true);
  elsif p_action='deleted_unimported' then
    if e.event_type<>'PAYMENT_DELETED' or e.subscription_id is null then raise exception 'Evento não elegível.'; end if;
    update public.billing_production_orders set status='DELETED',checked_at=now()
      where id=e.order_id and status in ('creating','PENDING','OVERDUE','AUTHORIZED','AWAITING_RISK_ANALYSIS');
    update public.billing_production_webhook_events set state='processed',processed_at=now(),lease_until=null,error_code='DELETED_BEFORE_IMPORT' where event_id=event_key;
    return jsonb_build_object('processed',true);
  elsif p_action='complete' then
    if e.event_type like 'SUBSCRIPTION_%' then
      if p_payload->'subscription'->>'providerId' is distinct from e.payment_id then raise exception 'Assinatura divergente.'; end if;
      result:=public.app_save_production_verified_subscription(e.subscription_id,p_payload->'subscription');
    else
    if p_payload->'payment'->>'paymentId' is distinct from e.payment_id then raise exception 'Cobrança divergente.'; end if;
    if e.subscription_id is not null then
      result:=public.app_ingest_production_subscription_payment(e.subscription_id,(p_payload->'payment')||jsonb_build_object('source','webhook'));
      update public.billing_production_webhook_events set order_id=(result->>'id')::uuid where event_id=event_key;
    else
      result:=public.app_apply_production_verified_payment(e.order_id,(p_payload->'payment')||jsonb_build_object('source','webhook'));
    end if;
    end if;
    update public.billing_production_webhook_events set state='processed',processed_at=now(),lease_until=null,error_code=null where event_id=event_key;
    return jsonb_build_object('processed',true);
  end if;
  raise exception 'Operação inválida.';
end $$;
revoke all on function public.app_production_webhook(text,jsonb) from public,anon,authenticated;
grant execute on function public.app_production_webhook(text,jsonb) to service_role;
create or replace function public.app_billing_production_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; o public.billing_production_orders; fresh boolean := false; cents integer; st text; observed timestamptz;
begin
  select x.id into f from public.farms x
  join public.farm_members m on m.farm_id=x.id and m.user_id=p_user_id and m.enabled
  join public.account_access a on a.user_id=p_user_id and a.status='approved'
  where x.account_owner_id=p_user_id
    and exists(select 1 from public.platform_admins where user_id=p_user_id);
  if f is null then raise exception 'Teste exclusivo do administrador titular de uma fazenda aprovada.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
  if p_action='prepare' then
    if exists(select 1 from public.billing_production_subscriptions where farm_id=f and status<>'CANCELLED') then raise exception 'Use a assinatura existente.'; end if;
    if p_payload->>'plan' not in ('monthly','annual') or p_payload->>'method' not in ('PIX','CREDIT_CARD')
       or p_payload->>'plan' is null or p_payload->>'method' is null then raise exception 'Plano ou pagamento inválido.'; end if;
    select * into o from public.billing_production_orders where farm_id=f and not archived
      and status not in ('REFUNDED','DELETED')
      and (status not in ('CONFIRMED','RECEIVED') or valid_until is null or valid_until>public.app_today())
      order by created_at desc limit 1;
    if o.id is null then
      select case when p_payload->>'plan'='annual' then annual_cents else monthly_cents end into cents
      from public.platform_billing_settings where singleton;
      if cents is null then raise exception 'Configuração de cobrança ausente.'; end if;
      insert into public.billing_production_orders(farm_id,user_id,plan,method,amount_cents)
        values(f,p_user_id,p_payload->>'plan',p_payload->>'method',cents) returning * into o;
      fresh:=true;
    end if;
  else
    select * into o from public.billing_production_orders where id=(p_payload->>'id')::uuid and farm_id=f for update;
    if o.id is null then raise exception 'Pagamento não encontrado nesta fazenda.'; end if;
    if p_action='customer' then
      if o.customer_id is not null and o.customer_id<>p_payload->>'customerId' then raise exception 'Cliente divergente.'; end if;
      update public.billing_production_orders set customer_id=p_payload->>'customerId' where id=o.id returning * into o;
    elsif p_action='sync' then
      return public.app_apply_production_verified_payment(o.id,p_payload-'source');
    elsif p_action='archive' then
      if o.subscription_id is not null then raise exception 'Use Cancelar renovação para encerrar a assinatura.'; end if;
      if o.status not in ('RECEIVED','REFUNDED','DELETED') and not (o.status='CONFIRMED' and o.method='CREDIT_CARD') then
        raise exception 'Conclua ou cancele o pagamento no Sandbox antes de encerrar o teste.';
      end if;
      update public.billing_production_orders set archived=true where id=o.id returning * into o;
    elsif p_action<>'get' then raise exception 'Operação inválida.';
    end if;
  end if;
  return to_jsonb(o)||jsonb_build_object('fresh',fresh);
end $$;
revoke all on function public.app_billing_production_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_billing_production_server(text,uuid,jsonb) to service_role;


-- Estado de preparação sem chave ou documento. A instalação nunca liga a cobrança.
alter table public.platform_billing_settings add column if not exists production_checked_at timestamptz;
alter table public.platform_billing_settings add column if not exists production_check_actor uuid references auth.users(id);

-- Contexto para pagamentos: independente da autorização de leitura/gravação do rebanho.
create or replace function public.app_billing_farm_id() returns uuid
language sql stable security definer set search_path='' as $$
 select f.id from public.farms f where f.account_owner_id=auth.uid()
 union all
 select m.farm_id from public.farm_members m join public.account_access a on a.user_id=m.user_id
 where m.user_id=auth.uid() and m.enabled and a.status='approved'
   and not exists(select 1 from public.farms where account_owner_id=auth.uid())
 limit 1
$$;
revoke all on function public.app_billing_farm_id() from public,anon;
grant execute on function public.app_billing_farm_id() to authenticated,app_farm_executor;

create or replace function public.app_production_entitlement(p_farm_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare f public.farms; cfg public.platform_billing_settings; c public.farm_billing_controls; until_day date; reason text;
begin
 select * into f from public.farms where id=p_farm_id;
 select * into cfg from public.platform_billing_settings where singleton;
 select * into c from public.farm_billing_controls where farm_id=p_farm_id;
 if f.id is null or cfg.singleton is null then return jsonb_build_object('allowed',false,'reason','unavailable'); end if;
 select max(valid_until) into until_day from public.billing_production_orders where farm_id=p_farm_id and valid_from<=public.app_today()
   and refunded_cents=0 and (status='RECEIVED' or (status='CONFIRMED' and method='CREDIT_CARD'));
 if cfg.mode='manual' then reason:='manual';
 elsif exists(select 1 from public.platform_admins where user_id=f.account_owner_id) then reason:='admin';
 elsif coalesce(c.manual_access_preserved,false) then reason:='manual_release';
 elsif coalesce(c.courtesy_enabled and (c.courtesy_expires_on is null or c.courtesy_expires_on>=public.app_today()),false) then reason:='courtesy';
 elsif until_day>public.app_today() then reason:='paid';
 elsif exists(select 1 from public.billing_production_orders o left join public.billing_production_subscriptions s on s.id=o.subscription_id
   where o.farm_id=p_farm_id and coalesce(o.valid_from,o.due_on)<=public.app_today()
   and coalesce(o.valid_until,public.app_production_period_end(o.due_on,s.first_due_on,o.plan))>public.app_today()
   and (o.refunded_cents>0 or o.status in ('REFUNDED','REFUND_IN_PROGRESS','REFUND_REQUESTED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'))) then reason:='review';
 elsif until_day is not null and public.app_today()<until_day+3
   and exists(select 1 from public.billing_production_subscriptions where farm_id=p_farm_id and status='ACTIVE' and first_due_on<=until_day) then reason:='grace';
 elsif until_day is null then reason:='awaiting_payment'; else reason:='expired'; end if;
 return jsonb_build_object('allowed',reason in ('manual','admin','manual_release','courtesy','paid','grace'),'reason',reason,
   'paidThrough',until_day,'graceDays',3,'graceUntil',case when until_day is not null then until_day+3 else null end);
end $$;
revoke all on function public.app_production_entitlement(uuid) from public,anon,authenticated;
grant execute on function public.app_production_entitlement(uuid) to service_role;

create or replace function public.current_farm_id() returns uuid
language sql stable security definer set search_path='' as $$
 select m.farm_id from public.farm_members m join public.account_access a on a.user_id=m.user_id
 join public.farms f on f.id=m.farm_id join public.account_access o on o.user_id=f.account_owner_id
 where m.user_id=auth.uid() and m.enabled and a.status='approved' and o.status='approved'
   and (public.app_production_entitlement(m.farm_id)->>'allowed')::boolean
$$;
-- Os grants anteriores continuam; toda política RLS passa pela mesma função.

create or replace function public.app_record_production_check(p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'Administrador inválido.'; end if;
 update public.platform_billing_settings set integration_ready=true,production_checked_at=clock_timestamp(),production_check_actor=p_actor,updated_at=clock_timestamp() where singleton;
 insert into public.platform_audit(actor_id,action,details) values(p_actor,'production_connection_verified',jsonb_build_object('readOnly',true));
 return jsonb_build_object('verified',true,'environment','production');
end $$;
revoke all on function public.app_record_production_check(uuid) from public,anon,authenticated;
grant execute on function public.app_record_production_check(uuid) to service_role;

create or replace function public.app_maybe_approve_paid_owner(p_farm_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare owner_key uuid; updated integer;
begin
 if not exists(select 1 from public.platform_billing_settings where singleton and mode='automatic' and integration_ready) then return; end if;
 select account_owner_id into owner_key from public.farms where id=p_farm_id;
 -- Pagamento não contorna suspensão, recusa, revogação de equipe nem confirmação do e-mail.
 if not exists(select 1 from auth.users where id=owner_key and email_confirmed_at is not null)
   or not exists(select 1 from public.farm_members where user_id=owner_key and farm_id=p_farm_id and enabled) then return; end if;
 if not exists(select 1 from public.billing_production_orders where farm_id=p_farm_id and valid_from<=public.app_today() and valid_until>public.app_today()
   and refunded_cents=0 and (status='RECEIVED' or (status='CONFIRMED' and method='CREDIT_CARD'))) then return; end if;
 update public.account_access set status='approved',decided_by=null,decided_at=now() where user_id=owner_key and status='pending' and source='customer';
 get diagnostics updated=row_count;
 if updated>0 then insert into public.platform_audit(actor_id,action,target_id,details)
   values(owner_key,'payment_auto_approved',p_farm_id,jsonb_build_object('provider','asaas','environment','production','automatic',true)); end if;
end $$;
revoke all on function public.app_maybe_approve_paid_owner(uuid) from public,anon,authenticated;
grant execute on function public.app_maybe_approve_paid_owner(uuid) to service_role;

-- Mantém todas as operações de equipe/aprovação anteriores sob a mesma RLS.
do $$ begin
 if to_regprocedure('app_private.app_tenant_before_billing(text,jsonb)') is null then
   alter function public.app_tenant(text,jsonb) rename to app_tenant_before_billing;
   alter function public.app_tenant_before_billing(text,jsonb) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_tenant_before_billing(text,jsonb) from public,anon,authenticated;
create or replace function public.app_tenant(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cfg public.platform_billing_settings; a public.account_access; fid uuid; owner_key uuid; target uuid; old jsonb; ent jsonb; own boolean; can_enroll boolean;
begin
 if uid is null then raise exception 'Entre na sua conta.'; end if;
 select * into cfg from public.platform_billing_settings where singleton;
 select * into a from public.account_access where user_id=uid;
 can_enroll:=cfg.mode='automatic' and cfg.integration_ready and a.status='pending' and a.source='customer'
   and exists(select 1 from auth.users where id=uid and email_confirmed_at is not null);
 if p_action='create_farm' and can_enroll then
   perform pg_advisory_xact_lock(hashtextextended(uid::text,71));
   if exists(select 1 from public.farm_members where user_id=uid) or exists(select 1 from public.farms where account_owner_id=uid) then raise exception 'Esta conta já possui fazenda.'; end if;
   if nullif(btrim(p_payload->>'name'),'') is null or length(p_payload->>'name')>150 then raise exception 'Informe o nome da fazenda, até 150 caracteres.'; end if;
   insert into public.farms(name,city,state,owner_id,account_owner_id)
     values(btrim(p_payload->>'name'),nullif(btrim(p_payload->>'city'),''),nullif(btrim(p_payload->>'state'),''),uid,uid) returning id into target;
   insert into public.farm_members(user_id,farm_id,role) values(uid,target,'gestor');
   return jsonb_build_object('farmId',target);
 end if;
 if p_action='context' then perform public.app_maybe_approve_paid_owner(public.app_billing_farm_id()); end if;
 old:=app_private.app_tenant_before_billing(p_action,p_payload);
 if p_action='context' then
   fid:=public.app_billing_farm_id();
   select account_owner_id into owner_key from public.farms where id=fid;
   own:=coalesce(owner_key=uid,false);
   ent:=case when fid is not null then public.app_production_entitlement(fid) else null end;
   return old||jsonb_build_object('billingFarmId',fid,'billingOwner',own,'billingMode',cfg.mode,'billing',ent,
     'autoEnrollment',can_enroll and not exists(select 1 from public.farm_members where user_id=uid),
     'billingRequired',cfg.mode='automatic' and fid is not null and (a.status='approved' or (a.status='pending' and a.source='customer' and own))
       and exists(select 1 from public.farm_members where user_id=uid and enabled)
       and exists(select 1 from public.account_access where user_id=owner_key and status not in ('rejected','suspended'))
       and public.current_farm_id() is null);
 end if;
 return old;
end $$;
revoke all on function public.app_tenant(text,jsonb) from public,anon;
grant execute on function public.app_tenant(text,jsonb) to authenticated;

create or replace function public.app_billing_admin(p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();
  settings public.platform_billing_settings%rowtype;
  previous public.farm_billing_controls%rowtype;
  target uuid;
  changed boolean;
  requested_mode text;
  monthly numeric;
  annual numeric;
  enabled boolean;
  expiry date;
  result_farms jsonb;
begin
  if uid is null or not public.is_platform_admin() then
    raise exception 'Acesso exclusivo do administrador do sistema.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Dados inválidos.'; end if;
  if p_action not in ('overview','save_settings','set_courtesy','set_farm_access','set_mode') or p_action is null then raise exception 'Ação de cobrança inválida.'; end if;
  if p_payload ?| array['integration_ready','integrationReady'] then
    raise exception 'A integração não pode ser habilitada por esta operação.';
  end if;
  -- Não altera current_farm_id, status de aprovação, membros ou acesso operacional.
  perform pg_advisory_xact_lock(hashtextextended('liben-platform-billing',0));
  select * into settings from public.platform_billing_settings where singleton for update;
  if not found then raise exception 'Configuração de cobrança não instalada.'; end if;

  if p_action='set_mode' then
    if nullif(p_payload->>'expectedUpdatedAt','')::timestamptz is distinct from settings.updated_at then raise exception 'A configuração foi alterada. Atualize a página.'; end if;
    requested_mode:=p_payload->>'mode';
    if coalesce(requested_mode,'') not in ('manual','automatic') or p_payload->'confirm' is distinct from 'true'::jsonb then raise exception 'Confirme a mudança do modo de acesso.'; end if;
    if requested_mode='automatic' and (not settings.integration_ready or settings.production_checked_at is null or settings.production_checked_at<now()-interval '1 hour' or not exists(select 1 from public.billing_production_webhook_events e join public.billing_production_orders o on o.id=e.order_id where e.state='processed' and e.event_type in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED') and o.valid_from is not null)) then raise exception 'Verifique a conexão e o webhook de produção antes de ativar.'; end if;
    if settings.mode is distinct from requested_mode then
      insert into public.platform_audit(actor_id,action,details) values(uid,'billing_mode_changed',jsonb_build_object('previousMode',settings.mode,'mode',requested_mode));
      update public.platform_billing_settings set mode=requested_mode,updated_at=clock_timestamp() where singleton returning * into settings;
    end if;
  elsif p_action='save_settings' then
    if nullif(p_payload->>'expectedUpdatedAt','')::timestamptz is distinct from settings.updated_at then
      raise exception 'A configuração foi alterada por outro administrador. Atualize antes de salvar.';
    end if;
    requested_mode:=p_payload->>'mode';
    if requested_mode is null or requested_mode not in ('manual','automatic') then raise exception 'Modo de acesso inválido.'; end if;
    if requested_mode is distinct from settings.mode then raise exception 'Use os botões de modo de acesso para mudar a cobrança.'; end if;
    if jsonb_typeof(p_payload->'monthlyCents') is distinct from 'number'
      or jsonb_typeof(p_payload->'annualCents') is distinct from 'number' then raise exception 'Informe preços válidos em centavos.'; end if;
    monthly:=(p_payload->>'monthlyCents')::numeric;
    annual:=(p_payload->>'annualCents')::numeric;
    if monthly<>trunc(monthly) or annual<>trunc(annual)
      or monthly not between 100 and 100000000 or annual not between 100 and 100000000 then
      raise exception 'Os preços devem ser positivos, em centavos inteiros, entre R$ 1,00 e R$ 1.000.000,00.';
    end if;
    if settings.mode is distinct from requested_mode or settings.monthly_cents<>monthly or settings.annual_cents<>annual then
      insert into public.platform_audit(actor_id,action,details) values(uid,'billing_settings_updated',
        jsonb_build_object('previousMode',settings.mode,'mode',requested_mode,
          'previousMonthlyCents',settings.monthly_cents,'monthlyCents',monthly,
          'previousAnnualCents',settings.annual_cents,'annualCents',annual));
      update public.platform_billing_settings set mode=requested_mode,monthly_cents=monthly::integer,
        annual_cents=annual::integer,updated_at=clock_timestamp() where singleton returning * into settings;
    end if;
  elsif p_action in ('set_courtesy','set_farm_access') then
    target:=nullif(p_payload->>'farmId','')::uuid;
    if target is null or not exists(select 1 from public.farms where id=target) then raise exception 'Fazenda não encontrada.'; end if;
    if p_action='set_farm_access' and jsonb_typeof(p_payload->'manualAccessPreserved') is distinct from 'boolean' then raise exception 'Informe a liberação manual.'; end if;
    if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'Informe a situação da cortesia.'; end if;
    enabled:=(p_payload->>'enabled')::boolean;
    if enabled and nullif(p_payload->>'expiresOn','') is not null then
      if (p_payload->>'expiresOn') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Informe uma data de cortesia válida.'; end if;
      expiry:=(p_payload->>'expiresOn')::date;
      if expiry<public.app_today() then raise exception 'A cortesia não pode terminar antes de hoje.'; end if;
    end if;
    select * into previous from public.farm_billing_controls where farm_id=target for update;
    if nullif(p_payload->>'expectedUpdatedAt','')::timestamptz is distinct from previous.updated_at then
      raise exception 'A cortesia foi alterada por outro administrador. Atualize antes de salvar.';
    end if;
    changed:=previous.farm_id is null or previous.courtesy_enabled is distinct from enabled
      or previous.courtesy_expires_on is distinct from expiry
      or (p_action='set_farm_access' and coalesce(previous.manual_access_preserved,false) is distinct from (p_payload->>'manualAccessPreserved')::boolean);
    if changed then
      insert into public.farm_billing_controls(farm_id,courtesy_enabled,courtesy_expires_on,manual_access_preserved)
        values(target,enabled,expiry,case when p_action='set_farm_access' then (p_payload->>'manualAccessPreserved')::boolean else coalesce(previous.manual_access_preserved,false) end) on conflict(farm_id) do update set
          courtesy_enabled=excluded.courtesy_enabled,courtesy_expires_on=excluded.courtesy_expires_on,manual_access_preserved=excluded.manual_access_preserved,
          updated_at=clock_timestamp();
      insert into public.platform_audit(actor_id,action,target_id,details)
        values(uid,'farm_courtesy_updated',target,jsonb_build_object('enabled',enabled,'expiresOn',expiry,
          'manualAccessPreserved',case when p_action='set_farm_access' then (p_payload->>'manualAccessPreserved')::boolean else previous.manual_access_preserved end,'previousEnabled',coalesce(previous.courtesy_enabled,false),'previousExpiresOn',previous.courtesy_expires_on));
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'farmId',f.id,'farmName',f.name,'ownerName',coalesce(p.full_name,u.email),
    'ownerEmail',u.email,'accountStatus',coalesce(a.status,'pending'),
    'manualAccessPreserved',coalesce(b.manual_access_preserved,false),
    'courtesyEnabled',coalesce(b.courtesy_enabled,false),
    'courtesyExpiresOn',b.courtesy_expires_on,
    'courtesyActive',coalesce(b.courtesy_enabled and (b.courtesy_expires_on is null or b.courtesy_expires_on>=public.app_today()),false),
    'financial',public.app_production_entitlement(f.id),'updatedAt',b.updated_at) order by lower(f.name),f.id),'[]'::jsonb)
    into result_farms from public.farms f join auth.users u on u.id=f.account_owner_id
    left join public.profiles p on p.id::text=u.id::text
    left join public.account_access a on a.user_id=u.id
    left join public.farm_billing_controls b on b.farm_id=f.id;
  return jsonb_build_object('settings',jsonb_build_object('mode',settings.mode,
    'monthlyCents',settings.monthly_cents,'annualCents',settings.annual_cents,
    'integrationReady',settings.integration_ready,'productionCheckedAt',settings.production_checked_at,'paymentVerified',exists(select 1 from public.billing_production_webhook_events e join public.billing_production_orders o on o.id=e.order_id where e.state='processed' and e.event_type in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED') and o.valid_from is not null),'activationReady',settings.integration_ready and settings.production_checked_at>now()-interval '1 hour' and exists(select 1 from public.billing_production_webhook_events e join public.billing_production_orders o on o.id=e.order_id where e.state='processed' and e.event_type in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED') and o.valid_from is not null),'updatedAt',settings.updated_at),
    'farms',result_farms,'phase','production_ready');
end $$;
revoke all on function public.app_billing_admin(text,jsonb) from public,anon;
grant execute on function public.app_billing_admin(text,jsonb) to authenticated;


create or replace function public.app_billing_production_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; o public.billing_production_orders;
begin
 select x.id into f from public.farms x join auth.users u on u.id=x.account_owner_id where x.account_owner_id=p_user_id and u.email_confirmed_at is not null;
 if f is null then raise exception 'Acesso restrito ao titular.'; end if;
 select * into o from public.billing_production_orders where id=(p_payload->>'id')::uuid and farm_id=f;
 if o.id is null then raise exception 'Cobrança não encontrada.'; end if;
 if p_action='get' then return to_jsonb(o);
 elsif p_action='sync' then return public.app_apply_production_verified_payment(o.id,p_payload-'source');
 end if;
 raise exception 'Cobrança avulsa indisponível em produção.';
end $$;
revoke all on function public.app_billing_production_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_billing_production_server(text,uuid,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
