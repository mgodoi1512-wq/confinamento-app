-- Usa o mesmo fuso de public.app_today() ao validar a data de criação do animal.
-- Não altera eventos existentes nem as permissões da rotina de gravação.
begin;
do $migration$
declare definition text;
begin
  if to_regprocedure('app_private.app_mutate_legacy(text,jsonb,uuid)') is null then
    raise exception 'Instale a atualização de fazendas antes desta correção.';
  end if;
  definition := pg_get_functiondef('app_private.app_mutate_legacy(text,jsonb,uuid)'::regprocedure);
  if position('a.created_at::date' in definition)>0 then
    definition := replace(definition,'a.created_at::date', '(a.created_at at time zone ''America/Sao_Paulo'')::date');
    execute definition;
  elsif position('(a.created_at at time zone ''America/Sao_Paulo'')::date' in definition)=0 then
    raise exception 'A função de salvamento difere da versão esperada. Nenhuma alteração foi aplicada.';
  end if;
end $migration$;
notify pgrst,'reload schema';
commit;
select true as data_sanitaria_corrigida;
