# Registro de trato com planejamento diário

A tela continua abrindo no botão **Registrar trato**, em `/trato`. O formulário
mostra o dia no cocho, a dieta, os ingredientes e os totais do dia, com layout para
PC e celular. Não é necessário acessar uma nova rota.

## Planejar

O padrão inicial é três tratos: manhã às 08:00 (33,33%), tarde às 14:00 (33,33%) e
noite às 18:00 (33,34%). A diferença de 0,01 ponto percentual fecha 100%.

O gestor pode escolher de um a três tratos, alterar horários e percentuais e
salvar o padrão para a fazenda. Os turnos com zero não são previstos. Os horários
ativos devem estar em ordem no mesmo dia e as parcelas devem somar 100%.
Operadores usam o padrão definido pelo gestor. Um plano já iniciado pode ser
continuado por operadores mesmo que o gestor tenha personalizado seus horários.

O planejamento é por lote e data. No primeiro registro, o servidor consulta a
dieta e o peso e calcula as quantidades. Antes de salvar, verifica se a referência
mostrada na tela ainda corresponde a esses dados. Então fixa dieta, nome,
ingredientes, peso, quantidade de animais de referência, horários e quantidade
diária. Alterações posteriores não recalculam essa referência histórica.

Ao iniciar outro dia, um novo plano será criado com a dieta escolhida, o peso
atual e o padrão de horários vigente. O registro não muda automaticamente a dieta
vinculada no cadastro do lote.

## Calcular e registrar

- Ingrediente percentual: peso vivo médio × % PV ÷ 100 = kg/cabeça/dia.
- Ingrediente em kg: usa a quantidade fixa cadastrada.
- Referência de peso: última pesagem válida do lote até hoje; sem pesagem, peso
  médio de entrada. Não multiplica pela matéria seca.
- Parcela do trato: mistura diária por cabeça × percentual daquele turno ÷ 100.
- A sugestão é arredondada para três casas decimais em kg/cabeça.
- Total do registro: kg/cabeça realmente informados × animais atuais do lote,
  arredondado para duas casas decimais. Pequenas diferenças entre a soma dos
  turnos e a referência podem ocorrer por arredondamento.

Exemplo: 10 animais de 400 kg, ração 0,3% PV e volumoso 3% PV. Referência diária:
1,2 kg de ração + 12 kg de volumoso = 13,2 kg por cabeça, 132 kg no lote.
Cada um dos três tratos semelhantes sugere 4,4 kg por cabeça e 44 kg no lote.

A mistura fornecida pode ser ajustada. O formulário e o registro guardam o rateio
por ingrediente, mantendo a proporção da dieta. Isso representa uma composição
calculada; não mede ingredientes pesados separadamente ou ingestão real.

Ao registrar, a tela permanece aberta e seleciona o próximo turno pendente.
Ela mostra previsto, já fornecido e restante. Excesso aparece explicitamente.
Horário salvo é o horário planejado; `created_at` registra o momento da gravação.
Não há disparo automático de tratos ou notificações no horário agendado.

## Proteções e acompanhamento

O banco impede duplicatas do mesmo lote/data/turno, inclusive por aba antiga.
Repetir uma requisição após falha de rede devolve o mesmo registro. Um erro
reverte a criação do plano e do registro na mesma transação.

A tabela Trato de hoje utiliza a referência fixa quando existir um plano. A
bolinha fica verde somente quando todos os lotes previstos para o turno possuem
registro positivo. Turnos não previstos ficam cinza. A barra usa o fornecimento
total da mistura do curral e a soma das recomendações diárias dos lotes.

Alterações no saldo de animais não mudam a referência diária fixada. Os próximos
registros usam o saldo atual, explicitado na tela. Se o lote for transferido de
curral após o primeiro trato, o servidor pede revisão pelo gestor; não move o
planejamento automaticamente.

Uma dieta inativada depois do primeiro registro continua disponível apenas para
concluir o plano já fixado. O cadastro original não pode ser apagado enquanto
houver plano referenciando-o; prefira inativar. Novos planos exigem dieta ativa.

Excluir um trato no histórico libera aquele turno, preservando o planejamento
fixado. Aplicações vinculadas a leitura de cocho mantêm sua restrição anterior de
exclusão. Registros antigos não são excluídos nem divididos automaticamente.

Se já existirem tratos de hoje com a mesma dieta e quantidade de animais, o novo
planejamento pode continuar pelos turnos pendentes. Tratos sem lote, com dieta
diferente ou outro saldo precisam de revisão; a tela informa a incompatibilidade.
O planejamento pode ser iniciado normalmente no próximo dia. Não remova um
registro real apenas para contornar a validação.

Depois de iniciado o plano, use este formulário para os turnos restantes. O
botão antigo de aplicação automática de leitura de cocho não escreve por cima do
planejamento: retorna uma orientação para registrar pelo formulário novo.

## Instalar

1. Copie os arquivos deste pacote para o projeto atualizado.
2. Execute **integralmente**, como `postgres`, no SQL Editor do Supabase:
   `supabase/migrations/20261016020000_daily_feed_plans.sql`.
3. Confira `planejamento_trato_instalado = true`. Não reaplique migrações antigas.
4. Execute `npm test`, `npm run test:tenancy` e `npm run build`.
5. Publique os arquivos pelo Git/Vercel e aguarde o deploy ficar Ready.

Não há novas variáveis de ambiente ou dependências. Os dados são isolados por
fazenda, com escrita via funções e leitura protegida por RLS. Nenhum SQL foi
aplicado no banco de produção por esta entrega.

## Verificação

Os testes cobrem cálculos diários e por turno, um a três horários, proporções,
plano fixado após alterar peso/dieta, edição da oferta, validações, duplicatas,
idempotência, reversão de erros, exclusão, operadores, gestores e isolamento
entre fazendas. Testes do banco passam com os perfis legados UUID e TEXT, mesmo
sem USAGE do executor no schema auth. Build, TypeScript e ESLint foram validados.
Não foi feita inspeção visual em navegador autenticado de produção.
