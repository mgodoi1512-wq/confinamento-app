-- Correção para Supabase quando postgres não pode conceder USAGE no schema auth.
-- Executar integralmente no SQL Editor, como postgres.
-- Não concede acesso às tabelas auth e não altera as regras RLS.
begin;

create or replace function app_private.app_request_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select auth.uid() $$;

alter function app_private.app_request_user_id() owner to postgres;
revoke all on function app_private.app_request_user_id() from public, anon, authenticated;
grant execute on function app_private.app_request_user_id() to app_farm_executor;

do $$
declare
  item record;
  definition text;
  total integer := 0;
begin
  for item in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname in ('app_mutate_legacy', 'app_correct_weight_record', 'app_apply_readings')
      and p.proowner = 'app_farm_executor'::regrole
      and p.prosecdef
  loop
    definition := pg_get_functiondef(item.oid);
    if position('auth.uid()' in definition) > 0 then
      execute replace(definition, 'auth.uid()', 'app_private.app_request_user_id()');
    elsif position('app_private.app_request_user_id()' in definition) = 0 then
      raise exception 'Função % com definição diferente da esperada. Nenhuma alteração foi aplicada.', item.oid::regprocedure;
    end if;
    total := total + 1;
  end loop;
  if total <> 3 then
    raise exception 'Esperadas 3 funções internas; encontradas %. Nenhuma alteração foi aplicada.', total;
  end if;
end $$;

commit;

-- Resultado esperado: 3 linhas com identificacao_corrigida = true.
select
  p.proname as funcao,
  pg_get_userbyid(p.proowner) as responsavel,
  position('app_private.app_request_user_id()' in pg_get_functiondef(p.oid)) > 0 as identificacao_corrigida
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app_private'
  and p.proname in ('app_mutate_legacy', 'app_correct_weight_record', 'app_apply_readings')
order by p.proname;
