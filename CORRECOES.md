# Correções e instalação

Esta entrega contém uma cópia corrigida do projeto, código-fonte completo, lockfile npm, testes e migração SQL. O projeto original e o Supabase real não foram alterados.

## O que mudou

- Saída parcial exige seleção dos animais; baixa apenas os selecionados. Quantidade, saldo, datas e encerramento são validados no servidor. Animais sem identificação admitem saída quantitativa por venda/óbito; abate exige identificação e carência liberada. O peso da saída fica no histórico de movimentações e não substitui a média de peso do lote remanescente.
- Criação de lote, pesagem, eventos sanitários, dietas e protocolos usam transações RPC. Falha intermediária desfaz a operação. Um bloqueio transacional serializa as alterações da instalação, impedindo saldo perdido e superlotação concorrente. Chaves de requisição permitem repetir uma operação sem duplicar registros.
- Eventos sanitários preservam a maior carência vigente. Uma vacina não encerra tratamento anterior. Óbito baixa animal e saldo do lote na mesma transação. A aplicação de protocolo grava produtos/doses e carência, inclusive coletiva em lote não identificado.
- Transferência inclui animais em tratamento e verifica a capacidade. Cadastro individual acompanha o curral do lote. Exclusões que perderiam históricos são bloqueadas; remover apenas identificação não representa saída física.
- Pesagem individual exclui animais baixados e valida quantidade/pesos. Inserção retroativa e exclusão recalculam o peso individual vigente por data. A composição de dieta/protocolo não é perdida se uma gravação falhar.
- GMD usa o intervalo até a pesagem. Data civil considera São Paulo, inclusive após 21h. Entrada numérica aceita `1.234,5` e decimais com ponto. Indicador agregado conserva GMD negativo.
- Leitura de cocho soma `diet_items`, guarda oferta base e não reaplica/duplica o ajuste. Sem histórico anterior da manhã, a referência inicial é a soma diária da dieta: o operador deve conferir e informar a oferta da manhã no campo explícito. A aplicação gera **um registro de trato da manhã**, não calcula a divisão automática entre turnos. Não usar esse botão se a mesma oferta já tiver sido registrada manualmente.
- Mortalidade soma cabeças, não quantidade de eventos. O denominador é a entrada inicial dos lotes; vendas/abates não são tratamentos. Animais em carência não são contabilizados como aptos para abate.
- Novos cadastros precisam de aprovação. A tabela `app_members` autoriza a instalação compartilhada; somente gestor libera/revoga usuários ou altera papéis. O último gestor autorizado não pode ser removido pela aplicação. Escritas diretas nas tabelas operacionais são revogadas para impedir contornar as validações da RPC.
- Autenticação espera perfil e aprovação, descarta respostas antigas e não limpa todo o cache em cada renovação de token. Cadastro com confirmação de e-mail mostra orientação. Consultas paginam com ordem estável e falhas aparecem em aviso.
- `TextField` encaminha `disabled`. Tipos em UTF-8. `check` verifica explicitamente app e configuração; `build` exige verificações e usa modo de produção. Páginas são carregadas sob demanda.

## Antes de substituir

1. Faça backup do banco e mantenha a versão anterior do frontend.
2. Confirme que esta instalação é de **uma única fazenda**, com dados compartilhados entre os seus usuários autorizados. A migração aborta se encontrar mais de um registro em `farms`. Ela substitui as políticas das tabelas listadas; se houver regras personalizadas ou separação por proprietário no Supabase real, compare-as e adapte a migração antes de aplicar. Esta entrega não implementa arquitetura de várias fazendas.
3. Identifique pelo menos um gestor legítimo já cadastrado. A migração libera gestores existentes e deixa operadores sem liberação inicial, para revisão pelo gestor. Revise também quem já possui papel gestor: o arquivo não consegue determinar quais contas são legítimas.
4. Teste em cópia/homologação. O banco usado nesta validação foi local; o estado e os triggers adicionais do Supabase de produção não foram inspecionados.

## Migração no banco existente

Se as tabelas já existem, aplique **somente**:

`supabase/migrations/20261012220000_integrity_and_access.sql`

O arquivo contém `begin`/`commit` e deve ser executado inteiro pelo SQL Editor do Supabase com uma conta administrativa. Não execute novamente as duas migrações base num banco que já tem o schema. Não reaplique esta migração após ela ter sido concluída.

Os arquivos originais foram normalizados para `20261010173428_schema_base.sql` e `20261010173434_enable_rls.sql`. Se você usa Supabase CLI e já possui histórico de versões, confira `supabase migration list` e reconcilie o histórico antes de `db push`: a renomeação não significa que o schema base deva ser executado outra vez. Use o SQL Editor para a atualização isolada caso o histórico esteja fora de sincronia.

Após aplicar a migração, substitua o frontend, entre como gestor e abra **Configurações → Usuários** para liberar os operadores legítimos. Somente depois teste a operação com uma conta operador.

## Instalação em banco novo / recuperação de gestor

Em banco vazio, execute as três migrações na ordem dos nomes. Cadastre sua conta pelo app. Um administrador do Supabase deve então promover e liberar a conta exata. No SQL Editor, troque o e-mail abaixo pelo e-mail confirmado do responsável:

```sql
begin;
do $$
declare selected_user uuid;
begin
  select id into selected_user from auth.users
  where lower(email) = lower('EMAIL_DO_GESTOR');
  if selected_user is null then raise exception 'Conta não encontrada'; end if;
  update public.profiles set role = 'gestor' where id = selected_user;
  insert into public.app_members(user_id, enabled) values(selected_user, true)
  on conflict(user_id) do update set enabled = true;
end $$;
commit;
```

Esse comando só deve ser usado pelo administrador para uma conta verificada. Não há promoção automática de quem se cadastra primeiro na instalação final.

## Instalação local

Requer Node.js 20.19+ ou 22.12+ (testado com Node 24). O ZIP não inclui `node_modules`, `.git`, o `.env` original nem arquivos ZIP redundantes.

```bash
npm ci
npm run check
npm test
npm run test:db
npm run dev
```

Copie `.env.example` para `.env` se precisar configurar analytics/fuso. O cliente Supabase conserva URL e chave pública do projeto original. Não coloque chave `service_role` no frontend. `npm run build` gera `dist/`; o servidor web deve servir `index.html` como fallback das rotas da aplicação.

O fuso padrão é `America/Sao_Paulo`. Se mudar `VITE_FARM_TIME_ZONE`, ajuste também `public.app_today()` no banco para o mesmo fuso. A convenção mantida é liberar carência na data `withdrawal_until` (bloqueio enquanto ela é maior que a data da saída). Verifique essa convenção com as regras da sua operação; o sistema registra datas, não horas de aplicação.

## Dados antigos

As correções evitam novos erros, mas não podem adivinhar quais animais foram vendidos indevidamente antes, o total exato de uma saída antiga de vários óbitos, ou o número original de cabeças que já saiu sem histórico próprio. Na migração, `initial_head_count` é estimado pelo saldo atual mais os eventos de óbito disponíveis; revise esse valor quando tiver os registros reais. Eventos antigos de venda/abate gravados como tratamento e leituras duplicadas são preservados para revisão, não apagados automaticamente. Leituras antigas não têm oferta base: refaça-as antes de aplicar ajuste.

O histórico novo de saídas fica em `public.lot_exits`; a entrega não adiciona uma tela de relatório desse histórico. Tabelas de idempotência mantêm requisições concluídas; planeje retenção conforme o volume, sem remover chaves ainda necessárias para repetição segura.

## Validação

- TypeScript de app e configuração; ESLint: aprovados sem erros ou avisos de lint.
- Compilação de produção Vite: aprovada. Permanecem avisos de bibliotecas sobre `use client` e tamanho de bundle; não impedem a compilação.
- Seis testes aprovados dos módulos reais de datas, números, GMD, mortalidade e carência.
- Banco PostgreSQL descartável com PGlite: schema desde zero, autorização/RLS, proibição de escrita direta, rollback, repetição idempotente, saída parcial, saldo, carência, transferência, pesagens, óbito, composição de dieta, protocolo e aplicação única de cocho.

Os testes não conectam ao Supabase real. O comportamento visual no navegador e a integração com o seu banco implantado devem ser conferidos em homologação antes da publicação. Os tipos do cliente foram ajustados para o contrato da migração; regenere-os a partir do schema efetivamente implantado ao integrar em seu fluxo habitual.
