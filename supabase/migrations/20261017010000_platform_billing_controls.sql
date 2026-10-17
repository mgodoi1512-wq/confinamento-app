-- ETAPA 1: controles administrativos. Não cria cobranças nem muda a autorização atual.
-- Aplicar integralmente no SQL Editor. O modo automático permanece bloqueado.
begin;

create table if not exists public.platform_billing_settings (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'manual' check (mode in ('manual','automatic')),
  monthly_cents integer not null default 2490 check (monthly_cents between 100 and 100000000),
  annual_cents integer not null default 24990 check (annual_cents between 100 and 100000000),
  integration_ready boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint automatic_requires_verified_integration check (mode='manual' or integration_ready)
);
create table if not exists public.farm_billing_controls (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  manual_access_preserved boolean not null default false,
  courtesy_enabled boolean not null default false,
  courtesy_expires_on date,
  updated_at timestamptz not null default clock_timestamp(),
  check (courtesy_enabled or courtesy_expires_on is null)
);
alter table public.platform_billing_settings enable row level security;
alter table public.farm_billing_controls enable row level security;
revoke all on public.platform_billing_settings, public.farm_billing_controls from public, anon, authenticated;

-- A primeira instalação registra as fazendas existentes. Reaplicar não concede
-- novas isenções nem reverte preços, cortesias ou datas alterados pelo administrador.
do $$
declare inserted integer;
begin
  insert into public.platform_billing_settings(singleton) values(true) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted=1 then
    insert into public.farm_billing_controls(farm_id,manual_access_preserved)
      select id,true from public.farms on conflict do nothing;
  end if;
end $$;

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
  if p_action not in ('overview','save_settings','set_courtesy') or p_action is null then raise exception 'Ação de cobrança inválida.'; end if;
  if p_payload ?| array['integration_ready','integrationReady'] then
    raise exception 'A integração não pode ser habilitada por esta operação.';
  end if;
  -- Não altera current_farm_id, status de aprovação, membros ou acesso operacional.
  perform pg_advisory_xact_lock(hashtextextended('liben-platform-billing',0));
  select * into settings from public.platform_billing_settings where singleton for update;
  if not found then raise exception 'Configuração de cobrança não instalada.'; end if;

  if p_action='save_settings' then
    if nullif(p_payload->>'expectedUpdatedAt','')::timestamptz is distinct from settings.updated_at then
      raise exception 'A configuração foi alterada por outro administrador. Atualize antes de salvar.';
    end if;
    requested_mode:=p_payload->>'mode';
    if requested_mode is null or requested_mode not in ('manual','automatic') then raise exception 'Modo de acesso inválido.'; end if;
    -- Fase 1: nenhuma chave, função de cobrança ou confirmação foi instalada.
    -- Mesmo alterar o campo integration_ready diretamente não ativa esta etapa.
    if requested_mode='automatic' then
      raise exception 'Modo com cobrança indisponível: conclua e teste a integração com o Asaas antes de ativar.';
    end if;
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
  elsif p_action='set_courtesy' then
    target:=nullif(p_payload->>'farmId','')::uuid;
    if target is null or not exists(select 1 from public.farms where id=target) then raise exception 'Fazenda não encontrada.'; end if;
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
      or previous.courtesy_expires_on is distinct from expiry;
    if changed then
      insert into public.farm_billing_controls(farm_id,courtesy_enabled,courtesy_expires_on)
        values(target,enabled,expiry) on conflict(farm_id) do update set
          courtesy_enabled=excluded.courtesy_enabled,courtesy_expires_on=excluded.courtesy_expires_on,
          updated_at=clock_timestamp();
      insert into public.platform_audit(actor_id,action,target_id,details)
        values(uid,'farm_courtesy_updated',target,jsonb_build_object('enabled',enabled,'expiresOn',expiry,
          'previousEnabled',coalesce(previous.courtesy_enabled,false),'previousExpiresOn',previous.courtesy_expires_on));
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'farmId',f.id,'farmName',f.name,'ownerName',coalesce(p.full_name,u.email),
    'ownerEmail',u.email,'accountStatus',coalesce(a.status,'pending'),
    'manualAccessPreserved',coalesce(b.manual_access_preserved,false),
    'courtesyEnabled',coalesce(b.courtesy_enabled,false),
    'courtesyExpiresOn',b.courtesy_expires_on,
    'courtesyActive',coalesce(b.courtesy_enabled and (b.courtesy_expires_on is null or b.courtesy_expires_on>=public.app_today()),false),
    'updatedAt',b.updated_at) order by lower(f.name),f.id),'[]'::jsonb)
    into result_farms from public.farms f join auth.users u on u.id=f.account_owner_id
    left join public.profiles p on p.id::text=u.id::text
    left join public.account_access a on a.user_id=u.id
    left join public.farm_billing_controls b on b.farm_id=f.id;
  return jsonb_build_object('settings',jsonb_build_object('mode',settings.mode,
    'monthlyCents',settings.monthly_cents,'annualCents',settings.annual_cents,
    'integrationReady',false,'updatedAt',settings.updated_at),
    'farms',result_farms,'phase','controls_only');
end $$;
revoke all on function public.app_billing_admin(text,jsonb) from public,anon;
grant execute on function public.app_billing_admin(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
