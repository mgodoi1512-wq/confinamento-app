-- Relatos beta: envio autenticado e leitura/gestão exclusiva do administrador.
begin;
create table if not exists public.beta_feedback (
 id uuid primary key, user_id uuid not null references auth.users(id), farm_id uuid not null references public.farms(id),
 author text not null, kind text not null check(kind in ('suggestion','bug')),
 description text not null check(length(btrim(description)) between 10 and 5000),
 page text not null check(length(page) between 1 and 500),
 screenshot text check(screenshot is null or (length(screenshot)<=1400000 and screenshot ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')),
 has_screenshot boolean generated always as (screenshot is not null) stored,
 status text not null default 'new' check(status in ('new','reviewing','resolved')),
 notes text not null default '' check(length(notes)<=5000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.beta_feedback enable row level security;
revoke all on public.beta_feedback from public,anon,authenticated;
grant select on public.beta_feedback to authenticated;
drop policy if exists feedback_admin_read on public.beta_feedback;
create policy feedback_admin_read on public.beta_feedback for select to authenticated using((select public.is_platform_admin()));
create index if not exists beta_feedback_created_idx on public.beta_feedback(created_at desc,id);
create or replace function public.app_submit_feedback(p_id uuid,p_kind text,p_description text,p_page text,p_screenshot text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); fid uuid:=public.current_farm_id(); existing public.beta_feedback%rowtype;
begin
 if uid is null or fid is null then raise exception 'Seu acesso não está ativo.'; end if;
 if p_id is null then raise exception 'Identificador obrigatório.'; end if;
 select * into existing from public.beta_feedback where id=p_id;
 if found then
  if existing.user_id=uid and existing.kind=p_kind and existing.description=btrim(p_description) and existing.page=p_page and existing.screenshot is not distinct from p_screenshot then return p_id; end if;
  raise exception 'Identificador já utilizado. Reabra o formulário.';
 end if;
 insert into public.beta_feedback(id,user_id,farm_id,author,kind,description,page,screenshot)
 values(p_id,uid,fid,coalesce((select email from auth.users where id=uid),uid::text),p_kind,btrim(p_description),p_page,p_screenshot);
 return p_id;
end $$;
create or replace function public.app_review_feedback(p_id uuid,p_status text,p_notes text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.beta_feedback%rowtype;
begin
 if not public.is_platform_admin() then raise exception 'Acesso exclusivo do administrador do sistema.'; end if;
 select * into saved from public.beta_feedback where id=p_id for update;
 if not found then raise exception 'Relato não encontrado.'; end if;
 if saved.updated_at is distinct from p_expected_updated_at then raise exception 'O relato foi alterado. Atualize a lista antes de salvar.'; end if;
 update public.beta_feedback set status=p_status,notes=p_notes,updated_at=clock_timestamp() where id=p_id;
 return jsonb_build_object('id',p_id);
end $$;
revoke all on function public.app_submit_feedback(uuid,text,text,text,text),public.app_review_feedback(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.app_submit_feedback(uuid,text,text,text,text),public.app_review_feedback(uuid,text,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
select true as feedback_beta_instalado;
