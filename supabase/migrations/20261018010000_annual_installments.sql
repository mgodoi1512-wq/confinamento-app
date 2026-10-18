begin;
-- Compras anuais no cartão são separadas da recorrência mensal. Nenhuma ativação ou cobrança nesta migration.
alter table public.billing_production_orders add column if not exists installment_count smallint check(installment_count between 1 and 12);
alter table public.billing_production_orders add column if not exists provider_installment_id text;
alter table public.billing_production_orders add column if not exists annual_members jsonb not null default '[]' check(jsonb_typeof(annual_members)='array');
alter table public.billing_production_orders add column if not exists annual_base_from date;
alter table public.billing_production_orders add column if not exists annual_cancel_state text check(annual_cancel_state in ('canceling','CANCELLED'));
create unique index if not exists annual_provider_installment_unique on public.billing_production_orders(provider_installment_id) where provider_installment_id is not null;

create or replace function public.app_annual_purchase_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid; o public.billing_production_orders; cfg public.platform_billing_settings; acc public.account_access; n int; fresh boolean:=false; first_day date; ent jsonb;
begin
 if p_action='webhook_get' then
   select * into o from public.billing_production_orders where id=(p_payload->>'id')::uuid and installment_count is not null;
   if o.id is null then raise exception 'Contratação anual não encontrada.'; end if;
   return to_jsonb(o);
 end if;
 select x.id into f from public.farms x join auth.users u on u.id=x.account_owner_id where x.account_owner_id=p_user_id and u.email_confirmed_at is not null;
 if f is null then raise exception 'Somente o titular com e-mail confirmado pode gerenciar a contratação.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
 if p_action='prepare' then
   select * into cfg from public.platform_billing_settings where singleton;
   select * into acc from public.account_access where user_id=p_user_id;
   if acc.status in ('rejected','suspended') or not exists(select 1 from public.farm_members where user_id=p_user_id and farm_id=f and enabled) then raise exception 'Cadastro indisponível para nova cobrança.'; end if;
   if acc.status<>'approved' and not(acc.status='pending' and acc.source='customer' and cfg.mode='automatic') then raise exception 'Aguarde aprovação administrativa.'; end if;
   if not cfg.integration_ready or not(cfg.mode='automatic' or exists(select 1 from public.platform_admins where user_id=p_user_id)) then raise exception 'Cobrança de produção não ativada.'; end if;
   if nullif(p_payload->>'priceVersion','')::timestamptz is distinct from cfg.updated_at then raise exception 'Valores alterados. Recarregue e confirme novamente.'; end if;
   if p_payload->'productionConsent' is distinct from 'true'::jsonb then raise exception 'Confirme a contratação real.'; end if;
   ent:=public.app_production_entitlement(f);
   if ent->>'reason' in ('manual_release','courtesy') and not exists(select 1 from public.platform_admins where user_id=p_user_id) then raise exception 'Fazenda com liberação sem cobrança.'; end if;
   n:=(p_payload->>'installmentCount')::int;
   if n is null or n<1 or n>12 or cfg.annual_cents/n<500 then raise exception 'Parcelamento inválido. Máximo 12 e mínimo R$ 5 por parcela.'; end if;
   if exists(select 1 from public.billing_production_subscriptions where farm_id=f and status<>'CANCELLED') then raise exception 'Cancele a renovação da assinatura existente antes de contratar o anual no cartão.'; end if;
   select * into o from public.billing_production_orders where farm_id=f and installment_count is not null and not archived
     and status not in ('DELETED','REFUNDED') and (status not in ('CONFIRMED','RECEIVED') or valid_until is null or valid_until>public.app_today()) order by created_at desc limit 1;
   if o.id is not null then
     if o.installment_count<>n then raise exception 'Já existe uma contratação. Consulte ou cancele antes de alterar as parcelas.'; end if;
   else
     if exists(select 1 from public.billing_production_orders where farm_id=f and subscription_id is null and installment_count is null and not archived and status not in ('DELETED','REFUNDED')) then raise exception 'Regularize a cobrança anterior.'; end if;
     select greatest(public.app_today(),coalesce(max(valid_until),public.app_today())) into first_day from public.billing_production_orders where farm_id=f and valid_from<=public.app_today() and refunded_cents=0 and (status='RECEIVED' or (status='CONFIRMED' and method='CREDIT_CARD'));
     insert into public.billing_production_orders(farm_id,user_id,plan,method,amount_cents,installment_count,due_on,annual_base_from)
       values(f,p_user_id,'annual','CREDIT_CARD',cfg.annual_cents,n,first_day,first_day) returning * into o;
     fresh:=true;
   end if;
 else
   select * into o from public.billing_production_orders where id=(p_payload->>'id')::uuid and farm_id=f and installment_count is not null for update;
   if o.id is null then raise exception 'Contratação não encontrada nesta fazenda.'; end if;
   if p_action='customer' then
     if coalesce(p_payload->>'customerId','')='' or (o.customer_id is not null and o.customer_id is distinct from p_payload->>'customerId') then raise exception 'Cliente divergente.'; end if;
     update public.billing_production_orders set customer_id=p_payload->>'customerId' where id=o.id returning * into o;
   elsif p_action='cancel_begin' then
     if o.payment_id is null then raise exception 'Recupere a contratação antes de cancelar.'; end if;
     if o.valid_from is not null or o.refunded_cents>0 or exists(select 1 from jsonb_array_elements(o.annual_members) v where v->>'status' not in ('PENDING','OVERDUE','DELETED')) then raise exception 'Pagamento já iniciado ou confirmado. O cancelamento pendente não solicita estorno.'; end if;
     if o.status<>'DELETED' then update public.billing_production_orders set annual_cancel_state='canceling' where id=o.id returning * into o; end if;
   elsif p_action<>'get' then raise exception 'Ação inválida.'; end if;
 end if;
 return to_jsonb(o)||jsonb_build_object('fresh',fresh);
end $$;
revoke all on function public.app_annual_purchase_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_annual_purchase_server(text,uuid,jsonb) to service_role;

create or replace function public.app_apply_annual_snapshot(p_order_id uuid,p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.billing_production_orders; f uuid; observed timestamptz; member jsonb; members jsonb:=p_snapshot->'payments'; total int:=0; refunds int:=0; n int:=0; paid_n int:=0; deleted_n int:=0; refunded_n int:=0; sum_id int;
 state text:='PENDING'; bad text; first_member jsonb; start_day date; group_id text:=nullif(p_snapshot->>'installmentId','');
begin
 select farm_id into f from public.billing_production_orders where id=p_order_id and installment_count is not null;
 if f is null then raise exception 'Contratação anual não encontrada.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
 select * into o from public.billing_production_orders where id=p_order_id for update;
 observed:=(p_snapshot->>'observedAt')::timestamptz;
 if observed is null or observed>now()+interval '1 minute' then raise exception 'Consulta inválida.'; end if;
 if o.checked_at is not null and observed<o.checked_at then return to_jsonb(o); end if;
 if jsonb_typeof(members) is distinct from 'array' or jsonb_array_length(members)<>o.installment_count then raise exception 'Conjunto de parcelas incompleto.'; end if;
 if o.customer_id is null or (o.provider_installment_id is not null and o.provider_installment_id is distinct from group_id)
   or (o.installment_count>1 and group_id is null) or (o.installment_count=1 and group_id is not null)
   or coalesce(p_snapshot->>'paymentId','')='' or (o.payment_id is not null and o.payment_id is distinct from p_snapshot->>'paymentId') then raise exception 'Parcelamento divergente.'; end if;
 select count(distinct v->>'id') into sum_id from jsonb_array_elements(members) v;
 if sum_id<>o.installment_count then raise exception 'Parcela duplicada.'; end if;
 for member in select * from jsonb_array_elements(members) loop
   n:=n+1;
   if coalesce(member->>'id','')='' or jsonb_typeof(member->'amountCents') is distinct from 'number' or member->>'customerId' is distinct from o.customer_id or member->>'method' is distinct from 'CREDIT_CARD'
     or nullif(member->>'installmentId','') is distinct from group_id
     or (member->>'amountCents')::int<500 or abs((member->>'amountCents')::numeric-o.amount_cents::numeric/o.installment_count)>o.installment_count
     or coalesce(member->>'invoiceUrl','') !~ '^https://(www\.asaas\.com|asaas\.com)/i/[A-Za-z0-9_-]+$'
     or (member->>'status') not in ('PENDING','CONFIRMED','RECEIVED','OVERDUE','DELETED','REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL','AWAITING_RISK_ANALYSIS','AUTHORIZED','RECEIVED_IN_CASH','APPROVED_BY_RISK_ANALYSIS')
     or member->>'status' is null or member->>'dueDate' is null then raise exception 'Parcela divergente.'; end if;
   if member->>'externalReference' is not null and member->>'externalReference' is distinct from o.id::text then raise exception 'Referência divergente.'; end if;
   if member->>'id'=p_snapshot->>'paymentId' then first_member:=member; end if;
   total:=total+(member->>'amountCents')::int;
   if coalesce((member->>'refundedCents')::int,0)<0 or coalesce((member->>'refundedCents')::int,0)>(member->>'amountCents')::int then raise exception 'Estorno divergente.'; end if;
   refunds:=refunds+coalesce((member->>'refundedCents')::int,0);
   if member->>'status' in ('CONFIRMED','RECEIVED') then paid_n:=paid_n+1; end if;
   if member->>'status'='DELETED' then deleted_n:=deleted_n+1; end if;
   if member->>'status'='REFUNDED' then refunded_n:=refunded_n+1; end if;
   if member->>'status' in ('REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL') then bad:=member->>'status'; end if;
 end loop;
 if total<>o.amount_cents or first_member is null or first_member->>'externalReference' is distinct from o.id::text or first_member->>'dueDate' is distinct from o.due_on::text then raise exception 'Valor total ou primeira parcela divergente.'; end if;
 if refunds=o.amount_cents or refunded_n=n then state:='REFUNDED';
 elsif bad is not null then state:=case when bad='REFUNDED' then 'REFUND_REQUESTED' else bad end;
 elsif refunds>0 then state:='REFUND_REQUESTED';
 elsif paid_n=n then state:='CONFIRMED';
 elsif deleted_n=n then state:='DELETED';
 elsif deleted_n>0 and paid_n>0 then state:='REFUND_REQUESTED';
 elsif paid_n>0 or exists(select 1 from jsonb_array_elements(members) v where v->>'status' in ('AUTHORIZED','AWAITING_RISK_ANALYSIS')) then state:='AWAITING_RISK_ANALYSIS';
 elsif exists(select 1 from jsonb_array_elements(members) v where v->>'status'='OVERDUE') then state:='OVERDUE'; end if;
 start_day:=greatest(o.annual_base_from,public.app_today());
 update public.billing_production_orders set payment_id=p_snapshot->>'paymentId',provider_installment_id=group_id,
   invoice_url=first_member->>'invoiceUrl',annual_members=members,status=state,refunded_cents=refunds,checked_at=observed,
   annual_cancel_state=case when state='DELETED' then 'CANCELLED' when state='CONFIRMED' then null else annual_cancel_state end,
   archived=case when state='DELETED' then true when state='CONFIRMED' then false else archived end,
   last_sync_source=case when p_snapshot->>'source'='webhook' then 'webhook' else 'manual' end,
   last_webhook_at=case when p_snapshot->>'source'='webhook' then now() else last_webhook_at end,
   valid_from=case when valid_from is null and state='CONFIRMED' and refunds=0 then start_day else valid_from end,
   valid_until=case when valid_until is null and state='CONFIRMED' and refunds=0 then (start_day+interval '1 year')::date else valid_until end
   where id=o.id returning * into o;
 perform public.app_maybe_approve_paid_owner(o.farm_id);
 return to_jsonb(o);
end $$;
revoke all on function public.app_apply_annual_snapshot(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_apply_annual_snapshot(uuid,jsonb) to service_role;

-- Preserva o protocolo de eventos e sua idempotência nas assinaturas já existentes.
do $$ begin
 if to_regprocedure('app_private.app_production_webhook_before_annual(text,jsonb)') is null then
   alter function public.app_production_webhook(text,jsonb) rename to app_production_webhook_before_annual;
   alter function public.app_production_webhook_before_annual(text,jsonb) set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_production_webhook_before_annual(text,jsonb) from public,anon,authenticated,service_role;
create or replace function public.app_production_webhook(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.billing_production_orders; e public.billing_production_webhook_events; tok uuid; matches int; event_key text:=p_payload->>'eventId';
begin
 if p_action='claim' and p_payload->>'eventType' like 'PAYMENT_%' then
   select count(*) into matches from public.billing_production_orders where installment_count is not null and (
     payment_id=p_payload->>'paymentId' or provider_installment_id=p_payload->>'providerInstallmentId' or id::text=p_payload->>'externalReference');
   if matches>1 then raise exception 'Referências conflitantes.'; end if;
   if matches=1 then
     select * into o from public.billing_production_orders where installment_count is not null and (
       payment_id=p_payload->>'paymentId' or provider_installment_id=p_payload->>'providerInstallmentId' or id::text=p_payload->>'externalReference');
     if event_key is null or length(event_key)>255 or event_key not like 'evt_%' or coalesce(p_payload->>'paymentId','')='' then raise exception 'Evento inválido.'; end if;
     perform pg_advisory_xact_lock(hashtextextended(event_key,1703));
     select * into e from public.billing_production_webhook_events where event_id=event_key for update;
     if e.event_id is not null then
       if e.payment_id is distinct from p_payload->>'paymentId' or e.event_type is distinct from p_payload->>'eventType' then raise exception 'Evento divergente.'; end if;
       if e.state in ('processed','ignored') then return jsonb_build_object('duplicate',true); end if;
       if e.lease_until>now() then return jsonb_build_object('busy',true); end if;
     end if;
     tok:=gen_random_uuid();
     insert into public.billing_production_webhook_events(event_id,event_type,payment_id,order_id,state,claim_token,lease_until,attempts)
       values(event_key,p_payload->>'eventType',p_payload->>'paymentId',o.id,'processing',tok,now()+interval '30 seconds',1)
       on conflict(event_id) do update set order_id=o.id,state='processing',claim_token=tok,lease_until=now()+interval '30 seconds',attempts=public.billing_production_webhook_events.attempts+1,error_code=null;
     return jsonb_build_object('claimToken',tok,'order',to_jsonb(o));
   end if;
 elsif p_action='complete_annual' then
   perform pg_advisory_xact_lock(hashtextextended(event_key,1703));
   select * into e from public.billing_production_webhook_events where event_id=event_key for update;
   if e.claim_token is distinct from (p_payload->>'claimToken')::uuid or e.state<>'processing' then raise exception 'Reserva inválida.'; end if;
   select * into o from public.billing_production_orders where id=e.order_id and installment_count is not null;
   if o.id is null or not exists(select 1 from jsonb_array_elements(o.annual_members) v where v->>'id'=e.payment_id) then raise exception 'Evento fora do parcelamento.'; end if;
   update public.billing_production_orders set last_sync_source='webhook',last_webhook_at=now() where id=o.id;
   update public.billing_production_webhook_events set state='processed',processed_at=now(),lease_until=null,error_code=null where event_id=event_key;
   return jsonb_build_object('processed',true);
 end if;
 return app_private.app_production_webhook_before_annual(p_action,p_payload);
end $$;
revoke all on function public.app_production_webhook(text,jsonb) from public,anon,authenticated;
grant execute on function public.app_production_webhook(text,jsonb) to service_role;

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
   if p_payload->>'plan'='annual' and p_payload->>'method'='CREDIT_CARD' then raise exception 'Use a contratação anual no cartão com escolha de parcelas.'; end if;
   select * into s from public.billing_production_subscriptions where farm_id=f and status<>'CANCELLED';
   if s.id is null then
     if exists(select 1 from public.billing_production_orders where farm_id=f and subscription_id is null and not archived and status not in ('REFUNDED','DELETED') and (installment_count is null or status not in ('CONFIRMED','RECEIVED') or valid_until is null or valid_until>public.app_today())) then
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

create or replace function public.app_apply_production_verified_payment(p_order_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.billing_production_orders; observed timestamptz; st text; f uuid; refunded integer; s public.billing_production_subscriptions; period_from date; period_end date;
begin
  select farm_id into f from public.billing_production_orders where id=p_order_id;
  if f is null then raise exception 'Pagamento não encontrado.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(f::text,1702));
  select * into o from public.billing_production_orders where id=p_order_id for update;
      if o.installment_count is not null then raise exception 'Use a conciliação do anual parcelado.'; end if;
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

do $$ begin
 if to_regprocedure('app_private.app_my_production_plan_before_annual()') is null then
   alter function public.app_my_production_plan() rename to app_my_production_plan_before_annual;
   alter function public.app_my_production_plan_before_annual() set schema app_private;
 end if;
end $$;
revoke all on function app_private.app_my_production_plan_before_annual() from public,anon,authenticated,service_role;
create or replace function public.app_my_production_plan() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; o public.billing_production_orders; f uuid; own boolean; annual jsonb; orders jsonb;
begin
 result:=app_private.app_my_production_plan_before_annual();
 f:=public.app_billing_farm_id();
 select account_owner_id=auth.uid() into own from public.farms where id=f;
 select * into o from public.billing_production_orders where farm_id=f and own and installment_count is not null order by created_at desc,id desc limit 1;
 if o.id is not null then
   annual:=jsonb_build_object('id',o.id,'installmentCount',o.installment_count,'amountCents',o.amount_cents,'status',o.status,
    'cancelState',o.annual_cancel_state,'invoiceUrl',o.invoice_url,'validFrom',o.valid_from,'validUntil',o.valid_until,'checkedAt',o.checked_at,
    'active',o.status not in ('DELETED','REFUNDED') and not o.archived and (o.status not in ('CONFIRMED','RECEIVED') or o.valid_until is null or o.valid_until>public.app_today()),
    'canCancel',o.valid_from is null and o.status in ('creating','PENDING','OVERDUE') and o.payment_id is not null and not exists(select 1 from jsonb_array_elements(o.annual_members) v where v->>'status' not in ('PENDING','OVERDUE','DELETED')));
 end if;
 select coalesce(jsonb_agg(v||jsonb_build_object('installmentCount',p.installment_count)),'[]') into orders
   from jsonb_array_elements(result->'orders') v join public.billing_production_orders p on p.id::text=v->>'id';
 return result||jsonb_build_object('annualPurchase',annual,'maxAnnualInstallments',least(12,((result->>'annualCents')::int/500)),'orders',orders);
end $$;
revoke all on function public.app_my_production_plan() from public,anon;
grant execute on function public.app_my_production_plan() to authenticated;
notify pgrst,'reload schema';
commit;
