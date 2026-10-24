begin;
create table if not exists app_private.plan_coupons(
 id uuid primary key default gen_random_uuid(),code text not null unique check(code ~ '^[A-Z0-9_-]{3,32}$'),
 kind text not null check(kind in ('percent','fixed')),value numeric(12,2) not null check(value>0),
 plan text not null check(plan in ('monthly','annual','both')),expires_on date not null,
 max_uses integer check(max_uses between 1 and 1000000),active boolean not null default true,
 updated_at timestamptz not null default clock_timestamp(),created_at timestamptz not null default now(),
 check((kind='percent' and value<=99) or (kind='fixed' and value=trunc(value) and value<=100000000))
);
create table if not exists app_private.plan_coupon_quotes(
 id uuid primary key default gen_random_uuid(),coupon_id uuid not null references app_private.plan_coupons,
 farm_id uuid not null references public.farms,user_id uuid not null references auth.users,
 plan text not null,installments integer not null,catalog_cents integer not null,discount_cents integer not null,total_cents integer not null,
 coupon_version timestamptz not null,price_version timestamptz not null,expires_at timestamptz not null default now()+interval '5 minutes',created_at timestamptz not null default now()
);
create table if not exists app_private.plan_coupon_uses(
 id uuid primary key default gen_random_uuid(),coupon_id uuid not null references app_private.plan_coupons,
 quote_id uuid not null unique references app_private.plan_coupon_quotes,farm_id uuid not null references public.farms,
 user_id uuid not null references auth.users,subscription_id uuid references public.billing_production_subscriptions,
 order_id uuid references public.billing_production_orders,code text not null,catalog_cents integer not null,discount_cents integer not null,total_cents integer not null,
 created_at timestamptz not null default now(),unique(coupon_id,farm_id),check(num_nonnulls(subscription_id,order_id)=1)
);
alter table app_private.plan_coupons enable row level security;
alter table app_private.plan_coupon_quotes enable row level security;
alter table app_private.plan_coupon_uses enable row level security;
revoke all on app_private.plan_coupons,app_private.plan_coupon_quotes,app_private.plan_coupon_uses from public,anon,authenticated,app_farm_executor;
create index if not exists coupon_quotes_farm_created on app_private.plan_coupon_quotes(farm_id,created_at);
alter table public.billing_production_subscriptions add column if not exists coupon_quote_id uuid;
alter table public.billing_production_subscriptions add column if not exists coupon_code text;
alter table public.billing_production_subscriptions add column if not exists first_payment_cents integer check(first_payment_cents>=500);
alter table public.billing_production_subscriptions add column if not exists coupon_first_payment_id text;
alter table public.billing_production_orders add column if not exists coupon_quote_id uuid;

create or replace function public.app_coupons_admin(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c app_private.plan_coupons; ident uuid; code text; val numeric; result jsonb;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Acesso exclusivo do administrador.';end if;
 if p_action='save' then
  ident:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());code:=upper(trim(p_payload->>'code'));val:=(p_payload->>'value')::numeric;
  if code is null or code !~ '^[A-Z0-9_-]{3,32}$' or val is null or val<=0 or p_payload->>'kind' not in ('percent','fixed') or p_payload->>'plan' not in ('monthly','annual','both') or (p_payload->>'expiresOn')::date is null then raise exception 'Confira código, desconto, planos e validade.';end if;
  select * into c from app_private.plan_coupons where id=ident for update;
  if found and (c.updated_at is distinct from (p_payload->>'expected')::timestamptz or c.code<>code) then raise exception 'Cupom alterado ou código diferente. Recarregue; o código não pode ser renomeado.';end if;
  insert into app_private.plan_coupons(id,code,kind,value,plan,expires_on,max_uses,active)
  values(ident,code,p_payload->>'kind',val,p_payload->>'plan',(p_payload->>'expiresOn')::date,nullif(p_payload->>'maxUses','')::int,coalesce((p_payload->>'active')::boolean,true))
  on conflict(id) do update set kind=excluded.kind,value=excluded.value,plan=excluded.plan,expires_on=excluded.expires_on,max_uses=excluded.max_uses,active=excluded.active,updated_at=clock_timestamp();
  insert into public.platform_audit(actor_id,action,target_id,details) values(auth.uid(),'plan_coupon_saved',ident,jsonb_build_object('code',code,'kind',p_payload->>'kind','value',val,'plan',p_payload->>'plan','active',coalesce((p_payload->>'active')::boolean,true)));
 elsif p_action<>'list' then raise exception 'Ação inválida.';end if;
 select jsonb_build_object('coupons',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from(
 select pc.*,(select count(*) from app_private.plan_coupon_uses u where u.coupon_id=pc.id) as uses from app_private.plan_coupons pc order by pc.created_at desc limit 200)x),'[]'::jsonb),
 'uses',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from(
 select u.id,u.code,f.name as farm_name,u.catalog_cents,u.discount_cents,u.total_cents,u.created_at,
 case when exists(select 1 from public.billing_production_orders o where (o.id=u.order_id or (o.subscription_id=u.subscription_id and o.due_on=s.first_due_on)) and o.refunded_cents=0 and (o.status='RECEIVED' or (o.status='CONFIRMED' and o.method='CREDIT_CARD'))) then 'Pagamento confirmado' else 'Reservado na contratação' end as state
 from app_private.plan_coupon_uses u join public.farms f on f.id=u.farm_id left join public.billing_production_subscriptions s on s.id=u.subscription_id order by u.created_at desc limit 200)x),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.app_coupons_admin(text,jsonb) from public,anon;
grant execute on function public.app_coupons_admin(text,jsonb) to authenticated;

create or replace function public.app_coupon_quote(p_code text,p_plan text,p_installments integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f uuid;c app_private.plan_coupons;cfg public.platform_billing_settings;q app_private.plan_coupon_quotes;base integer;off integer;
begin
 select x.id into f from public.farms x join auth.users u on u.id=x.account_owner_id where x.account_owner_id=auth.uid() and u.email_confirmed_at is not null;
 if f is null or not exists(select 1 from public.farm_members where farm_id=f and user_id=auth.uid() and enabled) then raise exception 'Somente o titular ativo da fazenda pode aplicar cupom.';end if;
 if p_code is null or length(p_code)>32 or p_plan not in ('monthly','annual') or p_installments is null or p_installments<1 or p_installments>12 or (p_plan='monthly' and p_installments<>1) then raise exception 'Cupom ou plano inválido.';end if;
 delete from app_private.plan_coupon_quotes x where x.farm_id=f and x.expires_at<now() and not exists(select 1 from app_private.plan_coupon_uses u where u.quote_id=x.id);
 if (select count(*) from app_private.plan_coupon_quotes where farm_id=f and created_at>now()-interval '1 minute')>=20 then raise exception 'Aguarde um minuto antes de consultar novamente.';end if;
 select * into c from app_private.plan_coupons where code=upper(trim(p_code));
 if c.id is null or not c.active or c.expires_on<public.app_today() or c.plan not in ('both',p_plan)
 or exists(select 1 from app_private.plan_coupon_uses where coupon_id=c.id and farm_id=f)
 or (c.max_uses is not null and (select count(*) from app_private.plan_coupon_uses where coupon_id=c.id)>=c.max_uses) then raise exception 'Cupom indisponível para esta contratação.';end if;
 select * into strict cfg from public.platform_billing_settings where singleton;
 base:=case when p_plan='annual' then cfg.annual_cents else cfg.monthly_cents end;
 off:=case when c.kind='percent' then round(base*c.value/100)::int else c.value::int end;
 if off<1 or base-off<500 or (base-off)/p_installments<500 then raise exception 'Desconto incompatível: mínimo de R$ 5,00 por cobrança/parcela. Reduza as parcelas ou escolha outro cupom.';end if;
 insert into app_private.plan_coupon_quotes(coupon_id,farm_id,user_id,plan,installments,catalog_cents,discount_cents,total_cents,coupon_version,price_version)
 values(c.id,f,auth.uid(),p_plan,p_installments,base,off,base-off,c.updated_at,cfg.updated_at) returning * into q;
 return jsonb_build_object('id',q.id,'code',c.code,'plan',q.plan,'installments',q.installments,'originalCents',base,'discountCents',off,'totalCents',base-off,'priceVersion',cfg.updated_at,'expiresAt',q.expires_at);
end $$;
revoke all on function public.app_coupon_quote(text,text,integer) from public,anon;
grant execute on function public.app_coupon_quote(text,text,integer) to authenticated;

create or replace function app_private.reserve_plan_coupon(p_quote uuid,p_user uuid,p_farm uuid,p_plan text,p_installments int,p_subscription uuid,p_order uuid) returns app_private.plan_coupon_quotes
language plpgsql security definer set search_path='' as $$
declare q app_private.plan_coupon_quotes;c app_private.plan_coupons;cfg public.platform_billing_settings;
begin
 select * into q from app_private.plan_coupon_quotes where id=p_quote;
 if q.id is null or q.user_id<>p_user or q.farm_id<>p_farm or q.plan<>p_plan or q.installments<>p_installments then raise exception 'Cupom não corresponde a esta contratação.';end if;
 select * into c from app_private.plan_coupons where id=q.coupon_id for update;
 select * into cfg from public.platform_billing_settings where singleton;
 if q.expires_at<=clock_timestamp() or not c.active or c.expires_on<public.app_today() or c.updated_at<>q.coupon_version or cfg.updated_at<>q.price_version
 or exists(select 1 from app_private.plan_coupon_uses where coupon_id=c.id and farm_id=p_farm)
 or (c.max_uses is not null and (select count(*) from app_private.plan_coupon_uses where coupon_id=c.id)>=c.max_uses) then raise exception 'Cupom alterado, expirado ou esgotado. Aplique novamente antes de contratar.';end if;
 insert into app_private.plan_coupon_uses(coupon_id,quote_id,farm_id,user_id,subscription_id,order_id,code,catalog_cents,discount_cents,total_cents)
 values(c.id,q.id,p_farm,p_user,p_subscription,p_order,c.code,q.catalog_cents,q.discount_cents,q.total_cents);
 return q;
end $$;
revoke all on function app_private.reserve_plan_coupon(uuid,uuid,uuid,text,int,uuid,uuid) from public,anon,authenticated,service_role,app_farm_executor;

do $$begin
 if to_regprocedure('app_private.subscription_before_coupons(text,uuid,jsonb)') is null then
 alter function public.app_production_subscription_server(text,uuid,jsonb) rename to subscription_before_coupons;
 alter function public.subscription_before_coupons(text,uuid,jsonb) set schema app_private;
 end if;
 if to_regprocedure('app_private.annual_before_coupons(text,uuid,jsonb)') is null then
 alter function public.app_annual_purchase_server(text,uuid,jsonb) rename to annual_before_coupons;
 alter function public.annual_before_coupons(text,uuid,jsonb) set schema app_private;
 end if;
end $$;
revoke all on function app_private.subscription_before_coupons(text,uuid,jsonb),app_private.annual_before_coupons(text,uuid,jsonb) from public,anon,authenticated,service_role,app_farm_executor;
create or replace function public.app_production_subscription_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;s public.billing_production_subscriptions;q app_private.plan_coupon_quotes;quote_id uuid:=nullif(p_payload->>'couponQuoteId','')::uuid;
begin
 r:=app_private.subscription_before_coupons(p_action,p_user_id,p_payload-'couponQuoteId');
 if p_action<>'prepare' then return r;end if;
 select * into s from public.billing_production_subscriptions where id=(r->>'id')::uuid;
 if quote_id is not null then
 if r->'fresh'='true'::jsonb then
 q:=app_private.reserve_plan_coupon(quote_id,p_user_id,s.farm_id,s.plan,1,s.id,null);
 update public.billing_production_subscriptions set coupon_quote_id=q.id,coupon_code=(select code from app_private.plan_coupons where id=q.coupon_id),first_payment_cents=q.total_cents where id=s.id returning * into s;
 elsif s.coupon_quote_id is distinct from quote_id or s.plan is distinct from p_payload->>'plan' or s.method is distinct from p_payload->>'method' then raise exception 'Já existe uma contratação. Consulte ou cancele antes de alterar o cupom.';end if;
 end if;
 return to_jsonb(s)||jsonb_build_object('fresh',r->'fresh');
end $$;
revoke all on function public.app_production_subscription_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_production_subscription_server(text,uuid,jsonb) to service_role;
create or replace function public.app_annual_purchase_server(p_action text,p_user_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;o public.billing_production_orders;q app_private.plan_coupon_quotes;quote_id uuid:=nullif(p_payload->>'couponQuoteId','')::uuid;
begin
 r:=app_private.annual_before_coupons(p_action,p_user_id,p_payload-'couponQuoteId');
 if p_action<>'prepare' then return r;end if;
 select * into o from public.billing_production_orders where id=(r->>'id')::uuid;
 if quote_id is not null then
 if r->'fresh'='true'::jsonb then
 q:=app_private.reserve_plan_coupon(quote_id,p_user_id,o.farm_id,'annual',o.installment_count,null,o.id);
 update public.billing_production_orders set amount_cents=q.total_cents,coupon_quote_id=q.id where id=o.id returning * into o;
 elsif o.coupon_quote_id is distinct from quote_id then raise exception 'Já existe uma contratação. Consulte ou cancele antes de alterar o cupom.';end if;
 end if;
 return to_jsonb(o)||jsonb_build_object('fresh',r->'fresh');
end $$;
revoke all on function public.app_annual_purchase_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_annual_purchase_server(text,uuid,jsonb) to service_role;

create or replace function public.app_coupon_bind_first_payment(p_subscription_id uuid,p_payment_id text,p_due date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.billing_production_subscriptions;
begin
 select * into s from public.billing_production_subscriptions where id=p_subscription_id for update;
 if s.id is null or s.coupon_quote_id is null or s.first_due_on is distinct from p_due or p_payment_id is null or p_payment_id !~ '^pay_[A-Za-z0-9_-]+$' or (s.coupon_first_payment_id is not null and s.coupon_first_payment_id<>p_payment_id) then raise exception 'Primeira cobrança divergente.';end if;
 update public.billing_production_subscriptions set coupon_first_payment_id=p_payment_id where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function public.app_coupon_bind_first_payment(uuid,text,date) from public,anon,authenticated;
grant execute on function public.app_coupon_bind_first_payment(uuid,text,date) to service_role;

create or replace function public.app_ingest_production_subscription_payment(p_subscription_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.billing_production_subscriptions; o public.billing_production_orders; due date; expected_cents int;
begin
 select * into s from public.billing_production_subscriptions where id=p_subscription_id;
 if s.id is null then raise exception 'Assinatura inexistente.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.farm_id::text,1702));
 due:=(p_payload->>'dueDate')::date;
 expected_cents:=s.amount_cents;
 if s.coupon_quote_id is not null and due=s.first_due_on then
 if s.coupon_first_payment_id is null or s.coupon_first_payment_id is distinct from p_payload->>'paymentId' then raise exception 'Primeira cobrança do cupom ainda não conciliada.';end if;
 expected_cents:=s.first_payment_cents;
 end if;
 if p_payload->>'providerSubscriptionId' is distinct from s.provider_id or s.provider_id is null
   or p_payload->>'customerId' is distinct from s.customer_id
   or p_payload->>'method' is distinct from s.method or (p_payload->>'amountCents')::int is distinct from expected_cents
   or coalesce(p_payload->>'paymentId','')='' then raise exception 'Cobrança de assinatura divergente.'; end if;
 due:=(p_payload->>'dueDate')::date;
 if due is null or due<s.first_due_on then raise exception 'Vencimento inválido.'; end if;
 select * into o from public.billing_production_orders where payment_id=p_payload->>'paymentId';
 if o.id is null then
   insert into public.billing_production_orders(farm_id,user_id,plan,method,amount_cents,subscription_id,due_on,provider_reference,customer_id,payment_id,provider_subscription_id)
     values(s.farm_id,s.user_id,s.plan,s.method,expected_cents,s.id,due,s.id::text,s.customer_id,p_payload->>'paymentId',s.provider_id) returning * into o;
 elsif o.subscription_id is distinct from s.id or o.farm_id is distinct from s.farm_id then raise exception 'Pagamento de outra assinatura.';
 end if;
 return public.app_apply_production_verified_payment(o.id,p_payload||jsonb_build_object('externalReference',s.id::text));
end $$;
revoke all on function public.app_ingest_production_subscription_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_ingest_production_subscription_payment(uuid,jsonb) to service_role;


notify pgrst,'reload schema';
commit;
