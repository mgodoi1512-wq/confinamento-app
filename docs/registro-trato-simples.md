# Registro de trato simplificado

O formulário tem duas escolhas: **Quantos tratos hoje?** (1, 2 ou 3) e o cartão
**Manhã, Tarde ou Noite** do trato que está sendo fornecido agora.
Não há checkbox Usar hoje, edição de percentuais ou horários.

O cartão destacado representa o período atual. Os períodos são livres: um único
trato pode ser à noite; dois tratos podem ser manhã e noite. É possível escolher
qualquer período ainda não utilizado, até atingir o número de tratos do dia.

A sugestão por animal é a mistura diária dividida pela quantidade de tratos:
100% para um, 50% para dois e aproximadamente 33,33% para três. O detalhamento
continua mostrando ração e volumoso por animal e para o lote. A oferta realmente
fornecida continua editável, preservando o rateio na proporção da dieta.

O servidor bloqueia períodos repetidos e novos registros depois de completar a
quantidade fixada. A primeira gravação fixa dieta, peso de referência, quantidade
de tratos e total diário. Operadores também podem escolher a quantidade de
tratos daquele lote/dia antes da primeira gravação, sem alterar o padrão geral
da fazenda. A quantidade não pode ser alterada depois do primeiro registro.

Peso vivo de referência e número de animais aparecem em blocos marrons com
cadeado. São dados calculados, sem caixas de texto editáveis, tanto no tema
claro quanto no escuro. Para mudá-los, é necessário usar o cadastro/pesagens do
lote; o formulário de trato não altera esses dados.

## Planos e registros anteriores

Referências e registros existentes são preservados. Para planos antigos, a
quantidade de tratos é recuperada do número de períodos previstos, considerando
também períodos já fornecidos. Os períodos futuros deixam de ser predefinidos.
A sugestão passa a ser a divisão igual pelo número de tratos. Se antes havia
percentuais diferentes entre os turnos, confira o restante do dia e ajuste a
oferta realmente fornecida quando necessário. Não há exclusão de registros.

Na tabela Trato de hoje, um período não utilizado fica cinza após completar a
quantidade do dia. Enquanto ainda faltarem tratos, os períodos disponíveis
continuam pendentes. Cada lote conserva seu próprio limite de registros.

## Instalar

1. Extraia os arquivos dentro do projeto já atualizado e substitua os existentes.
2. Execute integralmente como postgres no Supabase SQL Editor:
   supabase/migrations/20261016040000_flexible_daily_feed_count.sql
3. Confira registro_simplificado_instalado = true.
4. Execute npm test, npm run test:tenancy e npm run build.
5. Publique pelo fluxo habitual de Git/Vercel.

Não reaplique migrações anteriores depois dessa atualização. Não há novas
variáveis de ambiente ou dependências. O pacote pressupõe as atualizações
anteriores de planejamento diário e escolha de períodos instaladas.

Foram validados: divisão diária, escolha livre do período, somente noite,
manhã e noite, limite de registros no banco, duplicatas, quantidade fixada,
idempotência, referência bloqueada e isolamento entre fazendas com perfis UUID
e TEXT. Build, TypeScript e ESLint passaram. A entrega não foi aplicada no
Supabase de produção nem publicada automaticamente.
