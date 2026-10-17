# Registro de trato por períodos

## Escolher quantos e quais tratos

1. Informe quantos tratos haverá hoje: 1, 2 ou 3.
2. Ao alterar essa quantidade, os períodos ficam livres para escolha. Clique nos
   cartões ou marque **Usar hoje** até completar a quantidade informada.
3. O cartão destacado é o trato que está sendo registrado. Clique em outro cartão
   previsto para mudar somente o período atual, sem mudar o planejamento.

Com um único trato, clicar em qualquer cartão muda o período para ele e atribui
100% da quantidade diária. Pode ser apenas manhã, apenas tarde ou apenas noite.
Com dois tratos, qualquer dupla é permitida, inclusive manhã e noite. Se já tiver
escolhido os dois e quiser trocar um deles, desmarque **Usar hoje** naquele que
quer retirar e selecione o outro.

Os percentuais são divididos igualmente entre os períodos escolhidos, fechando
100%. A inclusão ou remoção de um período redistribui as parcelas. O gestor pode
editar os percentuais; para salvar, eles precisam somar 100% e a quantidade de
períodos escolhidos precisa coincidir com a quantidade de tratos informada.

O gestor pode salvar essa configuração como padrão da fazenda. Operadores usam
esse padrão e selecionam o cartão do trato que estão registrando.

## Sem horários

Os cartões mostram somente Manhã, Tarde e Noite. Não há campos de horário nem um
segundo seletor de turno. O histórico também apresenta o período sem a hora
planejada. Horários antigos permanecem preservados no banco; novos registros
usam somente o período. O momento real da gravação continua em created_at.

O primeiro registro continua fixando o planejamento diário. Alterações no padrão
não modificam planos já iniciados; nesses planos é possível selecionar os cartões
dos períodos previstos e concluir os tratos. Planos antigos com horários continuam
compatíveis com a nova tela.

## Cálculo e registro

A fórmula e os bloqueios da atualização anterior são preservados: quantidade
por ingrediente calculada pelo peso vivo médio e percentual da dieta, parcela
por período, ajuste da mistura fornecida, bloqueio de duplicatas e resumo diário.
O fornecimento por ingrediente é um rateio na proporção da dieta, não uma medição
independente do consumo real.

O pacote também preserva o alinhamento das colunas de Trato de hoje e inclui o
Total recomendado na tabela e nos cartões de celular. A tabela utiliza a
recomendação congelada quando houver planejamento diário.

## Instalar

Requer a atualização anterior de planejamento diário já instalada.

1. Extraia os arquivos dentro do projeto e substitua os correspondentes.
2. Execute integralmente, como postgres no Supabase SQL Editor:
   supabase/migrations/20261016030000_feed_periods_only.sql
3. Confira selecao_periodos_instalada = true.
4. Execute npm test, npm run test:tenancy e npm run build.
5. Publique pelo fluxo habitual do Git/Vercel.

Execute somente o novo SQL. Não reaplique o SQL anterior depois dele, porque a
atualização nova ajusta a validação antiga que exigia horários.
Não há novas dependências nem variáveis de ambiente.

Foram testadas todas as sete combinações possíveis de períodos, seleção pelo
cartão, quantidade mínima de escolhas, edição dos percentuais, somente noite,
manhã + noite e continuidade de planos antigos com horários. As verificações de
permissão e de isolamento entre fazendas foram executadas com perfis UUID e TEXT.
Não foi feita inspeção visual em uma sessão de produção.
