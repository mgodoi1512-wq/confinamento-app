# LiBen — Etapa 2.1: conexão Asaas Sandbox

Esta é a primeira parte da etapa 2. Ela adiciona um teste administrativo de conexão com o Asaas Sandbox. Não entrega ainda checkout, assinatura, webhook, reconciliação ou restrição financeira de acesso. O modo manual e o bloqueio da ativação automática da etapa 1 permanecem.

O teste usa uma consulta de clientes limitada a um registro para verificar se a API aceita a chave. Nenhum cliente é criado ou alterado. A resposta pública informa apenas sucesso, ambiente e horário; dados de clientes e a chave não são devolvidos nem registrados em logs.

## 1. Gerar a chave no Asaas Sandbox

1. Entre em https://sandbox.asaas.com/ com a conta de testes criada.
2. Abra o menu do usuário > Integrações > Chaves API > Gerar chave de API.
3. Dê um nome, como LiBen Sandbox.
4. Guarde a chave diretamente no gerenciador de segredos abaixo. Chaves novas de Sandbox começam com `$aact_hmlg_`.

Não envie a chave pelo chat, não a coloque no código, no Git, em campo da plataforma ou em variável `VITE_`. A chave é mostrada uma única vez no Asaas.

## 2. Configurar os Secrets no Supabase

No mesmo projeto Supabase usado pelo site, abra Edge Functions > Secrets. Cadastre:

| Nome | Valor |
| --- | --- |
| `ASAAS_SANDBOX_API_KEY` | A chave de Sandbox do Asaas |
| `APP_ALLOWED_ORIGINS` | `https://liben-agro.com,https://www.liben-agro.com,http://localhost:8080` |

Na segunda linha, mantenha somente as origens usadas pelo seu site. Use protocolo e host, sem caminho e sem barra final. Se testar por um endereço Vercel de preview, acrescente essa origem completa à lista, separada por vírgula. Não use `*`. Se o navegador usar outra porta local, cadastre a origem real correspondente.

A função usa `SUPABASE_URL` e `SUPABASE_ANON_KEY`, fornecidas pelo próprio ambiente Edge Functions. Não precisa de service_role. Não cadastre a chave Asaas na Vercel: ela é lida exclusivamente pela função do Supabase.

## 3. Publicar a Edge Function — escolha uma das opções

### Pelo painel Supabase (sem instalar CLI)

1. Abra Edge Functions > Deploy a new function > Via Editor.
2. Escolha a função inicial Hello World e use o nome exato `asaas-sandbox-check`.
3. Substitua TODO o conteúdo do editor pelo conteúdo INTEIRO de `instalacao/asaas-sandbox-check-editor.txt` deste pacote.
4. Publique a função. Mantenha a verificação JWT habilitada. O código também valida a sessão e o administrador no servidor.

O arquivo do editor já reúne o handler e a inicialização; não precisa criar outros arquivos nessa opção.

### Pelo terminal do VS Code

Copie primeiro a pasta `supabase/functions/asaas-sandbox-check` do pacote para o projeto. Na raiz do projeto:

```powershell
npx supabase login
npx supabase functions deploy asaas-sandbox-check --project-ref SEU_PROJECT_REF --use-api
```

Substitua `SEU_PROJECT_REF` pelo identificador do projeto correto do Supabase. Ele aparece no endereço `https://SEU_PROJECT_REF.supabase.co` usado pelo site e nas configurações do projeto. Não dependa do project_id antigo do config.toml. O parâmetro explícito evita publicar em outro projeto.

Não use `--no-verify-jwt`. O deploy por API dispensa Docker. O login da CLI é feito no seu computador; não é necessário enviar tokens pelo chat.

## 4. Atualizar o frontend e publicar na Vercel

Copie os dois arquivos `src/components/app/billing-admin.tsx` e `src/lib/billing.ts` para os mesmos caminhos no projeto.

```powershell
npm run build
```

Se concluir sem erros:

```powershell
git add src/components/app/billing-admin.tsx src/lib/billing.ts supabase/functions/asaas-sandbox-check
git commit -m "Adiciona teste seguro de conexao Asaas Sandbox"
git push origin main
```

A publicação da Vercel atualiza a interface. Ela NÃO publica a Edge Function: a etapa 3 é separada e necessária. Nenhum SQL novo é necessário para este pacote; a etapa 1 e as migrações de acesso anteriores devem estar instaladas.

## 5. Conferir pelo LiBen

1. Entre com a conta administrativa.
2. Abra Configurações > Administração do sistema > Cobrança.
3. Clique em Testar conexão com Asaas.
4. Confira Conexão Sandbox confirmada e o horário do teste.

O botão não pede a chave. O teste não ativa cobrança nem muda aprovação, suspensão, cortesias, acesso manual preservado ou preços. O resultado mostrado na tela é da sessão atual e não marca a integração como homologada no banco.

A função é exclusiva do administrador da plataforma. Gestor de fazenda ou operador comum não está autorizado a executar o diagnóstico, mesmo se tentar chamá-lo fora da interface.

## Problemas comuns

- Erro de conexão/Failed to send request: confira publicação da função, origem real do site em APP_ALLOWED_ORIGINS e conexão de rede.
- Sessão não autorizada: saia e entre novamente com a conta administrativa. Mantenha a verificação JWT habilitada na função.
- ASAAS_SANDBOX_API_KEY ausente: salve esse Secret no projeto correto do Supabase.
- Ambiente da chave incorreto: crie uma chave NOVA no Sandbox com o prefixo `$aact_hmlg_`. Este teste recusa chaves antigas sem identificação do ambiente e chaves de produção.
- Sandbox recusou a chave: confira se está ativa, sem espaços ou aspas, e se tem permissão para consultar clientes.
- Perfil administrativo não pôde ser verificado: confira o projeto e as migrações anteriores de acesso do LiBen.

## O que vem depois deste teste

Cliente/assinatura por fazenda, página Meu plano, checkout de cartão e Pix comum, webhooks autenticados com confirmação na API, processamento de repetições e eventos fora de ordem, reconciliação e autorização financeira no banco. Só depois da homologação desses fluxos o modo automático poderá ser liberado no administrador.

## Validação técnica realizada

- 22 testes do handler, com rede simulada: autenticação, administrador, CORS, prefixo de ambiente, destino Sandbox fixo, consulta GET, payload inválido, erros do provedor e ausência de vazamento de dados.
- TypeScript estrito para o handler do servidor.
- Lint, TypeScript e build de produção do frontend.
- Nenhuma requisição autenticada foi feita à sua conta Asaas ou Supabase. O runtime Deno da função não foi executado aqui; o teste real da conexão depende da instalação e do Secret no seu ambiente.

## Referências oficiais

- https://docs.asaas.com/docs/sandbox
- https://docs.asaas.com/docs/chaves-de-api
- https://docs.asaas.com/reference/listar-clientes
- https://supabase.com/docs/guides/functions/quickstart-dashboard
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/functions/deploy
