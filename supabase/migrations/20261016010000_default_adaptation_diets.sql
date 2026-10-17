-- Execute integralmente como postgres no SQL Editor do Supabase.
-- Apenas novas fazendas; não altera nem completa dietas de fazendas existentes.
begin;

create or replace function app_private.seed_new_farm_adaptation_diets()
returns trigger language plpgsql security definer set search_path='' as $$
declare phase record; diet_id uuid;
begin
  for phase in
    select * from (values
      ('ADAPTAÇÃO 1-3',   0.3::numeric, 3.0::numeric, 60::numeric, 'VOLUMOSO'),
      ('ADAPTAÇÃO 4-6',   0.8::numeric, 2.5::numeric, null::numeric, 'VOLUMOSO'),
      ('ADAPTAÇÃO 7-9',   1.3::numeric, 2.0::numeric, null::numeric, 'VOLUMOSO'),
      ('ADAPTAÇÃO 10-12', 1.8::numeric, 1.5::numeric, null::numeric, 'VOLUMOSO'),
      ('ADAPTAÇÃO 13-15', 2.3::numeric, 1.0::numeric, null::numeric, 'VOLUMOSO'),
      ('APÓS ADAPTAÇÃO',  2.5::numeric, 0.8::numeric, null::numeric, 'VOLUMOSO/SALADA')
    ) as defaults(name,feed_pct,roughage_pct,dry_matter_pct,roughage_name)
  loop
    insert into public.diets(farm_id,owner_id,name,dry_matter_pct,is_active)
      values(new.id,new.account_owner_id,phase.name,phase.dry_matter_pct,true)
      returning id into diet_id;
    insert into public.diet_items(farm_id,owner_id,diet_id,ingredient,kg_per_head_day,body_weight_pct)
      values(new.id,new.account_owner_id,diet_id,'RAÇÃO',0,phase.feed_pct),
            (new.id,new.account_owner_id,diet_id,phase.roughage_name,0,phase.roughage_pct);
  end loop;
  return new;
end $$;
-- O gatilho executa como postgres, inclusive antes de existir o vínculo farm_members.
-- Não conceder execução direta: não é uma API de cópia/restauração de dietas.
alter function app_private.seed_new_farm_adaptation_diets() owner to postgres;
revoke all on function app_private.seed_new_farm_adaptation_diets()
  from public,anon,authenticated,app_farm_executor;
drop trigger if exists farms_seed_adaptation_diets on public.farms;
create trigger farms_seed_adaptation_diets after insert on public.farms
  for each row execute function app_private.seed_new_farm_adaptation_diets();
commit;

select exists(select 1 from pg_trigger
  where tgrelid='public.farms'::regclass and tgname='farms_seed_adaptation_diets'
    and not tgisinternal and tgenabled='O') as dietas_padrao_instaladas;
