# LiBen - controle administrativo de cobrança, etapa 1

## O que esta atualização entrega

A Administração do sistema passa a ter as abas Cadastros, Cobrança e Relatos beta.
Somente o administrador da plataforma pode consultar e alterar os controles de cobrança.

Na aba Cobrança:

- Acesso manual continua ativo por padrão.
- A opção Com cobrança aparece como preparação, com ativação bloqueada na interface e no servidor.
- Os preços de lançamento começam em R$ 24,90/mês e R$ 249,90/ano por fazenda.
- É possível alterar e salvar os preços, sem criar cobranças ou planos no Asaas.
- A lista de fazendas mostra proprietário, situação da conta, preservação de acesso e cortesia.
- É possível cadastrar ou encerrar uma cortesia, com prazo opcional, sem reativar usuários ou fazendas suspensos.
- As alterações de preços e cortesias são registradas na auditoria administrativa.

Nenhum pagamento real é criado ou processado nesta etapa. Não há pedido de cartão, chave Asaas ou alteração do acesso dos usuários.

## Preservação dos acessos existentes

Na primeira instalação, as fazendas já cadastradas recebem o indicador de acesso manual preservado.
Ele registra quais fazendas devem ficar fora de uma futura migração automática para cobrança.
Reaplicar o SQL não concede essa condição a fazendas criadas posteriormente.

Uma cortesia é uma condição financeira preparada para o futuro. Ela não é aprovação de cadastro.
Suspensão, recusa, aprovação e vínculo de equipe continuam seguindo os controles atuais.
Encerrar uma cortesia de fazenda com acesso manual preservado não remove essa preservação.

Nesta etapa, cadastrar ou vencer uma cortesia não restringe o uso: o modo da plataforma permanece manual.
Fazendas novas também usam o fluxo manual atual enquanto a cobrança não estiver implementada.

## Instalação

1. No Supabase do LiBen, abra SQL Editor > New query.
2. Cole e execute o conteúdo INTEIRO de:
   `supabase/migrations/20261017010000_platform_billing_controls.sql`
3. Copie a pasta src do pacote para o projeto, mantendo os caminhos e substituindo os arquivos correspondentes.
4. Execute `npm run build` no projeto local.
5. Publique pelo Git:

```bash
git add src/components/app/billing-admin.tsx src/lib/billing.ts src/pages/admin/index.tsx supabase/migrations/20261017010000_platform_billing_controls.sql
git add -f src/integrations/supabase/types.ts
git commit -m "Adiciona controles administrativos de cobranca em modo manual"
git push
```

O arquivo de tipos é necessário para o novo RPC. O Supabase não executa a migração automaticamente porque ela foi enviada ao Git/Vercel; o passo SQL acima continua necessário nesse fluxo.

Se o SQL não estiver instalado, a aba Cobrança mostra uma mensagem de erro e opção de tentar novamente. A aba Cadastros permanece disponível para a aprovação manual.

## Como conferir

- Entre com a conta administrativa e abra Configurações > Administração do sistema > Cobrança.
- Confira a indicação Acesso manual ativo e os preços de lançamento.
- A opção automática deve estar bloqueada.
- Cadastre uma cortesia de teste e confira o retorno na lista.
- Verifique que uma conta suspensa continua suspensa, mesmo com cortesia cadastrada.
- Verifique que gestores e operadores comuns não veem os controles administrativos.

## Próxima etapa: integração Asaas no Sandbox

A etapa seguinte ainda precisará implementar:

1. Conta Sandbox e credenciais salvas somente no servidor.
2. Vínculo do proprietário/fazenda com cliente e assinatura no Asaas.
3. Página Meu plano e checkout para cartão e Pix comum.
4. Recepção autenticada de webhooks e consulta de confirmação à API.
5. Tratamento de eventos repetidos, fora de ordem, atrasos, renovação, estornos e cancelamento.
6. Reconciliação periódica entre cobranças no provedor e validade do acesso no LiBen.
7. Controle de acesso financeiro no banco, preservando aprovação, suspensão, vínculos e regras por fazenda.
8. Ativação administrativa com regras explícitas para clientes novos e fazendas antigas.

Não marque a integração como pronta via SQL: a função desta etapa recusa o modo automático mesmo que o campo interno seja alterado.
Desligar a exigência de pagamento no LiBen não cancela assinaturas ou cobranças já autorizadas no Asaas. Esse comportamento precisa de uma operação separada na integração.

## Verificação realizada

- Compilação de produção, lint e TypeScript.
- Testes locais com as migrações do projeto em PostgreSQL embarcado (PGlite).
- Compatibilidade de perfis UUID e TEXT.
- Exclusividade administrativa, ausência de escrita direta, preços em centavos e controle de alterações concorrentes.
- Repetição de operações sem duplicar alterações, cortesias e preservação de fazendas existentes.
- Suspensão continua sendo respeitada; a função de autorização atual não foi alterada.

A conta Asaas, a instalação do SQL e o deploy de produção do usuário não foram acessados ou alterados.
