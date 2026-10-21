# Code Guideline

## Project Structure Overview

```
project-root/
  ├── i18n.config.json       # i18n manifest for supported locales and language metadata
  ├── public/
  │   └── locales/           # public/locales/{code}.json translation files (pt-BR only)
  ├── src/
  │   ├── components/        # All reusable UI components
  │   │   ├── app/           # Application shell, navigation and shared primitives
  │   │   ├── auth/          # Session provider, route guard and auth context
  │   │   ├── form/          # Form field primitives (text, select)
  │   │   └── ui/            # Prebuilt and custom UI components, grouped by function
  │   ├── hooks/             # Custom React hooks (one data hook per domain)
  │   ├── i18n/              # i18n runtime: config.ts (entry) + util.ts (helpers)
  │   ├── integrations/      # Generated Enter Cloud client and database types (do not edit)
  │   ├── lib/               # Utilities: format.ts, domain.ts (rules/calculations), constants.ts
  │   ├── pages/             # Application pages (each page in its own subdirectory)
  │   ├── App.tsx            # Main app component, sets up route providers
  │   ├── router.tsx         # Router config, sets up routing
  │   ├── main.tsx           # Entry point for the React app
  │   └── index.css          # Design tokens (light/dark) and global styles
  ├── package.json           # Project metadata and scripts
  ├── tailwind.config.ts     # Tailwind CSS configuration
  └── ...                    # Other config and lock files
```

> Backend-handoff temporary files (`scripts/`, `i18n.scan.json`, `reports/i18n/`, `docs/i18n-*.md`) are kept in the repo only until backend integration of i18n statistics/scan/auto-translate is complete. They are owned by the backend long-term and will be removed once integration lands. Treat them as read-only handoff copies — do not extend them.

## Application Map

- **Shell**: `components/app/app-shell.tsx` (sidebar on `lg+`, `Sheet` drawer plus `BottomNav` below `lg`). `components/app/nav-config.ts` owns navigation groups, role gating and route titles.
- **Primitives**: `stat-card`, `status-badge`, `data-table` (desktop table + mobile card list), `numeric-field`, `trough-score-selector`, `weight-chart`, `occupancy-bar`, `empty-state`, `page-header`, `page-loading`, `tone.ts` (tone → literal Tailwind classes).
- **Domain rules** (`src/lib/domain.ts`): GMD, arroba (carcaça, rendimento 52%), projeção de abate, carência, ocupação de curral, indicadores do rebanho. **No privilege or authorization logic here** — profiles are enforced by database row level security.
- **Data hooks** (`src/hooks/`): `use-auth`, `use-farm`, `use-pens`, `use-diets`, `use-protocols`, `use-lots`, `use-animals`, `use-weighings`, `use-feed`, `use-trough`, `use-health`. Each exports its query key plus read/mutation hooks built on TanStack Query.
- **Routes** (`src/router.tsx`): `/login` público; `/` protegido por `components/auth/protected-route.tsx` e renderizado por `AppShell` — `/currais`, `/lotes`, `/lotes/novo`, `/lotes/:id`, `/animais`, `/pesagens`, `/pesagens/nova`, `/pesagens/:id`, `/trato`, `/trato/leitura`, `/sanidade/protocolos`, `/sanidade/tratamentos`, `/sanidade/ocorrencias`, `/config`, `/config/usuarios`, `/config/currais`, `/config/dietas`.
- **Perfis de acesso**: `gestor` e `operador` vivem em `profiles.role`; a UI apenas esconde itens (`gestorOnly` em `nav-config.ts`) — a autorização real é RLS (`public.is_gestor()`).

## Directory Responsibilities

- **public/**: Static files served directly. Place images, icons, and robots.txt here.
- **public/locales/**: Translation files, one per language (`{code}.json`). Flat dotted keys (e.g. `home.hero.title`); the `fallbackLng` file is the structural source of truth.
- **i18n.config.json**: The lightweight i18n manifest for fallback language, language labels, browser detection aliases, and document direction. Single source of truth for the language list.
- **src/components/**: All UI components.  
  - **ui/**: Contains atomic and composite UI components.  
  - *Group related components into subdirectories if they share a domain or feature (e.g., `form/`, `charts/`).*
- **src/hooks/**: Custom React hooks. Each file should export a single hook focused on one responsibility.
- **src/i18n/**: Two files only.
  - `config.ts` is the runtime entry: imports the manifest via `util.ts`, initializes i18next (HTTP backend, language detector, react binding), syncs `<html lang/dir>`, and re-exports the helpers. Importing this file for its side effect boots i18next.
  - `util.ts` holds pure helpers parsed from the manifest: `fallbackLng`, `supportedLngs`, `languageOptions`, `normalizeLanguage`, `getLanguageDirection`, plus types.
  - Components use the official `useTranslation()` from `react-i18next` directly; there is no project-specific `useT` wrapper.
- **src/lib/**: Utility functions and libraries that are not React components or hooks.
- **src/pages/**: All route-level pages.  
  - *Each page should have its own subdirectory if it contains more than a single file or has related logic/components.*
- **src/App.tsx**: Sets up global providers.
- **src/router.tsx**: Sets up routing.
- **src/main.tsx**: Application entry point.

**Important:**
Whenever a new module (such as a component, hook, or utility) or a new page is added or removed, this document **must be updated immediately** to reflect the changes. Keeping this documentation up to date ensures that all collaborators have a clear understanding of the current project structure and its intended organization.

## How to Add New Code

### 1. Adding a New Page

- **Create a subdirectory under `src/pages/` for each new page.**
  - Example: For a "Dashboard" page, create `src/pages/dashboard/`.
- **Place the main page component as `index.tsx` inside the subdirectory.**
- **Add any page-specific components or logic in the same subdirectory.**
- **Register the new route in `src/router.tsx and generate a semantic name.**
  - Example:
    ```tsx
    import Dashboard from "./pages/dashboard";
    // ...
    {
      path: "/dashboard",
      name: 'dashboard',
      element: <Dashboard />
    }
    ```

### 2. Adding a New Component

- **If you are adding a group of related components, create a subdirectory (e.g., `form/`, `charts/`).**
- **If the component is only used by a specific page, place it in that page's subdirectory under `src/pages/`.**
- **Each component should be focused on a single responsibility.**
- **Small files (< 100 lines) are encouraged for a single component.**

### 3. Adding a New Hook

- **Create a new file in `src/hooks/` named after the hook (e.g., `use-feature.ts`).**
- **Each file should export only one hook.**
- **Hooks should be as small and focused as possible.**

### 4. Adding Utilities

- **Add utility functions to `src/lib/`.**
- **Group related utilities in the same file or subdirectory if needed.**

### 5. Adding or Updating Languages

- **Language metadata must go through `i18n.config.json`.**
- **Do not hardcode supported languages, labels, browser detection aliases, or RTL direction lists in `src/i18n/*.ts`.**
- **Locale content lives in `public/locales/{code}.json`** as flat dotted-key JSON; the `fallbackLng` file owns the canonical key set.
- **Runtime code reads the manifest only through `src/i18n/util.ts`.** Adding or removing a language means editing `i18n.config.json` plus the matching `public/locales/{code}.json`; nothing in `src/i18n/` needs to change.
- **Translations are read with the official `useTranslation()` from `react-i18next`.** No custom hook, no cast at call sites.

## Coding Best Practices

- **One module, one responsibility:**  
  Each file (component, hook, utility) should do one thing only.
- **High cohesion, low coupling:**  
  Keep related logic together and avoid unnecessary dependencies between modules.
- **Naming conventions:**  
  - Use `PascalCase` for components and page directories.
  - Use `camelCase` for hooks and utility functions.
  - Name page subdirectories and files after their route or feature.
- **Component structure:**  
  - Keep components small and focused.
  - Extract subcomponents if a component grows too large.
- **Page structure:**  
  - Place all logic, hooks, and components specific to a page in its subdirectory.
  - Only share code via `components/`, `hooks/`, or `lib/` if it is truly reusable.
- **Documentation:**  
  - Add comments for complex logic.
  - Document the purpose of each module at the top of the file if not obvious.

## Example: Adding a New "Profile" Page

1. **Create a directory:**  
   `src/pages/profile/`
2. **Add the main page component:**  
   `src/pages/profile/index.tsx`
3. **Add page-specific components:**  
   `src/pages/profile/ProfileHeader.tsx`, `src/pages/profile/ProfileDetails.tsx`
4. **Register the route in `App.tsx`:**
   ```tsx
   import Profile from "./pages/profile";
   // ...
   <Route path="/profile" element={<Profile />} />
   ```
5. **If you need a reusable button, add it to `src/components/ui/button.tsx`.**

## Correções de integridade (12/10/2026)

- `src/lib/mutations.ts`: cliente RPC para operações atômicas e idempotentes.
- `src/lib/query.ts`: paginação das coleções de domínio.
- `src/components/app/query-errors.tsx`: feedback de falhas de consultas.
- `tests/domain.test.mjs`: regressões de cálculos e datas.
- `tests/database.test.mjs`: integração transacional e autorização em banco de teste.
- `supabase/migrations/20261012220000_integrity_and_access.sql`: transações, aprovação de acesso e validação de rebanho.
- `CORRECOES.md`: instalação, migração e limites de validação.

A aplicação continua sendo uma instalação compartilhada de uma fazenda. `app_members` controla aprovação explícita de usuários; não é isolamento de múltiplas fazendas. Escritas de rebanho passam pela RPC `app_mutate`; RLS e permissões impedem contornar as validações usando tabelas diretamente.

As páginas em `router.tsx` usam importação dinâmica e Suspense no App/AppShell. O gerenciador da entrega é npm, com package-lock.json.

Revisão 2: `EXECUTAR-NO-SUPABASE.sql` copia a migração para acesso rápido; `LEIA-PRIMEIRO.txt` explica recuperação de execução com tipos incompatíveis.

## Correção de pesos individuais

- `src/pages/weighings/detail/weight-record-actions.tsx`: edição de um peso individual, mantendo a composição da pesagem.
- `useCorrectWeightRecord` em `src/hooks/use-weighings.ts`: chamada RPC e atualização de caches.
- `supabase/migrations/20261013010000_weight_record_corrections.sql`: correção transacional com chave de repetição, verificação de dados desatualizados e recálculo de média/quantidade/peso vigente.
- `tests/database.test.mjs`: regressões de edição/exclusão individual, nos esquemas UUID e TEXT.

Revisão somente edição: `supabase/migrations/20261013020000_edit_weight_only.sql` substitui a função de correção e bloqueia exclusão individual no banco. A exclusão da pesagem completa permanece em `useDeleteWeighing`.

Feedback de aplicação de cocho: `supabase/migrations/20261013030000_trough_application_feedback.sql` adiciona `app_apply_readings`. O hook `useApplyReadings` devolve contagens de registros criados, já aplicados e leituras sem ajuste. A página diferencia sucesso, repetição e ausência de ajustes pendentes.


## Múltiplos clientes e fazendas (14/10/2026)

- `src/lib/tenant.ts`: contrato da RPC de contexto, aprovação e equipe.
- `src/pages/admin/index.tsx`: página exclusiva de aprovação de clientes, recusa e suspensão; RLS/RPC conferem administrador.
- `src/pages/onboarding/index.tsx`: espera de aprovação, cadastro da fazenda e aceite de convite com e-mail confirmado.
- `src/pages/config/users.tsx`: equipe e convites da fazenda; substitui o antigo hook `use-users.ts`, removido.
- `supabase/migrations/20261014010000_multi_farm.sql`: isolamento por fazenda inclusive nas funções de gravação, executor sem bypass de RLS, referências compostas e registro de decisões.
- `tests/tenancy.test.mjs`: isolamento entre clientes, operador/gestor/admin, convites, suspensão e compatibilidade TEXT/UUID.

Substitui o modelo de aprovação global por aprovação de clientes (`account_access`) e papéis em `farm_members`. `profiles.role` é legado; o contexto do front-end usa o papel da equipe. Cada conta pertence a uma fazenda nesta versão, com número de clientes sem limite fixo. Convites não enviam mensagens automaticamente: a equipe informa ao convidado o endereço público do login.

O fluxo não envia convites por e-mail automaticamente. Os gestores criam convites vinculados ao e-mail e comunicam o endereço do login por conta própria. E-mail confirmado é exigido antes de aceitar convite ou aprovar novo cliente. Não colocar service_role no front-end. A conta de administrador é configurada por SQL separado, sem cadastro automático por metadata.


## Seleção de localização

- `src/components/form/location-fields.tsx`: estados brasileiros e municípios por UF consultados na API pública do IBGE, com cache, cancelamento e feedback de falha.
- Usado no cadastro inicial e nas configurações da fazenda. Valores antigos são preservados; trocar estado limpa a cidade anterior.
- Não altera esquema, permissões ou RPCs do Supabase.


## E-mail e recuperação de senha

- `src/pages/password-recovery/index.tsx`: solicitação pública de link com resposta sem revelar existência de conta e intervalo de reenvio.
- `src/pages/password-recovery/reset.tsx`: valida sessão de recuperação e troca a senha pelo Supabase Auth; trata link ausente/expirado.
- `/recuperar-senha` e `/redefinir-senha` são rotas fora do bloqueio de aprovação de fazenda.
- AuthProvider mantém estado de PASSWORD_RECOVERY por aba, inclusive após F5, e limpa ao concluir ou encerrar sessão.
- Supabase Auth: habilitar confirmação de e-mail, URLs autorizadas e SMTP para clientes externos. Não colocar senha SMTP no código.


## Login responsivo (20/10/2026)

- `src/pages/login/login.css`: apresentação em coluna abaixo de 1024px e duas colunas no computador, com painel translúcido, botão em cobre e a marca original.
- `src/pages/login/index.tsx`: formulário único com opção acessível de mostrar/ocultar senha, temas existentes e aviso de cadastro apenas na aba Criar conta.
- Substitui a entrega anterior exclusiva de celular; `src/pages/login/mobile.css` deixa de ser utilizado.
- Os fundos `/bg-luz.png` e `/bg-dark.png` continuam intactos. Animações respeitam a preferência de movimento reduzido.


## Login animado e tema escuro (20/10/2026)

- Complementa o login responsivo de celular e computador com uma barra de cobre que desliza entre Entrar e Criar conta, aparição suave do conteúdo e ajuste animado da altura.
- `src/pages/login/index.tsx` usa `ResizeObserver` e `framer-motion` já instalado para acompanhar altura, mensagens e mudanças de largura; os campos preservam seus valores ao mudar de aba.
- `src/pages/login/login.css` define grafite para painel e campos do tema escuro, detalhes em cobre, textos claros e estilos de foco. Fundos e logos existentes permanecem intactos.
- Animações em React e CSS respeitam a preferência do aparelho por movimento reduzido. Não há dependências novas nem mudanças no banco.


## Visão geral da leitura de cocho (20/10/2026)

- `src/pages/feed/reading-overview.tsx`: resumo compacto da ronda, filtros Todos/Pendentes/Lidos, tabela em telas a partir de 768px e cartões com ações acessíveis no celular. Usa os temas existentes.
- `src/pages/feed/reading.tsx`: integra a apresentação sem alterar cálculos da oferta base, gravação ou aplicação de ajustes; ordena os locais naturalmente por nome.
- A oferta exibida é identificada como referência para ajuste da manhã (não como último trato, pois pode vir da dieta). O progresso conta somente os locais com lote ativo exibidos na ronda.
