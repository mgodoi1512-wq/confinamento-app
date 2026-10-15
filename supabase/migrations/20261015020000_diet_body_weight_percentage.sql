-- Quantidade por ingrediente: kg/cabeça/dia ou percentual do peso vivo.
-- Executar integralmente no SQL Editor antes de publicar o front-end.
begin;
alter table public.diet_items add column if not exists body_weight_pct numeric(7,4);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.diet_items'::regclass and conname='diet_items_body_weight_pct_check') then
    alter table public.diet_items add constraint diet_items_body_weight_pct_check
      check(body_weight_pct is null or (body_weight_pct between 0 and 100 and kg_per_head_day=0));
  end if;
end $$;

do $migration$
declare
  definition text;
  old_fragment text := $old$        if (j->>'kg_per_head_day')::numeric is null or (j->>'kg_per_head_day')::numeric<0 then raise exception 'Quantidade do ingrediente inválida.'; end if;
        insert into public.diet_items(diet_id,ingredient,kg_per_head_day,owner_id) values(ident,btrim(j->>'ingredient'),(j->>'kg_per_head_day')::numeric,uid);$old$;
  new_fragment text := $new$        -- Quantidades percentuais são preservadas e convertidas pelo peso de referência ao usar a dieta.
        if nullif(j->>'body_weight_pct','') is not null then
          if not ((j->>'body_weight_pct')::numeric between 0 and 100) then
            raise exception 'Percentual do peso vivo deve estar entre 0 e 100.';
          end if;
          insert into public.diet_items(diet_id,ingredient,kg_per_head_day,body_weight_pct,owner_id)
          values(ident,btrim(j->>'ingredient'),0,(j->>'body_weight_pct')::numeric,uid);
        else
          if (j->>'kg_per_head_day')::numeric is null or (j->>'kg_per_head_day')::numeric<0 or (j->>'kg_per_head_day')::numeric='NaN'::numeric then
            raise exception 'Quantidade do ingrediente inválida.';
          end if;
          insert into public.diet_items(diet_id,ingredient,kg_per_head_day,body_weight_pct,owner_id)
          values(ident,btrim(j->>'ingredient'),(j->>'kg_per_head_day')::numeric,null,uid);
        end if;$new$;
begin
  if to_regprocedure('app_private.app_mutate_legacy(text,jsonb,uuid)') is null then
    raise exception 'Instale a atualização de fazendas antes desta migração.';
  end if;
  definition := pg_get_functiondef('app_private.app_mutate_legacy(text,jsonb,uuid)'::regprocedure);
  if position(old_fragment in definition)>0 then
    definition := replace(definition, old_fragment, new_fragment);
    definition := replace(definition,
      '    delete from public.diet_items where diet_id=ident;',
      $guard$    -- Impede que uma aba antiga substitua percentuais por zero.
    if exists(select 1 from public.diet_items where diet_id=ident and body_weight_pct is not null)
      and not exists(select 1 from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) v where v ? 'body_weight_pct') then
      raise exception 'Atualize a página antes de editar uma dieta com percentual do peso vivo.';
    end if;
    delete from public.diet_items where diet_id=ident;$guard$);
    execute definition;
  elsif position('Quantidades percentuais são preservadas' in definition)=0 then
    raise exception 'A função de salvamento difere da versão esperada. Nenhuma alteração foi aplicada.';
  end if;
end $migration$;
commit;

-- Resultado esperado: true nas duas colunas.
select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='diet_items' and column_name='body_weight_pct') as percentual_instalado,
  position('Quantidades percentuais são preservadas' in pg_get_functiondef('app_private.app_mutate_legacy(text,jsonb,uuid)'::regprocedure)) > 0 as salvamento_atualizado;
