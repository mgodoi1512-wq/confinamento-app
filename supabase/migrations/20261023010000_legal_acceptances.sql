begin;

-- Não altera perfis, papéis, fazendas, assinaturas ou usuários existentes.
create table if not exists public.app_legal_versions (
  singleton boolean primary key default true check (singleton),
  terms_version text not null,
  privacy_version text not null,
  enforce_on_signup boolean not null default false
);
insert into public.app_legal_versions(singleton,terms_version,privacy_version,enforce_on_signup)
values(true,'2026-10-23.1','2026-10-23.1',false)
on conflict(singleton) do nothing;
alter table public.app_legal_versions enable row level security;
revoke all on public.app_legal_versions from public, anon, authenticated;

create table if not exists public.app_legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'signup' check(source='signup'),
  unique(user_id,terms_version,privacy_version)
);
alter table public.app_legal_acceptances enable row level security;
revoke all on public.app_legal_acceptances from public, anon, authenticated;
grant select on public.app_legal_acceptances to authenticated;
drop policy if exists legal_acceptance_read_own on public.app_legal_acceptances;
create policy legal_acceptance_read_own on public.app_legal_acceptances
for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.app_capture_signup_legal_acceptance()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  config public.app_legal_versions%rowtype;
  accepted boolean;
begin
  select * into strict config from public.app_legal_versions where singleton;
  accepted := coalesce(
    new.raw_user_meta_data->>'terms_accepted'='true'
    and new.raw_user_meta_data->>'privacy_notice_acknowledged'='true'
    and new.raw_user_meta_data->>'terms_version'=config.terms_version
    and new.raw_user_meta_data->>'privacy_version'=config.privacy_version,
    false
  );
  if config.enforce_on_signup and not accepted then
    raise exception 'Leia e aceite os Termos de Uso e confirme a leitura do Aviso de Privacidade atualizado.' using errcode='23514';
  end if;
  if accepted then
    insert into public.app_legal_acceptances(user_id,terms_version,privacy_version,accepted_at,source)
    values(new.id,config.terms_version,config.privacy_version,now(),'signup')
    on conflict(user_id,terms_version,privacy_version) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.app_capture_signup_legal_acceptance() from public, anon, authenticated;
drop trigger if exists app_capture_signup_legal_acceptance on auth.users;
create trigger app_capture_signup_legal_acceptance after insert on auth.users
for each row execute function public.app_capture_signup_legal_acceptance();

commit;
