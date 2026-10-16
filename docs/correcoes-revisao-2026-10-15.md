# Correções da revisão — 15/10/2026

O pacote parte do último projeto recebido, preserva as funcionalidades anteriores e corrige os sete pontos funcionais/de configuração da revisão. Os arquivos do site, imagens, testes e migrações foram preservados; o ZIP omite dependências instaladas, build gerado, metadados Git e `.env`.

## Comportamento após a correção

| Ponto | Resultado |
| --- | --- |
| Trato em curral com dois lotes | O valor do seletor é o ID do lote. O formulário deriva o curral e a referência de peso, dieta e quantidade daquele lote. |
| Carregamento do trato | Aguarda a consulta de lotes, currais, dietas e ingredientes; permite tentar novamente em caso de falha. Currais em manutenção não são oferecidos. |
| Quantidade do trato | Exige quantidade inteira positiva que não exceda o saldo do lote escolhido. As verificações de banco permanecem ativas. |
| Dieta percentual na criação do lote | Reutiliza `dietTotalKg` com o peso de entrada informado; 1% de 400 kg mostra 4 kg/cab/dia, sem transformar percentual em zero. |
| Protocolos inativos | Saem das opções, do critério de disponibilidade e do alerta inicial. Uma seleção que se tornar inativa é recusada antes do salvamento. |
| Aplicação sanitária inicial | Continua desmarcada por padrão; depende da seleção de um protocolo ativo. |
| Indicador de oferta no painel de trato | Mantém o cálculo como média simples das ofertas por animal em cada lançamento, agora com o rótulo explícito “Oferta média por lançamento”. O total é a soma diária em kg. Não afirma medir consumo efetivo ou acumulado diário por cabeça. |
| Identificação do curral no resumo | Apresenta os códigos dos lotes ativos do curral, não apenas o primeiro lote. |
| Data de animal sem lote | A comparação converte `created_at` para `America/Sao_Paulo`, o mesmo fuso usado pelo banco para o dia da fazenda. |
| Permissões `auth` | As rotinas internas usam o helper de identidade restrito. Não precisam de `USAGE` no schema `auth` para o executor. RLS e os papéis de gestor/operador são mantidos. |
| Supabase por ambiente | Cliente e Vite leem e validam as variáveis. Uma configuração ausente para o build é apontada antes da publicação. |
| Dependências | Override restrito ao UUID do ExcelJS, versão 11.1.1, mantendo a versão do ExcelJS. O lockfile foi atualizado e os testes reais de arquivos repetidos. |

## SQL e publicação

`ATUALIZAR_SUPABASE.sql` contém as migrações novas `20261015080000_executor_auth_context.sql` e `20261015090000_health_event_local_date.sql`. Executar inteiro no SQL Editor como `postgres`, após backup e sobre o banco que já possui as atualizações anteriores. Não reaplicar migrações históricas. Os dois novos SQLs foram testados também por reaplicação.

As variáveis necessárias são `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (alternativa: `VITE_SUPABASE_PUBLISHABLE_KEY`). Se ambas as chaves forem configuradas, a opção `PUBLISHABLE_KEY` tem preferência; evite misturar projetos. `.env.example` traz os valores públicos do projeto atual para facilitar a configuração local e no Vercel. Não inclui senha de banco nem chave privilegiada.

O ZIP não muda o índice Git já existente na máquina. O comando `git rm --cached --ignore-unmatch .env` no guia retira um `.env` previamente rastreado dos próximos commits e preserva o arquivo local. A configuração precisa existir no Vercel antes do próximo deploy.

Referência de configuração: [variáveis de ambiente no Vercel](https://vercel.com/docs/environment-variables). O passo a passo completo está em `LEIA-ME-ATUALIZACAO.txt`.

## Validação concluída

- Instalação limpa com `npm ci` a partir do lockfile atualizado.
- `npm run build`: ESLint, TypeScript e build Vite passaram.
- `npm test`: **26 testes passaram**, incluindo Excel/PDF reais e testes dos handlers/componentes com dados e queries controlados.
- Formulário de trato: dois lotes no mesmo curral, com 400/500 kg de peso médio e dietas diferentes, geram registros com o ID, dieta, quantidade e total corretos do lote selecionado.
- Formulário de novo lote: protocolo inativo não aparece, aplicação inicia desmarcada e o resumo de 1% PV sobre 400 kg mostra 4 kg/cab/dia.
- `npm run test:db`: passou nos esquemas legados UUID e TEXT.
- `npm run test:tenancy`: passou em UUID/TEXT, com acesso ao schema `auth` explicitamente revogado para o executor. Verificou isolamento entre fazendas, papéis, suspensão e helper não acessível diretamente pelo cliente.
- Banco: gravações independentes para dois lotes no mesmo curral e rejeição de associação a outro curral.
- Banco: ocorrência no dia local de criação do animal sem lote é aceita; ocorrência em dia anterior à criação continua recusada.
- `npm audit --omit=dev`: **zero alertas** na consulta desta entrega. Esse resultado é temporal e não representa garantia geral de ausência de vulnerabilidades.

Testes de formulário executam o código e os handlers reais com dependências controladas; não são uma inspeção visual de navegador. A conferência visual em PC/celular, envio real de e-mails e validação do banco hospedado devem ocorrer após a instalação. Nenhuma alteração foi aplicada no Supabase de produção ou publicada no Vercel a partir desta entrega.

## Melhorias que continuam como próximas etapas

A revisão também sugeriu otimizar imagens, paginar consultas históricas, adicionar CI no GitHub e ampliar os testes de navegador. Essas propostas são melhorias de desempenho/processo e não foram misturadas às correções funcionais desta entrega. As imagens de marca continuam preservadas.
