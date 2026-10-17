# Etapa 2.4 — assinaturas e renovação no Sandbox

Pré-requisitos: etapas 2.2/2.3 instaladas, pagamento e webhook testados. Este pacote preserva os registros anteriores e acrescenta recorrência, cancelamento e simulação de vencimento. O acesso da fazenda continua manual; não ativa cobrança de produção nem bloqueia usuários.

## Comportamento

- **Mensal:** valor configurado no painel, inicialmente R$ 24,90, a cada mês.
- **Anual:** valor configurado no painel, inicialmente R$ 249,90, a cada ano, sem parcelamento.
- **Cartão:** o titular preenche a primeira fatura hospedada no Asaas. O Asaas utiliza o cartão da assinatura nas próximas tentativas nos vencimentos. O LiBen não recebe número, validade, CVV ou token do cartão.
- **Pix:** o Asaas gera novas cobranças da recorrência; cada uma precisa ser paga pelo usuário. Não há débito via Pix Automático.
- **Cancelamento:** encerra a recorrência no Asaas e remove as faturas pendentes/vencidas vinculadas, preservando as já pagas. Não faz estorno. A tela só informa cancelamento concluído após confirmação do provedor.
- **Tolerância:** 3 dias após o fim de um período pago, somente nas renovações de assinatura ativa. Não concede teste grátis antes do primeiro pagamento. É uma simulação, sem mudar o acesso atual.

A situação da assinatura (renovação ativa/pausada/cancelada) é separada da situação financeira (aguardando primeiro pagamento/período pago/em tolerância/período encerrado). Criar uma assinatura ACTIVE não comprova pagamento.

## Instalação, nesta ordem

### 1. Arquivos e SQL

Extraia o ZIP na raiz do projeto, onde está package.json, substituindo os arquivos correspondentes. Não apague o restante do projeto.

No SQL Editor do Supabase usado pelo site, execute todo:

`supabase/migrations/20261017040000_sandbox_subscriptions.sql`

A migração pode ser reaplicada. Preserva preços, dados anteriores e modo manual. As funções de autorização do rebanho não são modificadas.

### 2. Funções do Supabase

Utilize os arquivos prontos para colar integralmente em index.ts:

| Função | Ação | Arquivo para o editor | Verificação JWT |
|---|---|---|---|
| asaas-sandbox-subscription | Criar e publicar nova função | instalacao/asaas-sandbox-subscription-editor.txt | Habilitada |
| asaas-sandbox-payment | Substituir código e republicar | instalacao/asaas-sandbox-payment-editor.txt | Habilitada |
| asaas-sandbox-webhook | Substituir código e republicar | instalacao/asaas-sandbox-webhook-editor.txt | Desabilitada |

Não exclua nem altere asaas-sandbox-check. A atualização de payment permite consultar as cobranças da recorrência; a de webhook reconhece cada novo ciclo e alterações da assinatura.

Reutilize os Secrets existentes: ASAAS_SANDBOX_API_KEY, ASAAS_SANDBOX_WEBHOOK_TOKEN e APP_ALLOWED_ORIGINS. Não gere outro token, não altere a URL do webhook já cadastrado e não use chave de produção. Se a API recusar criar/consultar assinaturas, confira as permissões da chave para Assinaturas e Cobranças; não é necessário habilitar saques.

Alternativa para quem já usa CLI:

```powershell
npx supabase functions deploy asaas-sandbox-subscription --project-ref SEU_PROJECT_REF --use-api
npx supabase functions deploy asaas-sandbox-payment --project-ref SEU_PROJECT_REF --use-api
npx supabase functions deploy asaas-sandbox-webhook --project-ref SEU_PROJECT_REF --no-verify-jwt --use-api
```

Substitua SEU_PROJECT_REF pelo identificador do seu projeto. Somente o webhook externo usa autenticação pelo token próprio em vez do JWT do usuário.

### 3. Mais quatro eventos no Asaas Sandbox

Edite o webhook existente. Mantenha todos os eventos de **Cobranças** já marcados e acrescente na categoria **Assinaturas**:

```text
SUBSCRIPTION_CREATED
SUBSCRIPTION_UPDATED
SUBSCRIPTION_INACTIVATED
SUBSCRIPTION_DELETED
```

Mantenha o token, a URL, a fila ativa e o envio sequencial. Não marque Pix Automático nem transferências.

### 4. Frontend

Execute `npm run build` e publique pelo Git integrado à Vercel. O deploy do frontend não executa o SQL nem publica as funções do Supabase.

A atualização conserva o intervalo de 5 segundos e as seleções mensal/anual alinhadas na base dos cartões. A página mostra a assinatura, o próximo vencimento conhecido e as faturas por período.

## Teste da nova assinatura

1. Entre com o administrador titular da fazenda aprovada. Os testes permanecem restritos a esse perfil.
2. Em Meu plano, encerre o teste avulso anterior, caso ele ainda esteja aberto. Se estiver pendente, conclua a simulação do pagamento no Asaas e depois encerre o teste avulso.
3. Escolha mensal ou anual, Pix ou cartão e os dados fictícios do pagador. Marque a autorização de recorrência de teste e clique em **Criar assinatura de teste**.
4. As faturas aparecem na lista após serem geradas pelo Asaas; não são todas criadas antecipadamente. Abra o pagamento da primeira fatura.
5. Para cartão, use os dados oficiais de homologação: `4444 4444 4444 4444`, CVV `123`, validade futura e titular fictício. Os dados são preenchidos na página do Asaas.
6. Para Pix, simule o recebimento no painel Sandbox. Não pague QR Code de teste em banco real.
7. Aguarde a atualização por webhook. Deve aparecer o estado financeiro e a cobertura do período. Atualizar situação/Consultar assinatura continuam disponíveis para conciliação explícita.
8. Teste **Cancelar renovação** e confirme na janela. Deve aparecer Renovação cancelada; pagamentos já recebidos permanecem no histórico e os pendentes são removidos. Se houver falha de conexão, a tela mostra Cancelamento em conferência; repita a conferência, sem criar outra assinatura no Asaas.
9. Cancele as assinaturas de teste ao terminar para não acumular novas cobranças fictícias. Para experimentar outro plano, pode iniciar uma nova assinatura depois do cancelamento. Cada nova assinatura Sandbox inicia sua própria simulação; não implementa migração com crédito/prorrateio entre planos.

## Como validar os próximos ciclos

A geração e a tentativa de cobrança são feitas pelo Asaas, não por cron no LiBen. O pagamento de cada ciclo tem um novo identificador e é importado pelo webhook. Para homologar uma renovação futura, acompanhe a próxima cobrança gerada no Sandbox. Não é necessário pagar todas as faturas para cadastrar a assinatura, mas o pagamento é necessário para validar o período financeiro.

Não altere datas ou valores diretamente no banco para simular uma renovação. A mudança manual no Asaas de datas já geradas pode exigir revisão, pois os períodos de cobranças já importadas ficam preservados. A passagem do tempo e a tolerância foram verificadas nos testes locais com relógio controlado; não há botão no site que invente um pagamento ou libere acesso.

Na validação financeira:

- Cada cobrança paga cobre o período iniciado no vencimento dela, até o próximo aniversário mensal/anual. O fim é exclusivo: a data de fim também é a data prevista para iniciar o próximo período.
- Pagamento antecipado não antecipa o início de um período futuro. Pagamento em atraso cobre o período original, sem reiniciar a contagem na data em que foi confirmado.
- Os vencimentos de fim de mês preservam o dia de referência, com ajuste para meses curtos; anos bissextos também são tratados.
- Pix exige RECEIVED; cartão aceita CONFIRMED ou RECEIVED. Autorizações sem captura não validam.
- Consultas e eventos repetidos não somam mais meses/anos. Estornos concluídos e contestações deixam de contar como cobertura paga; estorno parcial requer conferência, sem prorrateio automático.
- Se um período termina em 28/02, a tolerância de 3 dias vai de 28/02 até antes de 03/03 em ano não bissexto. No dia 03/03, sem nova cobertura, a simulação fica encerrada. Cancelamento não concede tolerância adicional.

## Segurança e recuperação

Um único contrato não cancelado por fazenda é permitido. O banco fornece preço, titular e vínculo; o navegador não escolhe a fazenda nem informa o valor. Alterar preços no painel não modifica silenciosamente o contrato já criado; ele preserva seu valor contratado. Troca de plano e prorrateio ficam fora desta etapa.

Uma resposta perdida não dispara automaticamente outro POST de assinatura. Consultar assinatura busca o contrato existente por identificador/referência. Se a criação não puder ser confirmada, mantém o registro em conferência para revisão no Sandbox antes de qualquer nova tentativa. Não remova reservas diretamente sem verificar se o contrato foi criado.

O webhook autentica pelo Secret existente e consulta a API Sandbox. As renovações são vinculadas pelo identificador da assinatura retornado pelo provedor, além de cliente, valor e método; não depende de a cobrança herdar o externalReference da assinatura. Estados antigos e eventos repetidos não estendem a validade. O registro do evento e a atualização financeira são transacionais.

Uma assinatura removida nunca é reativada localmente por uma resposta antiga. A confirmação da remoção pode vir da resposta ao cancelamento ou de consulta à API após notificação autenticada. Quando uma fatura removida ainda não tinha sido importada, a entrega é concluída sem criar uma fatura fictícia.

## Diagnóstico

- 404 na nova função: confira nome asaas-sandbox-subscription, projeto e publicação.
- 401 na função de assinatura: entre novamente e mantenha JWT habilitado; ela exige sessão de usuário.
- 401 no webhook: confira JWT desabilitado somente nele e o token próprio.
- Assinatura em conferência: use Consultar assinatura. Não repita a criação manual no Asaas.
- Valor/método divergente: confira se o contrato foi alterado fora do site. Não aplica confirmação divergente.
- Cancelamento em conferência: não foi possível confirmar a remoção. A nova contratação fica bloqueada até resolver, evitando duas recorrências ativas.
- Próximo vencimento: prioriza a fatura pendente mais antiga conhecida; quando não há fatura pendente, usa a próxima data informada pela assinatura no Asaas. A conciliação manual é paginada, com limite de 1.000 cobranças por consulta nesta versão; o webhook processa os ciclos individualmente.

Os registros billing_sandbox_subscriptions, billing_sandbox_orders e billing_sandbox_webhook_events podem ser inspecionados pelo SQL Editor administrativo. Não compartilhe chaves ou corpos de requisições com credenciais.

## Validação entregue

Build/lint/TypeScript; testes de handlers com API simulada; testes SQL para recorrência, idempotência, períodos, tolerância, cancelamento e isolamento; regressão dos pagamentos avulsos/webhooks; compatibilidade com as migrações reais em esquemas UUID e TEXT. Não foi executado deploy nem operação conectada à conta do usuário a partir deste ambiente.

Após a homologação desta etapa, ainda falta preparar a produção e a autorização financeira no banco para ativar o modo automático pelo painel. O controle manual/automático existente permanece preservado e desativado para cobrança real.

Referências oficiais consultadas em 17/10/2026:
- https://docs.asaas.com/reference/criar-nova-assinatura
- https://docs.asaas.com/docs/faq-assinaturas
- https://central.ajuda.asaas.com/hc/pt-br/articles/54672181332379-Quais-s%C3%A3o-as-formas-de-pagamento-dispon%C3%ADveis-para-cobran%C3%A7as-por-assinatura
- https://docs.asaas.com/reference/remover-assinatura
- https://docs.asaas.com/docs/eventos-para-assinaturas
- https://docs.asaas.com/reference/listar-cobrancas-de-uma-assinatura
