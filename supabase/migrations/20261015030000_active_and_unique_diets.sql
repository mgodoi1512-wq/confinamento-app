-- Dietas: nome único por fazenda e somente dietas ativas em novos tratos.
-- Execute integralmente no SQL Editor antes de publicar o front-end.
begin;

create or replace function app_private.enforce_diet_name_unique()
returns trigger language plpgsql security definer set search_path='' as $$
declare canonical text;
begin
  new.name := btrim(regexp_replace(coalesce(new.name,''),'[[:space:]]+',' ','g'));
  canonical := lower(new.name);
  if canonical='' then raise exception 'Nome da dieta obrigatório.'; end if;
  if tg_op='UPDATE' then
    if new.farm_id=old.farm_id and canonical=lower(btrim(regexp_replace(old.name,'[[:space:]]+',' ','g'))) then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('diet-name:'||new.farm_id::text||':'||canonical,0));
  if exists(select 1 from public.diets d where d.farm_id=new.farm_id and d.id<>new.id
    and lower(btrim(regexp_replace(d.name,'[[:space:]]+',' ','g')))=canonical) then
    raise exception 'Já existe uma dieta com esse nome nesta fazenda, ativa ou inativa. Use outro nome ou edite a dieta existente.' using errcode='23505';
  end if;
  return new;
end $$;
revoke all on function app_private.enforce_diet_name_unique() from public,anon,authenticated,app_farm_executor;
drop trigger if exists diets_unique_name_guard on public.diets;
create trigger diets_unique_name_guard before insert or update of name,farm_id on public.diets
for each row execute function app_private.enforce_diet_name_unique();

-- Um índice único dá a garantia adicional para cadastros simultâneos.
-- Se houver duplicações antigas, elas são preservadas e novos conflitos são
-- bloqueados pelo gatilho; renomeie-as e reaplique este SQL para criar o índice.
do $$ begin
  if not exists(select 1 from public.diets group by farm_id,lower(btrim(regexp_replace(name,'[[:space:]]+',' ','g'))) having count(*)>1) then
    create unique index if not exists diets_farm_normalized_name_unique
    on public.diets(farm_id,(lower(btrim(regexp_replace(name,'[[:space:]]+',' ','g')))));
  else
    raise notice 'Há nomes duplicados antigos. Os dados foram preservados; novos nomes duplicados estão bloqueados. Renomeie os conflitos e reaplique este SQL.';
  end if;
end $$;

create or replace function app_private.require_active_feed_diet()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.diet_id is not null and not exists(select 1 from public.diets d
    where d.id=new.diet_id and d.farm_id=new.farm_id and d.is_active) then
    raise exception 'A dieta selecionada está inativa ou indisponível. Selecione uma dieta ativa antes de registrar o trato.';
  end if;
  return new;
end $$;
revoke all on function app_private.require_active_feed_diet() from public,anon,authenticated,app_farm_executor;
drop trigger if exists feed_logs_active_diet_guard on public.feed_logs;
create trigger feed_logs_active_diet_guard before insert or update of diet_id on public.feed_logs
for each row execute function app_private.require_active_feed_diet();

commit;

select
  exists(select 1 from pg_trigger where tgrelid='public.diets'::regclass and tgname='diets_unique_name_guard') as nomes_protegidos,
  exists(select 1 from pg_trigger where tgrelid='public.feed_logs'::regclass and tgname='feed_logs_active_diet_guard') as trato_so_com_dieta_ativa,
  (select count(*) from (select farm_id,lower(btrim(regexp_replace(name,'[[:space:]]+',' ','g')))
    from public.diets group by farm_id,lower(btrim(regexp_replace(name,'[[:space:]]+',' ','g'))) having count(*)>1) duplicates) as grupos_de_nomes_duplicados_antigos;
