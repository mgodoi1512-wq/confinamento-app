# Etapa 2.3 — confirmação automática no Sandbox

Pré-requisito: etapa 2.2 instalada e Pix/cartão testados. Esta atualização acrescenta o recebimento de notificações do Asaas e a sincronização automática da cobrança. Mantém os valores configurados, os registros existentes e o acesso manual. Não ativa assinaturas recorrentes, cobrança real, bloqueio financeiro ou modo automático do administrador.

## 1. Arquivos e SQL

Extraia este pacote na raiz do projeto. Não apague o projeto.

No SQL Editor do Supabase usado pelo site, execute todo o arquivo:

`supabase/migrations/20261017030000_sandbox_payment_webhook.sql`

A migração pode ser reaplicada. Acrescenta metadados do webhook e registro dos eventos; preserva os pagamentos existentes. A consulta manual e o webhook passam a utilizar a mesma regra de validação no banco.

## 2. Gere um token exclusivo

No PowerShell do seu computador, execute:

```powershell
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
```

Copie o resultado, sem espaços e sem aspas. Esse é um novo segredo, diferente da API Key do Asaas. Não use o texto do comando como valor. Não envie o resultado por mensagem e não salve no Git.

Em Supabase → Edge Functions → Secrets, crie:

- Nome: `ASAAS_SANDBOX_WEBHOOK_TOKEN`
- Valor: o resultado gerado acima.

Os Secrets `ASAAS_SANDBOX_API_KEY` e as variáveis internas do Supabase são reutilizados. A integração aceita somente a chave Sandbox com prefixo `$aact_hmlg_`. Não habilite operações de saque para este recurso.

## 3. Publique a nova Edge Function

Crie uma nova função pelo editor do Supabase e cole **todo** o conteúdo de:

`instalacao/asaas-sandbox-webhook-editor.txt`

O nome deve ser exatamente:

`asaas-sandbox-webhook`

**Somente nesta nova função**, desative a opção de verificar JWT, que pode aparecer como **Verify JWT** ou **Enforce JWT Verification** nas configurações da função. O Asaas não envia sessão de usuário do Supabase. A função exige o token próprio no cabeçalho `asaas-access-token` e recusa requisições sem ele.

Mantenha a verificação JWT habilitada em `asaas-sandbox-payment` e `asaas-sandbox-check`. Não precisa recriar nem republicar essas duas funções.

Publique a nova função e copie sua URL, que terá este formato:

```text
https://SEU_PROJECT_REF.supabase.co/functions/v1/asaas-sandbox-webhook
```

Use a URL copiada do seu projeto real. Não use o domínio do site nem deixe o texto SEU_PROJECT_REF.

Alternativa pelo terminal, para quem já usa CLI:

```powershell
npx supabase functions deploy asaas-sandbox-webhook --project-ref SEU_PROJECT_REF --no-verify-jwt --use-api
```

O pacote também inclui `instalacao/config-webhook-cli.toml`: acrescente apenas o bloco nele ao seu `supabase/config.toml`, preservando seu project_id e os demais blocos. Esse trecho é para a configuração local da CLI; não substitua seu arquivo inteiro.

## 4. Cadastre no Asaas Sandbox

Entre na conta **Sandbox** do Asaas, no menu **Integrações → Webhooks**. Cadastre um webhook com:

| Campo | Valor |
|---|---|
| Nome | LiBen — pagamentos Sandbox |
| URL | URL exata da função asaas-sandbox-webhook publicada |
| Token de autenticação / authToken | Mesmo valor de ASAAS_SANDBOX_WEBHOOK_TOKEN |
| Ativo | Sim |
| Versão da API, se houver | 3 |
| Tipo de envio | Sequencial / SEQUENTIALLY |
| E-mail de avisos | Seu e-mail de acompanhamento |

Selecione os eventos de cobrança disponíveis correspondentes a:

```text
PAYMENT_CREATED
PAYMENT_UPDATED
PAYMENT_CONFIRMED
PAYMENT_RECEIVED
PAYMENT_OVERDUE
PAYMENT_DELETED
PAYMENT_RESTORED
PAYMENT_REFUNDED
PAYMENT_PARTIALLY_REFUNDED
PAYMENT_REFUND_IN_PROGRESS
PAYMENT_CHARGEBACK_REQUESTED
PAYMENT_CHARGEBACK_DISPUTE
PAYMENT_AWAITING_CHARGEBACK_REVERSAL
PAYMENT_AWAITING_RISK_ANALYSIS
PAYMENT_APPROVED_BY_RISK_ANALYSIS
PAYMENT_REPROVED_BY_RISK_ANALYSIS
PAYMENT_AUTHORIZED
PAYMENT_CREDIT_CARD_CAPTURE_REFUSED
PAYMENT_ANTICIPATED
```

O código também tolera campos adicionais e reconhece eventos não utilizados sem executar mudanças. Não é necessário cadastrar eventos de saque, transferências, boleto ou assinaturas nesta etapa. Salve o webhook no Sandbox, não em Produção.

## 5. Publique o frontend

Execute `npm run build`. Depois envie as alterações pelo Git para a branch integrada à Vercel. Esta publicação não substitui os passos de SQL e Edge Function.

A página **Configurações → Meu plano** consultará o registro no Supabase a cada 5 segundos enquanto estiver aberta em primeiro plano e houver teste não arquivado. Isso não faz consultas periódicas à API do Asaas. Com a página fechada, o webhook continua atualizando o banco. Ao abrir novamente, será mostrado o registro atualizado.

## 6. Faça a homologação

1. Mantenha o modo de cobrança manual no painel administrador.
2. Em Meu plano, encerre o teste concluído anterior e gere uma nova cobrança Pix.
3. Simule o recebimento no painel Sandbox do Asaas.
4. Volte ao site e aguarde a sincronização, sem clicar em Atualizar situação. Deve aparecer o estado recebido, a validade simulada e a linha **Sincronização automática: webhook processado em…**. Essa linha identifica uma notificação processada; o estado financeiro continua sendo mostrado separadamente.
5. Em Asaas → Integrações → Logs de Webhooks, confira o HTTP 200 da entrega. O tempo total depende do envio do Asaas e da sincronização da página.
6. Repita com cartão. Pode reutilizar os dados de homologação testados na etapa anterior.
7. Se o painel oferecer reenvio da mesma notificação, reenvie-a: a validade deve permanecer igual, sem duplicar o evento.
8. Para validar estorno, simule-o somente no Sandbox e confirme a mudança no site. Estornos parciais concluídos são exibidos para conferência; não há regra de prorrateio ou liberação financeira automática nesta etapa.

Pix CONFIRMED aguarda RECEIVED para validar o período. Cartão CONFIRMED ou RECEIVED valida; autorização sem captura e análise de risco não validam. A validade inicial permanece uma única vez por cobrança, sem se estender em cada notificação.

## Falhas e diagnóstico

A notificação é autenticada e registrada no banco. Para uma cobrança conhecida, o receptor consulta seu estado atual diretamente na API Sandbox do Asaas, confere cliente, valor, forma, identificador externo e identificador da cobrança. O estado enviado no corpo da notificação não é usado como confirmação financeira.

Eventos repetidos têm o mesmo identificador e não executam a atualização novamente. Uma reserva com prazo impede processar simultaneamente a mesma entrega; se houver falha, permite retomada. Consultas antigas não sobrescrevem uma mais recente. Uma notificação antiga recebida depois será conferida novamente com o estado atual do Asaas. Atualização do pagamento e conclusão do evento ocorrem na mesma transação.

O processamento é curto e tem orçamento de até 8 segundos no handler. Se a consulta ou gravação falhar, retorna HTTP 503, mantém os metadados para diagnóstico e solicita uma nova entrega ao Asaas; não confirma sucesso antes de gravar. O receptor não cria cobranças, não transfere valores e não faz estornos. Não registra corpos brutos, documentos, cartões, token ou API Key.

| Resultado | Conferir |
|---|---|
| 404 | Nome, URL e publicação de asaas-sandbox-webhook no projeto correto. |
| 401 sem código do handler | Verificação JWT ainda pode estar habilitada na nova função. |
| 401 / WEBHOOK_UNAUTHORIZED | Token configurado no Asaas diferente do Secret. |
| 503 / WEBHOOK_NOT_CONFIGURED | Secret do webhook ausente ou inválido. |
| 503 / SANDBOX_NOT_CONFIGURED | Chave Sandbox ou variáveis internas ausentes/inválidas. |
| 503 / EVENT_RETRY_REQUIRED | Falha temporária de API/banco, migração ausente ou divergência na cobrança. Confira o projeto e tente o reenvio depois de corrigir. |
| 503 / EVENT_IN_PROGRESS | Outra entrega já está processando; permite nova tentativa após a reserva expirar. |
| 200 / EVENT_ALREADY_PROCESSED | Duplicata tratada, sem novo efeito. |
| 200 / UNRELATED_PAYMENT_IGNORED | Cobrança sem vínculo com um teste do LiBen. |

Se a fila do Asaas for interrompida por falhas consecutivas, corrija a causa e reative o envio no painel. Notificações não devem ser consideradas entregues apenas por terem sido geradas. As cobranças anteriores à configuração do webhook podem exigir consulta manual ou reenvio; faça a homologação com uma nova cobrança.

Para diagnóstico no SQL Editor (não expõe documentos ou segredos):

```sql
select event_id, event_type, state, attempts, received_at, processed_at, error_code
from public.billing_sandbox_webhook_events
order by received_at desc
limit 20;
```

## Validação do pacote

Testes locais com respostas simuladas do Asaas; testes PostgreSQL/PGlite para privilégios, isolamento, transações, idempotência, reserva concorrente, retomada e validade; integração com migrações reais nos perfis legados UUID/TEXT; regressão do fluxo manual e diagnóstico de conexão; lint, TypeScript e build. A instalação e a validação conectada à conta do usuário são realizadas depois da entrega. Nenhum deploy foi feito a partir deste ambiente.

## Próxima etapa

Depois da homologação do webhook: recorrência de cartão, política de renovação/atraso/cancelamento e preparação da cobrança de produção. O controle manual/automático no painel continua preservado; esta migração não habilita integration_ready nem muda o modo.

Referências oficiais consultadas em 17/10/2026:
- https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook
- https://docs.asaas.com/docs/criar-novo-webhook-pela-api
- https://docs.asaas.com/docs/webhook-para-cobrancas
- https://docs.asaas.com/docs/faq-de-webhooks
- https://docs.asaas.com/docs/estornos
- https://supabase.com/docs/guides/functions/auth-headers
