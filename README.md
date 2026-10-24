# LiBen — Gestão de Fazendas

React/TypeScript/Vite, Supabase e aplicativo Android com Capacitor. A versão atual
é multiusuário e multifazendas. O banco aplica RLS e funções autorizadas; ocultar
um botão na interface não substitui essas proteções.

## Instalação local

Use Node.js 22.12 ou superior (22 LTS recomendado). Na raiz do projeto:

```bash
npm ci
```

Copie `.env.example` para `.env` e informe a URL e a chave PÚBLICA do seu projeto.
Na Vercel, configure os mesmos nomes em Environment Variables. Nunca coloque
service_role, `sb_secret_`, chaves Asaas ou tokens de webhook em `VITE_*`.

```bash
npm run dev
npm run build
```

## Validação

```bash
npm run check
npm test
npm run test:all
npm audit
```

`test:all` inclui os testes de banco em PGlite local e os provedores de pagamento
simulados. Esses testes não se conectam ao seu Supabase nem criam cobranças reais.
A lista de resultados desta entrega está em `docs/REVISAO-2026-10-24.md`.

## O que vai ao Git

Versione `src`, `public`, `supabase`, `android` (fontes), `tests`, `docs`, `scripts`,
`package.json`, `package-lock.json` e as configurações da raiz. O `.gitignore`
exclui dependências, builds, caches, backups, arquivos privados e pacotes ZIP.
Não apague `src/integrations/supabase/client.ts` nem `types.ts`.

O `.vercelignore` reduz o envio de fontes pela Vercel CLI. No fluxo Git → Vercel,
o Git decide o conteúdo do repositório; `.vercelignore` não substitui `.gitignore`.
O build gera `dist` novamente. Não use esse `.vercelignore` com `vercel --prebuilt`.

## Atualizar com o pacote limpo

A forma mais segura é extrair em uma pasta NOVA, mantendo o original como backup.
Copie do projeto anterior apenas seu `.git` e seu `.env` locais para essa nova
pasta. Não os envie em ZIP nem ao Git. Se existir assinatura Android de produção,
preserve separadamente as chaves, senhas e configurações de assinatura.

A pasta antiga pode conter outros arquivos não enviados neste ZIP: não a exclua
antes de testar o projeto e conferir seus arquivos particulares.

Execute `npm ci`, `npm run build`, `npm run test:all` e revise `git status`.
No caso de arquivos gerados já rastreados pelo Git, `.gitignore` sozinho não os
retira do histórico/índice. O script PowerShell `scripts/desversionar-gerados.ps1`
retira do índice somente os caminhos ignorados, preservando os arquivos no disco.
Ele não faz commit nem push. Se uma credencial já foi publicada no passado, apagar
o arquivo atual não revoga essa credencial: é necessário trocá-la no provedor.

Depois da conferência, no terminal da nova pasta:

```bash
git status
git add .
git diff --cached --stat
git commit -m "Revisa seguranca e limpa arquivos gerados"
git push origin main
```

O push publica se `main` estiver vinculada ao projeto Vercel. Não houve deploy
automático nesta revisão.

## Android

Depois do build do site:

```bash
npx cap sync android
npx cap open android
```

`sync` recria `android/app/src/main/assets`, configurações e o projeto dos plugins.
Os ícones, splash, manifesto, fontes Java, Gradle e seu wrapper ficam preservados.
A primeira sincronização do Android Studio pode baixar dependências do Gradle.
Não foi gerado nem assinado APK/AAB nesta revisão. A página pública anuncia um
modo offline futuro; essa mensagem não significa que a sincronização offline já
esteja implementada.

## Supabase e pagamentos

Não reaplique todas as migrações em um banco existente e não execute `db push`
sem primeiro conferir o histórico: várias instalações foram feitas manualmente
pelo SQL Editor. Atualizar o frontend na Vercel não publica Edge Functions.

Foi reconstruído o arquivo histórico ausente
`20261018030000_signup_contact_phone.sql` para completar a cadeia local/testes.
Isso não significa que deva ser executado novamente no banco real. Confira a
cadeia instalada antes de qualquer ação; detalhes no relatório da revisão.

Os webhooks usam autenticação própria pelo `asaas-access-token`. O arquivo
`supabase/config.toml` explicita `verify_jwt = false` somente nos dois webhooks.
As funções restantes validam a sessão. Confira o project-ref ao vincular a CLI:
o project_id recebido no ZIP pode ser uma referência antiga do gerador.

Secrets privados permanecem exclusivamente nas Edge Functions. Sandbox e produção
continuam separados. Nenhum pagamento, usuário ou registro foi alterado remotamente.
O arquivo `scripts/diagnostico-seguranca-supabase.sql` contém somente consultas de
estrutura/permissões para uma conferência opcional no seu projeto real.
