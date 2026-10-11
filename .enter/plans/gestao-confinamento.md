# Plano — Sistema de Gestão de Confinamento Bovino

## Contexto

O projeto é hoje um template Vite + React 19 + TS + Tailwind + shadcn/ui com apenas uma home de exemplo e sem backend. O usuário quer um aplicativo real de **gestão de confinamento de bovinos de corte**, em português, com controle individual dos animais mas leituras e trato por curral, login por e-mail/senha com perfis **Gestor** e **Operador**, uso em celular (campo) e desktop (escritório).

Esta é uma construção do zero: nenhum código existente além do template será reaproveitado; os 60+ componentes shadcn/api já instalados serão reutilizados como base visual.

## Escopo

**Entra (v1):**
1. Autenticação e-mail/senha (login + cadastro) e perfis Gestor/Operador.
2. Currais e Lotes: entrada em wizard, alocação, transferência de curral e saída (abate/venda/óbito).
3. Animais: registro individual (brinco, SISBOV, raça, sexo, peso) vinculado a lote/curral.
4. Pesagens: sessão de pesagem (amostral, lote completo ou individual), histórico, GMD, evolução de peso e projeção de abate.
5. Dietas, Trato e Leitura de Cocho (score 0–5 + ajuste sugerido em kg/%).
6. Sanidade: protocolos de entrada com carência, tratamentos e ocorrências (morbidade/mortalidade).
7. Cadastros e configuração: dados da fazenda, currais, dietas, protocolos, usuários.
8. Painel com KPIs, ocupação por curral e pendências do dia.

**Não entra nesta versão:** módulo de custos/resultado econômico, estoque de insumos, relatórios exportáveis, fila offline, segundo idioma.

## Decisões técnicas

- **Backend:** Enter Cloud (ativar no início). Persistência real, RLS e autenticação. Nenhum dado mockado no frontend.
- **Idioma:** apenas pt-BR. Ajustar `i18n.config.json` (`fallbackLng: "pt-BR"`, lista com somente `pt-BR`), criar `public/locales/pt-BR.json` (chaves flat) e remover `en.json`/`zh-CN.json`. `src/i18n/*` não muda. `LanguageSwitcher` deixa de ser renderizado (componente permanece no repo); reativar multi-idioma no futuro é editar 1 JSON + 1 arquivo de locale.
- **Cliente:** importar de `@/integrations/supabase/client` (gerado ao ativar o Enter Cloud). Nunca editar `src/integrations/supabase/client.ts` nem `types.ts`.
- **Segurança:** toda regra de perfil vive em RLS (`public.is_gestor()` como `SECURITY DEFINER`). O guard de rota no cliente é só UX.
- **Cálculos de domínio em TypeScript**, não em views SQL (evita armadilha de `security_invoker`): `src/lib/domain.ts` com GMD, arroba (peso vivo ÷ 15), projeção de abate, ocupação de curral, carência e dias de confinamento.
- **Formatação:** `Intl.NumberFormat('pt-BR')` (vírgula decimal) e datas `dd/MM/aaaa`; `tabular-nums` em todo número.
- **Gráficos:** `recharts` (já instalado).
- **Tema claro/escuro:** `next-themes` (já instalado) com `attribute="class"` no `App.tsx`.

### Referências de estado de lote (regra única)
- Peso médio atual do lote = última pesagem válida; sem pesagem, peso médio de entrada.
- Dias de confinamento = hoje − `entry_date`. GMD = (peso atual − peso entrada) ÷ dias.
- Ocupação do curral = Σ `head_count` dos lotes ativos ÷ `capacity_head`.
- Indivíduo em carência bloqueia saída com "Faltam N dias de carência".

## Design system

Tokens definidos pelo agente de design (identidade agro: verde pasto + creme + âmbar de foco + terracota). Implementar em:

- `src/index.css`: novos HSL para `background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring`, grupo `sidebar-*`, semânticos `success/warning/info/agro` (+`-foreground`), `--gradient-brand|agro|surface`, `--shadow-xs|md|lg`, `--radius: 0.75rem`; mesmo conjunto em `.dark`.
- `tailwind.config.ts`: expor em `colors` (`success`, `warning`, `info`, `agro` + foregrounds), `borderRadius`, `boxShadow`, `backgroundImage`, `fontFamily` (`sans: Inter`, `display: Barlow Semi Condensed`).
- `index.html`: importar as duas fontes do Google Fonts.
- Regra de status: sólido `bg-{token} text-{token}-foreground`; tonal `bg-{token}/12 text-{token}`. Contraste AA validado nos dois temas.

## Modelo de dados (migrações)

Todas as tabelas com `enable row level security` na mesma migração + políticas. Leitura: `auth.uid() is not null` (dados compartilhados da fazenda). Escrita operacional: qualquer autenticado. Escrita de cadastros (`pens`, `diets`, `diet_items`, `protocols`, `protocol_items`, `farms`): só gestor. `profiles`: todos leem, cada um atualiza o próprio `full_name`, `role` só gestor.

| Tabela | Campos principais |
|---|---|
| `farms` | name, city, state |
| `profiles` | id (auth.users), full_name, role (`gestor`/`operador`) — trigger no signup |
| `pens` | code, capacity_head, area_m2, status (`ativo`/`vazio`/`manutencao`/`adaptacao`), notes |
| `diets` / `diet_items` | name, dry_matter_pct, is_active / ingredient, kg_per_head_day |
| `protocols` / `protocol_items` | name, is_active / kind (`vacina`/`vermifugo`/`outro`), product, dose, withdrawal_days |
| `lots` | code, origin, entry_date, breed, category, head_count, entry_avg_weight_kg, target_weight_kg, pen_id, diet_id, protocol_id, status |
| `animals` | lot_id, pen_id, ear_tag (unique), sisbov, breed, sex, entry_weight_kg, current_weight_kg, status, health_status, withdrawal_until |
| `weighings` / `weight_records` | lot_id, pen_id, date, kind, head_count_weighed, avg_weight_kg / weighing_id, animal_id, weight_kg |
| `feed_logs` | pen_id, lot_id, date, shift, diet_id, kg_per_head, head_count, total_kg |
| `trough_readings` | pen_id, lot_id, date, score (0–5), leftover_kg, adjustment_pct, adjustment_kg, notes |
| `health_events` | animal_id, lot_id, pen_id, kind (`protocolo`/`vacina`/`tratamento`/`obito`), product, dose, diagnosis, event_date, withdrawal_until |

- Trigger `handle_new_user` cria `profiles`; **primeiro usuário cadastrado vira `gestor`**, os demais entram como `operador` e o gestor promove em `/config/usuarios`.
- E-mail de cadastro com confirmação automática (`supabase_configure_auth`).
- Seed de demonstração via `supabase_insert`: 1 fazenda, 6 currais, 3 dietas com ingredientes, 1 protocolo de entrada, 3 lotes (120/80/60 cabeças), ~40 animais individuais, 3 pesagens por lote, 7 dias de trato e leituras de cocho do dia, alguns eventos sanitários e 1 óbito.

## Rotas e telas

Público: `/login` (login + cadastro).

Layout protegido (`AppLayout` com `Outlet`, sidebar 264px → drawer + bottom nav no mobile): Painel, Currais/Lotes, Animais, Pesagens, Trato, Sanidade, Configurações.

| Rota | Tela |
|---|---|
| `/` | Painel: KPIs (animais confinados, GMD médio, dias de confinamento, mortalidade %), ocupação por curral, trato/leitura de hoje |
| `/currais`, `/currais/:id` | Lista de currais com ocupação e status; detalhe com lote, dieta e histórico de cocho |
| `/lotes`, `/lotes/novo`, `/lotes/:id` | Lista; wizard 3 passos (identificação → pesagem de entrada → sanidade/alocação); detalhe com GMD, evolução de peso, projeção de abate e ações (transferir curral, registrar saída) |
| `/animais` | Tabela com filtros (curral, lote, status sanitário) + sheet de detalhe e edição |
| `/pesagens`, `/pesagens/nova`, `/pesagens/:id` | Histórico; sessão de coleta com HUD (média móvel, GMD parcial, progresso) e revisão de outliers; detalhe com gráfico |
| `/trato`, `/trato/leitura` | Registro de trato do dia; ronda de leitura de cocho mobile-first (sheet + score 0–5 + ajuste) com "salvar e próximo" |
| `/sanidade/protocolos`, `/sanidade/tratamentos`, `/sanidade/ocorrencias` | Cadastro de protocolo e itens; aplicação de tratamento com carência; óbitos/morbidade |
| `/config`, `/config/usuarios`, `/config/currais`, `/config/dietas` | Dados da fazenda; usuários e papéis (só gestor); cadastros de curral e dieta |

## Estrutura de arquivos

```
src/
├── components/app/        app-shell.tsx, sidebar-nav.tsx, topbar.tsx, bottom-nav.tsx,
│                          stat-card.tsx, status-badge.tsx, page-header.tsx, empty-state.tsx,
│                          data-table.tsx, numeric-field.tsx, trough-score-selector.tsx,
│                          weight-chart.tsx, page-loading.tsx
├── components/auth/       auth-provider.tsx, protected-route.tsx
├── hooks/                 use-auth.ts, use-farm.ts, use-pens.ts, use-lots.ts, use-animals.ts,
│                          use-diets.ts, use-weighings.ts, use-feed.ts, use-trough.ts,
│                          use-health.ts, use-users.ts
├── lib/                   domain.ts (GMD, @, projeção, ocupação), format.ts, constants.ts
├── pages/                 login/, dashboard/, pens/, lots/, animals/, weighings/, feed/,
│                          health/, settings/   (cada página em subpasta com index.tsx)
└── router.tsx             rotas aninhadas (layout protegido) + /login + catch-all
```

`CodeGuideline.md` deve ser atualizado ao final com a nova estrutura (exigência do próprio guia).

## Ordem de execução

1. Backend: ativar Enter Cloud → migração de schema + RLS + trigger → verificar RLS tabela por tabela → seed.
2. Idioma pt-BR e design system (index.css, tailwind.config.ts, index.html).
3. Auth: `supabase_configure_auth`, `AuthProvider`, `/login`, guarda de rota.
4. Shell do app (sidebar, topbar, drawer, bottom nav, tema claro/escuro) e componentes base.
5. Cadastros (fazenda, currais, dietas, protocolos, usuários).
6. Lotes + currais + animais (incl. wizard de entrada, transferência, saída).
7. Pesagens, GMD e projeção de abate.
8. Dietas/trato e leitura de cocho.
9. Sanidade.
10. Painel, polimento, verificação final.

## Status da execução

Concluído:
- Backend: 14 tabelas com RLS ativa e políticas por operação, `is_gestor()`, trigger `handle_new_user` (primeiro usuário = gestor) e `profiles_protect_role` verificados no banco.
- Seed de demonstração: 6 currais, 3 dietas (12 ingredientes), 2 protocolos (5 itens), 3 lotes, 30 animais, 8 pesagens (10 pesos individuais), 42 registros de trato, 7 leituras de cocho e 4 eventos sanitários.
- Autenticação: cadastro e login por e-mail/senha com confirmação automática; `/login` verificado por screenshot em desktop (1280) e celular (390).
- Frontend completo: shell responsivo (sidebar no desktop, drawer + bottom nav no celular), tema claro/escuro, pt-BR como único idioma, e as 19 rotas do plano implementadas sobre hooks de dados reais.
- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.

Pendente de verificação visual: as telas autenticadas (painel, currais, lotes, pesagens, trato, leitura de cocho, sanidade e configurações) não podem ser capturadas por mim porque dependem de uma sessão logada. Valide com o primeiro cadastro e, se algo aparecer fora do lugar, eu ajusto.

## Implementation checklist

- [ ] Enter Cloud ativado e `src/integrations/supabase/client.ts` disponível.
- [ ] Migração cria as 14 tabelas com `enable row level security`, políticas por operação e `public.is_gestor()` (security definer).
- [ ] Trigger `handle_new_user` cria `profiles` e marca o primeiro usuário como `gestor`.
- [ ] `supabase_get_table_schema` confirma RLS + políticas em cada tabela criada.
- [ ] Seed insere fazenda, currais, dietas+itens, protocolo+itens, lotes, animais, pesagens, trato, leituras de cocho e eventos sanitários.
- [ ] `i18n.config.json` com apenas `pt-BR` e `public/locales/pt-BR.json` criado; `en.json`/`zh-CN.json` removidos.
- [ ] `src/index.css` com tokens claro/escuro (incl. `success/warning/info/agro`, `sidebar-*`, gradientes, sombras) e `tailwind.config.ts` expondo-os.
- [ ] Fontes Inter + Barlow Semi Condensed carregadas no `index.html` e ativas via `font-sans`/`font-display`.
- [ ] `src/lib/domain.ts` implementa GMD, arroba, projeção de abate, ocupação e carência.
- [ ] Login e cadastro funcionando (signup com `emailRedirectTo: ${window.location.origin}/`), sessão via `onAuthStateChange` (listener antes do getSession, callback não-`async`, chamadas ao client em `setTimeout`).
- [ ] `AuthProvider` carrega `profiles` e expõe `role`; `ProtectedRoute` redireciona para `/login` sem sessão.
- [ ] Shell responsivo: sidebar em ≥lg, drawer + bottom nav em <768, tema claro/escuro persistido.
- [ ] Componentes base reutilizáveis (StatCard, StatusBadge, DataTable com fallback em cards, NumericField, TroughScoreSelector, WeightChart, EmptyState) usam apenas tokens semânticos.
- [ ] Cadastros de fazenda, currais, dietas, protocolos e usuários (promover/rebaixar papel) operantes.
- [ ] Wizard de novo lote cria lote + animais e atualiza a ocupação do curral.
- [ ] Transferência de curral e saída (abate/venda/óbito) atualizam lote, animal e KPIs; carência ativa bloqueia a saída.
- [ ] Sessão de pesagem recalcula peso médio, GMD e data projetada de abate.
- [ ] Registro de trato e ronda de leitura de cocho salvam score + ajuste e avançam para o próximo curral.
- [ ] Aplicação de protocolo/tratamento grava `withdrawal_until` e óbito atualiza `animals.status` e mortalidade.
- [ ] Painel exibe KPIs reais, ocupação por curral e pendências do dia.

## Verification checklist

- [ ] `pnpm lint` sem erros e `pnpm exec tsc --noEmit` sem erros de tipo.
- [ ] `pnpm run build` conclui com sucesso.
- [ ] Fluxo positivo ponta a ponta: cadastrar usuário → criar lote de 20 animais → alocar curral + dieta → registrar pesagem → GMD e data de abate aparecem no detalhe do lote → leitura de cocho → trato → tratamento com carência → saída de abate baixa o rebanho.
- [ ] Negativo: `ear_tag`/`sisbov` duplicado é rejeitado com erro inline; saída de animal em carência é bloqueada; curral acima da capacidade é destacado como superlotado; operador não escreve em cadastros nem altera papéis (validado por RLS, não só por UI).
- [ ] Padrão/vazio: fazenda recém-criada sem lotes mostra estado vazio (não erro nem `NaN`); lote sem pesagem mostra GMD "—" e não projeção falsa; sessão sem login em rota protegida cai em `/login`.
- [ ] Limite: leitura de cocho aceita apenas 0–5; projeção de abate com GMD ≤ 0 não retorna data nem divisão por zero; arroba com 1 decimal (`Intl pt-BR`).
- [ ] Interface verificada por `website_screenshot` na mesma rota representativa (painel e leitura de cocho) em `mobile_390` e `desktop_1280`, nos temas claro e escuro.
- [ ] Console do navegador sem erros de runtime nas rotas principais após login.
