-- LiBen: diagnóstico SOMENTE LEITURA. Não cria, altera ou exclui dados.
-- Execute pelo SQL Editor administrativo do seu próprio projeto, se desejar.
-- Os resultados mostram estrutura/permissões; não incluem chaves, tokens ou usuários.

-- 1) Tabelas da aplicação e RLS. Tabela sem RLS deve ser analisada junto dos grants.
select schemaname, tablename, rowsecurity
from pg_tables where schemaname='public' order by tablename;

-- 2) Privilégios diretos. Escritas de rebanho/financeiro passam pelas RPCs.
select n.nspname as esquema,c.relname as tabela,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_le,
  has_table_privilege('anon', c.oid, 'INSERT, UPDATE, DELETE') as anon_escreve,
  has_table_privilege('authenticated', c.oid, 'SELECT') as autenticado_le,
  has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE') as autenticado_escreve
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','app_private') and c.relkind='r' order by n.nspname,c.relname;

-- 3) SECURITY DEFINER: permissões e configuração de search_path.
-- Funções públicas de data/consulta podem ter uso legítimo: analisar caso a caso.
select n.nspname as esquema, p.proname as funcao,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  r.rolname as dono, p.proconfig as configuracao,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_executa,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as autenticado_executa
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_roles r on r.oid=p.proowner
where n.nspname in ('public','app_private') and p.prosecdef
order by n.nspname,p.proname;

-- 4) O executor não deve ter login, bypass de RLS ou CREATE nos esquemas.
select rolname, rolcanlogin, rolbypassrls,
  has_schema_privilege(rolname,'public','CREATE') as cria_public,
  has_schema_privilege(rolname,'app_private','CREATE') as cria_app_private
from pg_roles where rolname='app_farm_executor';

-- 5) Aceite: o padrão de instalação é false durante a transição de frontend/app.
-- A leitura não altera o modo. Só habilite a exigência após atualizar TODOS os clientes.
select terms_version,privacy_version,enforce_on_signup from public.app_legal_versions;

-- 6) Existência da cadeia de telefone administrativo. Não reaplicar arquivos antigos
-- automaticamente: o banco pode já ter funções posteriores envolvendo app_tenant.
select to_regprocedure('app_private.app_tenant_before_contact_phone(text,jsonb)') is not null
  as wrapper_telefone_presente;

-- 7) Presença dos recursos recentes. Existência não comprova conteúdo instalado.
select signature as assinatura,to_regprocedure(signature) is not null as presente
from unnest(array[
 'public.app_mutate(text,jsonb,uuid)',
 'app_private.app_mutate_before_herd_count(text,jsonb,uuid)',
 'public.app_public_plan_prices()',
 'public.app_finance_workspace(text,jsonb)',
 'app_private.app_finance_before_purchase_installments(text,jsonb)'
]) signature;

-- 8) Aceite: conferir o trigger efetivamente habilitado e sua função.
select t.tgname as trigger,t.tgenabled as habilitacao,
 n.nspname as esquema_funcao,p.proname as funcao
from pg_trigger t join pg_proc p on p.oid=t.tgfoid
join pg_namespace n on n.oid=p.pronamespace
where t.tgrelid=to_regclass('auth.users') and not t.tgisinternal
order by t.tgname;

-- 9) Políticas RLS: retornar papéis e expressões para análise, não dados de usuários.
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','app_private')
order by schemaname,tablename,policyname;

-- 10) A exclusão simples no banco antigo não basta: conferir a implementação atual.
-- Retorna apenas marcadores e hash, sem expor corpo de funções com integrações.
select n.nspname as esquema,p.proname as funcao,
 md5(pg_get_functiondef(p.oid)) as hash_definicao,
 position('Cadastre um animal para cada cabeça' in pg_get_functiondef(p.oid))>0 as exige_animais,
 position('head_count=head_count-1' in pg_get_functiondef(p.oid))>0 as reduz_saldo
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='app_mutate' and p.prokind='f';
-- Marcadores são indícios da versão enviada, não prova completa de segurança.


-- 11) CREATE em esquemas de aplicação e privilégios de rotina por papel.
select r.rolname as papel,n.nspname as esquema,
 has_schema_privilege(r.rolname,n.oid,'USAGE') as pode_usar,
 has_schema_privilege(r.rolname,n.oid,'CREATE') as pode_criar
from pg_roles r cross join pg_namespace n
where r.rolname in ('anon','authenticated','app_farm_executor')
 and n.nspname in ('public','app_private')
order by r.rolname,n.nspname;
