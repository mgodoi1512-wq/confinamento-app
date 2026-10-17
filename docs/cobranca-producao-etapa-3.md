# Etapa 3 — Produção e controle de acesso

Este pacote depende das etapas 1 e 2.1–2.4 já instaladas. Ele prepara cobrança real e bloqueio financeiro. **A instalação mantém o modo atual; não ativa cobrança e não cria pagamentos.** Nenhum deploy nem pagamento real foi executado durante a preparação deste pacote.

Valores configurados: R$ 24,90 mensal e R$ 249,90 anual. Confira os valores no painel antes de contratar.

## 1. Arquivos e banco

Faça backup do projeto e banco. Extraia o ZIP na raiz do projeto, mesclando as pastas. O pacote contém somente arquivos desta etapa: preserve `.env`, `.git` e os demais arquivos existentes.

No SQL Editor do Supabase execute somente:

`supabase/migrations/20261017050000_production_billing.sql`

O SQL cria tabelas separadas de produção, mantém as de Sandbox e preserva as liberações manuais já cadastradas. Não execute novamente os SQLs antigos para instalar esta etapa.

## 2. Secrets de produção

No Supabase, Edge Functions → Secrets, adicione:

| Nome | Valor |
|---|---|
| ASAAS_PRODUCTION_API_KEY | Chave da conta REAL Asaas, com prefixo `$aact_prod_` |
| ASAAS_PRODUCTION_WEBHOOK_TOKEN | Novo token exclusivo, diferente do Sandbox |
| APP_ALLOWED_ORIGINS | Origem exata do site; mantenha as origens existentes necessárias |

Exemplo de origem: `https://liben-agro.com`, sem barra final e sem caminho. Se utilizar `www`, cadastre essa origem também, separada por vírgula.

Para gerar um token no PowerShell:

```powershell
[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
```

Copie o resultado para o Secret e para o webhook de produção. Não use a chave da API como token do webhook. Não coloque esses valores no código, Git, Vercel frontend ou mensagens. Preserve as chaves e funções do Sandbox. Não habilite saques para esta integração.

## 3. Quatro novas Edge Functions

Crie as funções com estes nomes exatos. No editor, cole o arquivo correspondente da pasta `instalacao`:

| Função | Arquivo | Verificação JWT |
|---|---|---|
| asaas-production-check | asaas-production-check-editor.txt | Ativada |
| asaas-production-subscription | asaas-production-subscription-editor.txt | Ativada |
| asaas-production-payment | asaas-production-payment-editor.txt | Ativada |
| asaas-production-webhook | asaas-production-webhook-editor.txt | **Desativada** |

Os arquivos `*-editor.txt` já contêm o código completo para colar no editor. Não misture os arquivos das funções. O webhook valida seu token próprio; as demais exigem sessão de usuário.

Alternativa por CLI, já vinculada ao seu projeto:

```bash
supabase functions deploy asaas-production-check
supabase functions deploy asaas-production-subscription
supabase functions deploy asaas-production-payment
supabase functions deploy asaas-production-webhook --no-verify-jwt
```

Se mantiver a configuração em arquivo, acrescente o bloco de `instalacao/config-production-webhook-cli.toml` ao seu `supabase/config.toml`, preservando o conteúdo existente e seu project_id.

## 4. Webhook na conta REAL Asaas

Crie um novo webhook na conta de produção, mantendo o de Sandbox separado:

- URL: `https://SEU-PROJETO.supabase.co/functions/v1/asaas-production-webhook`
- Token: o mesmo `ASAAS_PRODUCTION_WEBHOOK_TOKEN`.
- Webhook e fila de sincronização ativados, fila sem interrupção, envio sequencial.
- Eventos de pagamento: PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED, PAYMENT_REFUND_IN_PROGRESS, PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_CHARGEBACK_DISPUTE, PAYMENT_AWAITING_CHARGEBACK_REVERSAL.
- Eventos de assinatura: SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_INACTIVATED, SUBSCRIPTION_DELETED.

A conta Asaas deve estar aprovada. A chave deve permitir as operações utilizadas de clientes, assinaturas e cobranças e a leitura de situação da conta e webhooks. Não é necessário permitir saques, transferências, pagamento de contas ou recargas.

## 5. Publicar o frontend

No terminal do projeto:

```bash
npm run build
git status
```

Revise os arquivos antes de enviar. Se o projeto já estiver ligado ao Git/Vercel, adicione os arquivos desta etapa, faça commit e push pela branch de produção habitual. O Vercel fará o deploy conforme sua configuração existente. Não adicione Secrets ou `.env` ao Git.

## 6. Verificar sem ativar

No painel administrador → Cobrança:

1. Confira os preços e mantenha Liberação manual.
2. Clique em **Verificar produção**.
3. O diagnóstico consulta a conta aprovada e o webhook configurado e verifica a autenticação do receptor. Não cria cobrança e não muda o modo.

A verificação vale por uma hora para ativar o modo automático. Caso expire, verifique novamente. Uma conexão válida não comprova, sozinha, que o Asaas enviará corretamente um pagamento: a ativação também exige confirmação real pelo webhook.

## 7. Contratação real controlada

Depois da verificação, o administrador proprietário de fazenda pode abrir **Contratação real controlada**. A página Meu plano estará identificada como produção.

**Esta etapa é uma assinatura real.** Confira o valor e escolha conscientemente se deseja efetuar esse teste. Não use cartão fictício do Sandbox. Informe seus dados reais no fluxo apropriado; os dados do cartão são preenchidos no checkout hospedado pelo Asaas.

- Pix: gere a cobrança e pague pelo banco. Criar QR Code não libera acesso; a liberação exige pagamento recebido e verificado.
- Cartão: finalize o pagamento no checkout. O valor da contratação é real e a assinatura prevê renovações.
- Aguarde a confirmação do webhook: o painel mostrará “Pagamento real por webhook: Verificado”.
- Se o contrato for somente para teste, cancele a renovação em Meu plano após verificar. Cancelamento não estorna o pagamento já realizado.

A conta administradora mantém seu acesso. O teste pode ser feito ainda no modo manual. O sistema não faz essa contratação sozinho.

## 8. Ativar quando estiver pronto

Com a conexão recente e o pagamento por webhook verificado, clique em **Ativar cobrança automática** e confirme no diálogo.

As fazendas com liberação manual preservada continuam liberadas. Para exigir pagamento de uma fazenda específica, use **Gerenciar acesso** e retire a liberação manual; confira também se há cortesia vigente. O modo automático não cancela nem altera autorizações administrativas de suspensão ou recusa.

## Regras do acesso

| Situação | Resultado |
|---|---|
| Modo manual + usuário aprovado | Acesso conforme aprovação e vínculo |
| Modo automático + pagamento real válido | Acesso durante o período pago |
| Primeira contratação sem pagamento | Sem acesso operacional; pode contratar em Meu plano |
| Renovação vencida | Até 3 dias de tolerância para contrato ativo |
| Renovação além da tolerância | Bloqueio operacional até regularização |
| Cortesia vigente ou liberação manual | Acesso preservado para cadastro aprovado |
| Usuário suspenso, recusado ou vínculo desabilitado | Pagamento não remove o bloqueio administrativo |
| Equipe com vínculo habilitado | Segue o acesso financeiro da fazenda; não contrata plano individual |
| Cancelamento | Para renovações, mantendo período já pago válido |
| Estorno/contestação do período vigente | Reavalia a liberação financeira desse período |

Novos proprietários com e-mail confirmado podem cadastrar a fazenda e contratar no modo automático. A aprovação por pagamento só se aplica ao cadastro comum pendente elegível; nunca reativa usuário suspenso/recusado ou vínculo desabilitado.

O bloqueio também é aplicado no banco, às leituras e gravações. A tela pode refletir a alteração na próxima atualização de sessão; Meu plano consulta o pagamento a cada 5 segundos enquanto necessário. O proprietário continua conseguindo consultar e cancelar sua assinatura mesmo com acesso operacional bloqueado.

Ao recontratar antes do fim de um período pago, a cobertura anterior é preservada. A data inicial é apresentada. No cartão, o checkout do Asaas pode capturar a primeira cobrança imediatamente mesmo com vencimento futuro; observe o aviso antes de confirmar.

Voltar ao modo manual ou conceder cortesia **não cancela assinaturas no Asaas**. Cancele a renovação separadamente quando esse for o objetivo.

## Validação feita no pacote

- Build do frontend e verificação TypeScript estrita dos quatro handlers.
- 20 testes de diagnóstico/contratação e 33 de webhook produtivo, com provedor simulado.
- 92 testes de regressão das funções Sandbox.
- Integração SQL em PostgreSQL local PGlite com IDs UUID e TEXT legados: acesso por proprietário/equipe, RLS, pagamento, tolerância, cortesia, suspensão, cadastro novo, isolamento Sandbox e reaplicação da migration.

Esses testes não substituem a verificação na sua conta de produção. Nenhum dado, Secret ou cobrança real foi utilizado nos testes.

Referências oficiais: https://docs.asaas.com/docs/ambientes ; https://docs.asaas.com/docs/webhooks ; https://docs.asaas.com/reference/listar-webhooks
