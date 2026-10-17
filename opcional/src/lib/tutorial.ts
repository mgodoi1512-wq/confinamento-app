export type TutorialChapter = {
  id: string;
  title: string;
  group: string;
  summary: string;
  path: string;
  route?: string;
  managerOnly?: boolean;
  steps: { title: string; text: string }[];
  tip: string;
  example?: string;
  table?: { headers: string[]; rows: string[][] };
  demo?: "lot";
};
const steps = (...rows: [string, string][]) => rows.map(([title, text]) => ({ title, text }));

export const tutorialChapters: TutorialChapter[] = [
  { id: "welcome", title: "Bem-vindo ao tutorial", group: "Primeiros passos", summary: "Aprenda a organizar os cadastros e acompanhar a rotina do confinamento.", path: "Guia da plataforma", steps: steps(
    ["Escolha como aprender", "Use o índice para ir direto a um assunto ou avance pelas páginas na ordem do guia."],
    ["Siga os passos", "Cada capítulo mostra o caminho no menu, o que preencher e os pontos que merecem conferência."],
    ["Experimente criar um lote", "O capítulo Criação de lotes tem uma demonstração clicável. Os dados são fictícios e não são gravados na fazenda."],
    ["Leve o aprendizado à rotina", "O botão Abrir página real fecha o tutorial e leva à ferramenta. Confirme os dados antes de salvar na página real."]
  ), tip: "No PC, use as setas do teclado quando o foco estiver no texto. No celular, use Anterior, Próxima e o botão Índice. Escape fecha o guia." },
  { id: "access", title: "Acesso e primeiro cadastro", group: "Primeiros passos", summary: "Cadastro, confirmação de e-mail e aprovação são etapas diferentes.", path: "Tela de login > Criar conta", steps: steps(
    ["Crie sua conta", "Na tela de login, escolha Criar conta e preencha os dados solicitados."],
    ["Confirme e aguarde a liberação", "Confirme o e-mail quando solicitado. Se o cadastro estiver pendente, aguarde a aprovação e use Verificar novamente."],
    ["Cadastre ou aceite a fazenda", "O proprietário aprovado cadastra nome, estado e município. Quem recebeu um convite aceita o vínculo com a fazenda indicada."],
    ["Confira seu acesso", "Em Configurações, confira a fazenda e seu perfil. Para recuperar a senha, use Esqueci minha senha na tela de login."]
  ), tip: "Cada pessoa deve usar sua própria conta. Não compartilhe a senha do proprietário com a equipe." },
  { id: "dashboard", title: "Painel e navegação", group: "Primeiros passos", summary: "Comece pela visão geral e aprofunde a consulta nas páginas de manejo.", path: "Operação > Visão geral", route: "/", steps: steps(
    ["Confira o resumo", "Veja os lotes ativos, a ocupação e os indicadores calculados com os registros disponíveis."],
    ["Abra o detalhe", "Consulte o lote, o curral e os registros quando precisar conferir a origem de um indicador."],
    ["Consulte as pendências", "Verifique leituras, tratos e necessidade de pesagens. Um trato registrado no dia não significa que todas as refeições foram concluídas."],
    ["Use o menu no celular", "O botão de menu abre as ferramentas; os atalhos inferiores levam às rotinas mais utilizadas."]
  ), tip: "Se um indicador estiver em branco, confira se os dados necessários já foram registrados. Em branco não significa zero." },
  { id: "pens", title: "Currais e capacidade", group: "Cadastros", summary: "Prepare o espaço antes de receber o lote.", path: "Gestão > Currais ou Configurações > Currais", route: "/config/currais", managerOnly: true, steps: steps(
    ["Cadastre o curral", "Informe um código fácil de reconhecer, capacidade em cabeças e os demais campos disponíveis."],
    ["Defina a situação", "Currais em manutenção não devem receber novos lotes."],
    ["Confira a ocupação", "Após salvar, consulte a capacidade, as cabeças alocadas e as vagas livres."],
    ["Garanta vagas suficientes", "A criação do lote exige um curral válido com capacidade para a quantidade informada."]
  ), tip: "A capacidade cadastrada deve representar a estrutura física real.", example: "Capacidade de 30 cabeças menos 18 alocadas = 12 vagas. Um novo lote com 15 cabeças precisa de outra organização de espaço." },
  { id: "diets", title: "Cadastro de dietas", group: "Cadastros", summary: "Defina ingredientes e confira as unidades usadas no cálculo.", path: "Nutrição > Dietas", route: "/config/dietas", managerOnly: true, steps: steps(
    ["Identifique a dieta", "Informe um nome único na fazenda. Adicione os ingredientes, como ração e volumoso."],
    ["Escolha kg ou % PV", "Em kg, informe a quantidade diária por cabeça. Em % PV, a oferta é calculada pelo peso vivo de referência do lote. O padrão do cadastro é percentual."],
    ["Revise os percentuais", "% PV não é a participação do ingrediente na mistura. A composição da mistura é outro cálculo, usado no Financeiro."],
    ["Salve e confira a situação", "Somente dietas ativas aparecem para novas seleções de trato. Inativar uma dieta não apaga o histórico."]
  ), tip: "Os percentuais devem seguir o planejamento nutricional da fazenda; o tutorial apenas explica o cálculo.", example: "Exemplo fictício: 400 kg × 2,5% PV = 10 kg por cabeça/dia do ingrediente. Para 10 animais, são 100 kg/dia." },
  { id: "protocols", title: "Protocolos sanitários", group: "Cadastros", summary: "Organize o manejo e diferencie vínculo de aplicação.", path: "Sanidade > Protocolos", route: "/sanidade/protocolos", managerOnly: true, steps: steps(
    ["Crie o protocolo", "Informe nome e descrição do manejo."],
    ["Adicione os itens", "Preencha tipo, produto, dose e dias de carência conforme o protocolo definido para a fazenda."],
    ["Mantenha a situação correta", "Deixe ativo o protocolo que pode ser selecionado."],
    ["Vincule e confira a aplicação", "No novo lote, Aplicar protocolo ao lote inicia desmarcado. Selecione o protocolo e confirme separadamente se deseja aplicá-lo."]
  ), tip: "O sistema registra o manejo. Produtos, doses e carências devem seguir a orientação técnica e a documentação aplicável." },
  { id: "lots", title: "Criação de lotes", group: "Rebanho", summary: "Siga o roteiro e teste a criação em uma demonstração sem gravação.", path: "Lotes > Novo lote", route: "/lotes/novo", steps: steps(
    ["Confira o espaço", "É obrigatório ter um curral disponível. A ausência de dieta ou protocolo gera aviso, mas não impede o cadastro."],
    ["Preencha a identificação", "Confira código, origem, data de entrada, raça, categoria, sexo, quantidade e peso-alvo."],
    ["Informe os pesos", "Use o peso médio ou cadastre brinco e peso positivo para cada cabeça no modo individual."],
    ["Escolha o curral e revise", "Selecione um curral com vagas suficientes. Dieta e protocolo são opcionais. Revise o resumo antes de criar o lote."]
  ), tip: "Informar apenas quantidade e peso médio não cadastra os brincos. Para acompanhamento individual, identifique os animais.", demo: "lot" },
  { id: "animals", title: "Animais e movimentações", group: "Rebanho", summary: "Localize o animal e acompanhe os vínculos e a situação.", path: "Animais e Lotes > Detalhes", route: "/animais", steps: steps(
    ["Localize pela identificação", "Pesquise por brinco ou SISBOV. Use filtros de movimentação, curral, lote e condição sanitária."],
    ["Confira os detalhes", "Selecione a linha ou cartão do animal para consultar peso, situação e dados associados."],
    ["Cadastre a identificação individual", "Em Novo animal, confira os campos e os vínculos com lote e curral. Não repita o brinco na fazenda."],
    ["Confira as movimentações", "Transferências e saídas são tratadas nos detalhes do lote. Revise quantidade, destino e situação antes de confirmar."]
  ), tip: "Use o filtro de saídos para consultar os animais que deixaram o rebanho ativo. Brincos usam ordem alfabética e numérica." },
  { id: "weighings", title: "Pesagens e GMD", group: "Desempenho", summary: "Registre pesos com datas válidas para acompanhar o ganho.", path: "Pesagens > Nova pesagem", route: "/pesagens/nova", steps: steps(
    ["Escolha o lote", "Confira curral, peso de referência e dias de confinamento."],
    ["Defina tipo e data", "Escolha pesagem amostral, lote completo ou individual. A data precisa ser compatível com a entrada do lote."],
    ["Preencha os pesos", "Nos modos por média, informe cabeças e peso médio. No individual, preencha os pesos dos animais pesados."],
    ["Salve e consulte o GMD", "O GMD do lote usa o ganho desde a entrada dividido pelos dias até a última pesagem válida. O individual exige pesagem individual compatível."]
  ), tip: "Sem uma pesagem posterior válida, o GMD pode ficar em branco. A pesagem por média não cria pesos individuais.", example: "Exemplo fictício: (371 kg − 350 kg) ÷ 15 dias = 1,40 kg/dia." },
  { id: "feed", title: "Registro do trato", group: "Nutrição", summary: "Escolha a refeição atual e informe o que foi fornecido.", path: "Nutrição > Trato > Novo trato", route: "/trato", steps: steps(
    ["Escolha curral, lote e dieta", "A lista mostra os lotes com tratos pendentes. Confira a data. Peso de referência e cabeças são campos de consulta."],
    ["Defina os tratos de hoje", "Escolha 1, 2 ou 3 e selecione o período atual. Um único trato pode ser à noite."],
    ["Confira a oferta", "Revise o diário, a parcela desta refeição e as quantidades por ingrediente. Ajuste Oferta por animal neste trato para refletir a quantidade real."],
    ["Registre e acompanhe", "Não repita o mesmo período no lote/data. Bolinhas e barra mostram os registros. Ao concluir o dia, o lote sai da lista de pendentes para novo trato."]
  ), tip: "O primeiro registro fixa as referências do plano diário. Dieta e número de refeições ficam bloqueados nos registros seguintes daquele lote/data." },
  { id: "reading", title: "Leitura de cocho", group: "Nutrição", summary: "Registre a leitura e confira a oferta-base da manhã.", path: "Nutrição > Leitura de cocho", route: "/trato/leitura", steps: steps(
    ["Abra o curral", "Escolha um curral com lote e confira o contexto."],
    ["Confira a base", "A referência é a manhã. Se a base vier da soma diária da dieta, informe apenas a parcela planejada para a manhã."],
    ["Escolha a nota e salve", "Informe a nota de 0 a 5, sobra em kg quando medida, ajuste e observações."],
    ["Confira antes de aplicar", "A ação de aplicar ajustes pode gerar o trato da manhã. Confira se a refeição já foi lançada antes de registrá-la manualmente."]
  ), tip: "Os balões das leituras explicam as legendas. As faixas são a escala cadastrada no sistema.", table: { headers: ["Nota", "Classificação", "Sobra"], rows: [["0", "Subalimentação", "Sem sobra"], ["1", "Consumo ótimo", "1 a 2%"], ["2", "Ideal", "3 a 5%"], ["3", "Atenção", "Próxima de 10%"], ["4", "Excesso", "15 a 20%"], ["5", "Excesso severo", "Acima de 25%"]] } },
  { id: "adaptation", title: "Plano de adaptação", group: "Nutrição", summary: "Planeje as fases sem confundir o plano com a execução.", path: "Nutrição > Adaptação", route: "/nutricao/adaptacao", steps: steps(
    ["Selecione o lote e revise a base", "Confira início, cabeças, peso médio e custos por kg de ração e volumoso."],
    ["Confira duração e percentuais", "O padrão é 90 dias totais. Revise os percentuais das fases de adaptação conforme o planejamento da fazenda."],
    ["Revise o período posterior", "Os padrões são 2,5% PV de ração e 0,8% PV de volumoso, editáveis no plano."],
    ["Salve e consulte", "O gestor pode salvar, editar ou excluir planos. Outros perfis podem ter apenas consulta."]
  ), tip: "Salvar um plano não registra tratos nem altera automaticamente a dieta do lote. Registre a execução em Trato." },
  { id: "finance", title: "Custos da alimentação", group: "Gestão", summary: "Compare preços com a composição e o frete na mesma unidade.", path: "Gestão > Financeiro", route: "/gestao/financeiro", managerOnly: true, steps: steps(
    ["Informe os preços de compra", "Preencha energia, proteína e núcleo com o preço e o peso da saca. Os padrões são 50 kg, 30 kg e 25 kg."],
    ["Confira composição e frete", "As participações devem somar 100%. O padrão é 80%, 15% e 5%. Escolha a unidade correta do frete; por carga, informe o peso transportado."],
    ["Informe a silagem", "O padrão é por kg. Se usar tonelada, selecione a unidade correspondente. O cálculo da silagem é separado."],
    ["Confira, salve e exporte", "Revise custo entregue por kg e custo da ração por tonelada. Use Salvar custos e os botões de exportação quando necessário."]
  ), tip: "O módulo calcula custos da alimentação. Não é um controle completo de caixa ou contas a pagar.", example: "Exemplo fictício: energia a R$ 1,50/kg × 80% + proteína a R$ 2,00/kg × 15% + núcleo a R$ 4,00/kg × 5% = R$ 1,70/kg de ração." },
  { id: "suggestion", title: "PDF de sugestão de trato", group: "Relatórios", summary: "Confira a sugestão diária de todos os lotes ativos.", path: "Trato > PDF sugestão de trato", route: "/trato", steps: steps(
    ["Revise os lotes", "Confira entrada, cabeças, curral e última pesagem. Sem pesagem, o relatório usa o peso médio de entrada."],
    ["Gere o documento", "O relatório divide ração e volumoso em três refeições iguais, por lote, com a entrada como dia 1."],
    ["Confira a regra", "A grade é fixa para esse relatório. Ela não lê automaticamente os percentuais dos planos de adaptação salvos."],
    ["Use como sugestão", "O PDF não desconta tratos fornecidos e não registra a execução. Confira os lotes com dados incompletos antes de usar os totais."]
  ), tip: "Valores por refeição são em kg por lote. A grade do relatório não substitui a definição técnica da dieta.", table: { headers: ["Dia de cocho", "Ração (% PV)", "Volumoso (% PV)"], rows: [["1 a 3", "0,3%", "3,0%"], ["4 a 6", "0,8%", "2,5%"], ["7 a 9", "1,3%", "2,0%"], ["10 a 12", "1,8%", "1,5%"], ["13 a 15", "2,3%", "1,0%"], ["16 ou mais", "2,5%", "0,8%"]] } },
  { id: "exports", title: "Exportações e filtros", group: "Relatórios", summary: "Confira a consulta antes de gerar PDF ou Excel.", path: "Telas com botões PDF e Excel", steps: steps(
    ["Escolha a página", "Abra a listagem ou cálculo e confira os botões disponíveis na sua versão."],
    ["Aplique os filtros", "Revise busca, movimentação, curral, lote, data ou situação antes de exportar."],
    ["Aguarde os dados", "Os botões podem ficar desabilitados durante o carregamento ou quando não há linhas."],
    ["Exporte e confira", "PDF favorece leitura; Excel permite trabalhar com os dados em planilha. Confira fazenda, data, filtros, unidades e quantidade de registros."]
  ), tip: "A sugestão diária de trato é diferente das exportações gerais: ela considera todos os lotes ativos e usa uma grade própria." },
  { id: "team", title: "Equipe e administração", group: "Gestão", summary: "Convide pessoas com suas próprias contas e os perfis corretos.", path: "Gestão > Usuários e Configurações", route: "/config/usuarios", managerOnly: true, steps: steps(
    ["Crie o convite", "Informe e-mail e perfil do convidado. Depois de criar, oriente a pessoa a acessar o site."],
    ["Oriente o cadastro", "O convidado deve cadastrar-se com o mesmo e-mail, confirmar quando solicitado e aceitar o convite. Não há envio automático do e-mail de convite."],
    ["Confira os vínculos", "O convite vale por 14 dias. Consulte pendentes, cancele convites quando necessário e revise a equipe."],
    ["Diferencie os controles", "Gestor administra os cadastros liberados; operador usa suas rotinas. Administração do sistema é exclusiva do administrador da plataforma e fica em Configurações."]
  ), tip: "Aprovação de proprietário e aceite de convite de equipe são fluxos diferentes. Cortesia financeira não reativa uma conta suspensa." },
  { id: "market", title: "Mercado e cotações", group: "Gestão", summary: "Consulte a fonte, a data e a unidade antes de comparar preços.", path: "Gestão > Mercado e cotações", route: "/gestao/mercado", steps: steps(
    ["Escolha físico ou futuro", "Boi gordo, milho, soja e sorgo têm tabelas incorporadas. A tabela do boi traz estados brasileiros disponíveis no indicador Datagro, incluindo Goiás; não cobre todas as unidades federativas."],
    ["Confira os contratos", "O mercado futuro tem abas de gráficos para Boi Gordo (BGI), Soja (SJC) e Milho (CCM), todos negociados na B3, com dados exibidos por TradingView."],
    ["Compare referências compatíveis", "Boi futuro está em R$/@, milho em R$/saca de 60 kg e soja SJC em US$/saca de 60 kg. As séries contínuas mostram a evolução histórica e não uma previsão ou curva por vencimento."],
    ["Consulte a alternativa", "Se o quadro não abrir, use o botão da fonte. Recarregar o quadro não altera a data do preço publicado."]
  ), tip: "Esta página depende da instalação da atualização de mercado. Não promete tempo real. Ainda não há fonte pública confirmada para incorporar torta de algodão." },
  { id: "help", title: "Dúvidas e conferência diária", group: "Ajuda", summary: "Confira os registros e as permissões antes de repetir uma ação.", path: "Consulta rápida", steps: steps(
    ["Não consigo criar o lote", "Confira curral, manutenção, vagas, quantidade e pesos válidos."],
    ["Dieta ou lote não aparece no trato", "Confira se a dieta está ativa, se o plano diário já foi iniciado e se as refeições do dia foram concluídas."],
    ["O GMD está em branco", "Confira a pesagem posterior à entrada. Para o animal, precisa haver pesagem individual compatível."],
    ["Preciso relatar um erro", "Leia a mensagem e consulte a listagem antes de repetir o salvamento. Use o botão de feedback e descreva a página, a ação e o resultado."]
  ), tip: "Ao encerrar o dia, confira tratos, leituras, ocorrências e pendências. Antes de compartilhar relatórios, revise fazenda, data, filtros e unidades." },
];

export function chapterForPath(pathname: string): number {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const aliases: [string, string][] = [["/lotes", "lots"], ["/currais", "pens"], ["/pesagens", "weighings"]];
  const candidates = tutorialChapters.flatMap((chapter, index) => chapter.route && chapter.id !== "suggestion" ? [{ route: chapter.route, index }] : []);
  for (const [route, id] of aliases) candidates.push({ route, index: tutorialChapters.findIndex(chapter => chapter.id === id) });
  return candidates.sort((a, b) => b.route.length - a.route.length).find(candidate => path === candidate.route || (candidate.route !== "/" && path.startsWith(candidate.route + "/")))?.index ?? 0;
}
export function tutorialPage(index: number, total = tutorialChapters.length): number {
  return Math.max(0, Math.min(total - 1, index));
}
export type LotDemoState = { stage: 0 | 1 | 2 | 3 | 4; penChosen: boolean };
export const initialLotDemo: LotDemoState = { stage: 0, penChosen: false };
export function lotDemoReducer(state: LotDemoState, action: "start" | "next" | "back" | "choose-pen" | "clear-pen" | "create" | "reset"): LotDemoState {
  if (action === "reset") return { ...initialLotDemo };
  if (action === "start" && state.stage === 0) return { stage: 1, penChosen: false };
  if (action === "next" && (state.stage === 1 || state.stage === 2)) return { ...state, stage: (state.stage + 1) as 2 | 3 };
  if (action === "back" && state.stage > 0 && state.stage < 4) return { ...state, stage: (state.stage - 1) as 0 | 1 | 2 };
  if (action === "choose-pen" && state.stage === 3) return { ...state, penChosen: true };
  if (action === "clear-pen" && state.stage === 3) return { ...state, penChosen: false };
  if (action === "create" && state.stage === 3 && state.penChosen) return { ...state, stage: 4 };
  return state;
}
