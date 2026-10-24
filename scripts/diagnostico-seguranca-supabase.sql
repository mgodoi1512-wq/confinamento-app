-- LiBen: diagnóstico SOMENTE LEITURA. Não cria, altera ou exclui dados.
-- Execute pelo SQL Editor administrativo do seu próprio projeto, se desejar.
-- Os resultados mostram estrutura/permissões; não incluem chaves, tokens ou usuários.

-- 1) Tabelas da aplicação e RLS. Tabela sem RLS deve ser analisada junto dos grants.
select schemaname, tablename, rowsecurity
from pg_tables where schemaname='public' order by tablename;

-- 2) Privilégios diretos. Escritas de rebanho/financeiro passam pelas RPCs.
select c.relname as tabela,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_le,
  has_table_privilege('anon', c.oid, 'INSERT, UPDATE, DELETE') as anon_escreve,
  has_table_privilege('authenticated', c.oid, 'SELECT') as autenticado_le,
  has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE') as autenticado_escreve
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;

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
