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
  demo?: "lot" | "cycle";
};
const steps = (...rows: [string, string][]) => rows.map(([title, text]) => ({ title, text }));

export const tutorialChapters: TutorialChapter[] = [
  { id: "welcome", title: "Ciclo de gestão da fazenda", group: "Comece por aqui", summary: "Da criação da fazenda à venda dos animais: conheça as ferramentas e o resultado de cada etapa.", path: "Tutorial > Visão do ciclo", steps: [], demo: "cycle", tip: "Este mapa explica o processo; não indica tarefas concluídas na sua fazenda. Os capítulos e a demonstração não gravam dados. Use o índice ou avance pelas páginas. Escape fecha o tutorial." },
  { id: "access", title: "Acesso e primeiro cadastro", group: "Primeiros passos", summary: "Configure a propriedade e confira as condições de acesso da sua conta.", path: "Tela de login > Criar conta", steps: steps(
    ["Crie sua conta", "Na tela de login, escolha Criar conta, informe os dados solicitados, incluindo telefone, e confirme o e-mail quando solicitado."],
    ["Confira a liberação", "O acesso depende do modo definido pela plataforma: liberação manual ou contratação de plano. Confirmação de e-mail, assinatura e aprovação de acesso são verificações diferentes. Siga a orientação exibida na sua conta."],
    ["Cadastre ou aceite a fazenda", "O proprietário informa nome, estado e município. Em Configurações, confira os sistemas de criação: confinamento, semiconfinamento ou a pasto. Quem recebeu convite aceita o vínculo com a fazenda indicada."],
    ["Confira seu acesso", "Em Configurações, confira a fazenda e seu perfil. Para recuperar a senha, use Esqueci minha senha na tela de login."]
  ), tip: "Cada pessoa deve usar sua própria conta. Não compartilhe a senha do proprietário com a equipe." },
  { id: "settings", title: "Fazenda e sistemas de criação", group: "Primeiros passos", summary: "Mantenha os dados da propriedade e os sistemas de manejo atualizados.", path: "Configurações > Dados da fazenda e Sistemas de criação", route: "/config", steps: steps(
    ["Confira a propriedade", "Revise nome, estado e município. O responsável autorizado pode editar os dados e usar Salvar dados."],
    ["Informe os sistemas", "Selecione os sistemas utilizados e o padrão quando solicitado. Se aparecer um aviso de cadastro incompleto, informe o sistema para continuar o uso da fazenda."],
    ["Confira os lotes existentes", "A atualização respeita a identificação dos lotes. Consulte Como funciona para conferir as regras de preenchimento dos lotes sem sistema. Lotes já identificados não são alterados automaticamente."],
    ["Encontre os acessos", "Configurações reúne atalhos para locais de manejo, usuários e perfis e Meu plano. Administração do sistema aparece apenas para quem tem essa permissão."]
  ), tip: "Sistemas de criação e dados da fazenda têm seus próprios botões de salvamento. As opções de edição dependem do perfil de acesso." },
  { id: "dashboard", title: "Painel e navegação", group: "Primeiros passos", summary: "Comece pela visão geral e aprofunde a consulta nas páginas de manejo.", path: "Operação > Visão geral", route: "/", steps: steps(
    ["Confira o resumo", "Veja animais presentes, peso, ocupação e tratamentos. Ocupação por local e últimos tratos exibem até cinco registros por página ou quadro, conforme o painel."],
    ["Veja o financeiro de hoje", "Confira saldo, entradas e saídas no painel financeiro. Abra o Fluxo de caixa para conferir lançamentos e compromissos pendentes; estimativas de venda não são saldo disponível."],
    ["Consulte as pendências", "Verifique leituras, tratos e necessidade de pesagens. Um trato registrado no dia não significa que todas as refeições foram concluídas."],
    ["Use os atalhos", "Novo lote, Iniciar ronda e Acompanhar mercado levam às ferramentas. No PC, recolha o menu pela seta lateral; no celular, use o botão de menu. O tutorial continua acessível no topo."]
  ), tip: "Se um indicador estiver em branco, confira se os dados necessários já foram registrados. Em branco não significa zero." },
  { id: "pens", title: "Locais e capacidade", group: "Cadastros", summary: "Prepare o espaço antes de receber o lote.", path: "Locais de manejo ou Configurações > Locais de manejo", route: "/config/currais", managerOnly: true, steps: steps(
    ["Cadastre o local", "Informe tipo, código, capacidade em cabeças e os demais campos disponíveis, como área. A identificação exibe o tipo antes do código."],
    ["Defina a situação", "Locais em manutenção não devem receber novos lotes."],
    ["Confira a ocupação", "A ocupação acompanha os animais alocados. Use busca e filtros por tipo e situação para localizar os espaços; avance pela paginação quando necessário."],
    ["Garanta vagas suficientes", "A criação do lote exige um local válido com capacidade para a quantidade informada."]
  ), tip: "A capacidade cadastrada deve representar a estrutura física real.", example: "Capacidade de 30 cabeças menos 18 alocadas = 12 vagas. Um novo lote com 15 cabeças precisa de outra organização de espaço." },
  { id: "diets", title: "Cadastro de dietas", group: "Cadastros", summary: "Defina ingredientes e confira as unidades usadas no cálculo.", path: "Nutrição > Dietas", route: "/config/dietas", managerOnly: true, steps: steps(
    ["Vincule os ingredientes", "Cadastre os itens no Estoque e escolha um item para cada componente da dieta, como ração pronta e volumoso. Informe um nome de dieta único na fazenda."],
    ["Escolha kg ou % PV", "Em kg, informe a quantidade diária por cabeça. Em % PV, a oferta é calculada pelo peso vivo de referência do lote. O padrão do cadastro é percentual."],
    ["Revise os percentuais", "% PV não é a participação do ingrediente na mistura. A composição da mistura é outro cálculo, usado na Calculadora de ração e na produção de ração do Estoque."],
    ["Confira saldo e situação", "A dieta mostra o saldo disponível de cada componente. Estoque zerado permite salvar a formulação vinculada, mas o trato será bloqueado se faltar saldo. Somente dietas ativas aparecem para novos tratos."]
  ), tip: "Os percentuais devem seguir o planejamento nutricional da fazenda; o tutorial apenas explica o cálculo.", example: "Exemplo fictício: 400 kg × 2,5% PV = 10 kg por cabeça/dia do ingrediente. Para 10 animais, são 100 kg/dia." },
  { id: "protocols", title: "Protocolos sanitários", group: "Cadastros", summary: "Organize o manejo e diferencie vínculo de aplicação.", path: "Sanidade > Protocolos", route: "/sanidade/protocolos", managerOnly: true, steps: steps(
    ["Crie o protocolo", "Informe nome e descrição do manejo."],
    ["Adicione os itens", "Preencha tipo, produto, dose e dias de carência conforme o protocolo definido para a fazenda."],
    ["Mantenha a situação correta", "Deixe ativo o protocolo que pode ser selecionado."],
    ["Vincule e confira a aplicação", "No novo lote, Aplicar protocolo ao lote inicia desmarcado. Selecione o protocolo e confirme separadamente se deseja aplicá-lo."]
  ), tip: "O sistema registra o manejo. Produtos, doses e carências devem seguir a orientação técnica e a documentação aplicável." },
  { id: "lots", title: "Criação de lotes", group: "Rebanho", summary: "Siga o roteiro e teste a criação em uma demonstração sem gravação.", path: "Lotes > Novo lote", route: "/lotes/novo", steps: steps(
    ["Confira o espaço", "É obrigatório ter um local disponível. A ausência de dieta ou protocolo gera aviso, mas não impede o cadastro."],
    ["Preencha a identificação", "Confira código, origem, data de entrada, raça, categoria, sexo, quantidade e peso-alvo."],
    ["Informe pesagem e preço", "Por lote, informe peso médio e preço por cabeça, opcional. Com Cadastrar os animais automaticamente marcado, confira os brincos sugeridos. No modo individual, informe brinco, peso positivo e preço opcional para cada animal."],
    ["Escolha o local e revise", "Selecione um local com vagas suficientes. Dieta e protocolo são opcionais. Revise o resumo antes de criar o lote."]
  ), tip: "No modo por lote, confira a opção de cadastro automático e os brincos antes de salvar. Sem essa opção, ficam apenas quantidade e médias. Os preços de compra não geram pagamentos automáticos no caixa.", demo: "lot" },
  { id: "animals", title: "Animais e movimentações", group: "Rebanho", summary: "Localize o animal e acompanhe os vínculos e a situação.", path: "Animais e Lotes > Detalhes", route: "/animais", steps: steps(
    ["Localize pela identificação", "Pesquise por brinco ou SISBOV. Use filtros de movimentação, local, lote e condição sanitária."],
    ["Confira os detalhes", "Selecione a linha ou cartão do animal para consultar peso, situação e dados associados."],
    ["Cadastre a identificação individual", "Em Novo animal, confira os campos e os vínculos com lote e local. O mesmo brinco é bloqueado dentro do lote. Se existir em outro lote da fazenda, o sistema avisa e pede confirmação para continuar."],
    ["Confira as movimentações", "Transferências e saídas são tratadas nos detalhes do lote. Revise quantidade, destino e situação antes de confirmar."]
  ), tip: "Use o filtro de saídos para consultar os animais que deixaram o rebanho ativo. Brincos usam ordem alfabética e numérica." },
  { id: "weighings", title: "Pesagens e GMD", group: "Desempenho", summary: "Registre pesos com datas válidas para acompanhar o ganho.", path: "Pesagens > Nova pesagem", route: "/pesagens/nova", steps: steps(
    ["Escolha o lote", "Confira local, peso de referência e dias no lote."],
    ["Defina tipo e data", "Escolha pesagem amostral, lote completo ou individual. A data precisa ser compatível com a entrada do lote."],
    ["Pese e avance", "Nos modos por média, informe cabeças e peso médio. No individual, confira o brinco, preencha o peso e salve para avançar ao próximo animal. A barra indica o progresso; revise os registros antes de concluir."],
    ["Salve e consulte o GMD", "O GMD do lote usa o ganho desde a entrada dividido pelos dias até a última pesagem válida. O individual exige pesagem individual compatível."]
  ), tip: "Sem uma pesagem posterior válida, o GMD pode ficar em branco. A pesagem por média não cria pesos individuais.", example: "Exemplo fictício: (371 kg − 350 kg) ÷ 15 dias = 1,40 kg/dia." },
  { id: "feed", title: "Registro do trato", group: "Nutrição", summary: "Escolha a refeição atual e informe o que foi fornecido.", path: "Nutrição > Trato > Novo trato", route: "/trato", steps: steps(
    ["Escolha local, lote e dieta", "A lista mostra os lotes com tratos pendentes. Confira a data. Peso de referência e cabeças são campos de consulta."],
    ["Defina os tratos de hoje", "Escolha 1, 2 ou 3 e selecione o período atual. Um único trato pode ser à noite."],
    ["Confira a oferta", "Revise o diário, a parcela desta refeição e as quantidades por ingrediente. Ajuste Oferta por animal neste trato para refletir a quantidade real."],
    ["Confira o estoque e registre", "As quantidades efetivamente fornecidas dos itens vinculados são baixadas do estoque. Falta de saldo bloqueia o fornecimento. Não duplique o mesmo consumo com saída manual. Ao concluir o dia, o lote sai da lista de pendentes."]
  ), tip: "O primeiro registro fixa dieta e número de refeições daquele lote/data. Bolinhas indicam os períodos e a barra compara o fornecido com a recomendação. Passe o mouse ou consulte os detalhes para conferir as quantidades." },
  { id: "reading", title: "Leitura de cocho", group: "Nutrição", summary: "Registre a leitura e confira a oferta-base da manhã.", path: "Nutrição > Leitura de cocho", route: "/trato/leitura", steps: steps(
    ["Abra o local", "Escolha um local com lote e confira o contexto."],
    ["Confira a base", "A referência é a manhã. Se a base vier da soma diária da dieta, informe apenas a parcela planejada para a manhã."],
    ["Escolha a nota e salve", "Informe a nota de 0 a 5, sobra em kg quando medida, ajuste e observações."],
    ["Confira antes de aplicar", "A ação de aplicar ajustes pode gerar o trato da manhã. Confira se a refeição já foi lançada antes de registrá-la manualmente."]
  ), tip: "Os balões das leituras explicam as legendas. As faixas são a escala cadastrada no sistema.", table: { headers: ["Nota", "Classificação", "Sobra"], rows: [["0", "Subalimentação", "Sem sobra"], ["1", "Consumo ótimo", "1 a 2%"], ["2", "Ideal", "3 a 5%"], ["3", "Atenção", "Próxima de 10%"], ["4", "Excesso", "15 a 20%"], ["5", "Excesso severo", "Acima de 25%"]] } },
  { id: "adaptation", title: "Plano de adaptação", group: "Nutrição", summary: "Planeje as fases sem confundir o plano com a execução.", path: "Nutrição > Adaptação", route: "/nutricao/adaptacao", steps: steps(
    ["Escolha lote cadastrado ou avulso", "No cadastrado, confira cabeças e peso de referência. No avulso, informe os dados para simular sem criar lote. Confira também a data de início e os custos por kg."],
    ["Confira fases e custos", "O padrão é 90 dias totais, incluindo a adaptação. Revise as cinco fases e seus percentuais. Os custos salvos na Calculadora de ração servem como padrão; Usar custos salvos atualiza os valores da simulação quando necessário."],
    ["Revise Após a adaptação", "A seção fica logo abaixo das fases. Os padrões são 2,5% PV de ração e 0,8% PV de volumoso, editáveis. Confira quantidades e custos das fases, do período posterior e do ciclo completo."],
    ["Salve, edite ou exporte", "No lote cadastrado, o gestor pode salvar, editar e excluir planos e baixar o PDF. O modo avulso serve para simular e exportar. Custos de um plano já salvo são preservados até você atualizá-los e salvar novamente."]
  ), tip: "Salvar um plano não registra tratos nem altera automaticamente a dieta do lote. Registre a execução em Trato." },
  { id: "finance", title: "Calculadora de ração", group: "Gestão", summary: "Compare preços com a composição e o frete na mesma unidade.", path: "Gestão > Financeiro > Calculadora de ração", route: "/gestao/financeiro/alimentacao", managerOnly: true, steps: steps(
    ["Informe os preços de compra", "Preencha energia, proteína e núcleo com o preço e o peso da saca. Os padrões são 50 kg, 30 kg e 25 kg."],
    ["Confira composição e frete", "As participações devem somar 100%. O padrão é 80%, 15% e 5%. Escolha a unidade correta do frete; por carga, informe o peso transportado."],
    ["Informe o volumoso", "O padrão é preço por kg. Se usar tonelada, escolha a unidade correspondente e confira o frete. Ração e volumoso têm cálculos separados, apresentados lado a lado no PC."],
    ["Confira, salve e exporte", "Revise custo entregue por kg e custo da ração por tonelada. Use Salvar custos e os botões de exportação quando necessário."]
  ), tip: "Salvar custos define os preços de referência da fazenda para novas simulações de adaptação, com lote ou avulsas. Isso não cria estoque nem pagamento; use Estoque e Fluxo de caixa para esses registros.", example: "Exemplo fictício: energia a R$ 1,50/kg × 80% + proteína a R$ 2,00/kg × 15% + núcleo a R$ 4,00/kg × 5% = R$ 1,70/kg de ração." },
  { id: "suggestion", title: "PDF de sugestão de trato", group: "Relatórios", summary: "Confira a sugestão diária de todos os lotes ativos.", path: "Trato > PDF sugestão de trato", route: "/trato", steps: steps(
    ["Revise os lotes", "Confira entrada, cabeças, local e última pesagem. Sem pesagem, o relatório usa o peso médio de entrada."],
    ["Gere o documento", "O relatório divide ração e volumoso em três refeições iguais, por lote, com a entrada como dia 1."],
    ["Confira a regra", "A grade é fixa para esse relatório. Ela não lê automaticamente os percentuais dos planos de adaptação salvos."],
    ["Use como sugestão", "O PDF não desconta tratos fornecidos e não registra a execução. Confira os lotes com dados incompletos antes de usar os totais."]
  ), tip: "Valores por refeição são em kg por lote. A grade do relatório não substitui a definição técnica da dieta.", table: { headers: ["Dia de cocho", "Ração (% PV)", "Volumoso (% PV)"], rows: [["1 a 3", "0,3%", "3,0%"], ["4 a 6", "0,8%", "2,5%"], ["7 a 9", "1,3%", "2,0%"], ["10 a 12", "1,8%", "1,5%"], ["13 a 15", "2,3%", "1,0%"], ["16 ou mais", "2,5%", "0,8%"]] } },
  { id: "cashFlow", title: "Fluxo de caixa", group: "Gestão", summary: "Registre compromissos e acompanhe os valores realizados.", path: "Gestão > Financeiro > Fluxo de caixa", route: "/gestao/financeiro/fluxo-de-caixa", managerOnly: true, steps: steps(
    ["Configure a abertura", "Informe a data inicial e o saldo antes dos pagamentos dessa data. Valores anteriores não são somados novamente."],
    ["Cadastre o lançamento", "Escolha entrada ou saída, categoria e valor. Para saídas, confira o vencimento. O vínculo com lote é opcional. Categorias ajudam a separar compra de animais, alimentação e demais despesas."],
    ["Confirme a realização", "Marque pago ou recebido e informe a data efetiva. Sem confirmação, a conta permanece pendente e entra na projeção."],
    ["Agende empréstimos e confira o patrimônio", "A entrada de empréstimo permite agendar as parcelas de saída com vencimentos mensais, semestrais ou anuais. Uma saída avulsa pode registrar amortização. Consulte contas futuras e o painel de patrimônio; valores de patrimônio não são saldo de caixa."]
  ), tip: "Cálculo do custo da alimentação e movimentação de estoque não criam pagamentos automaticamente. Registre cada compromisso no caixa apenas uma vez." },
  { id: "inventory", title: "Estoque de alimentos e animais", group: "Gestão", summary: "Consulte bovinos, insumos, ração pronta e máquinas da fazenda.", path: "Gestão > Financeiro > Estoque", route: "/gestao/financeiro/estoque", managerOnly: true, steps: steps(
    ["Cadastre os alimentos", "Crie os itens de ração pronta, volumoso e ingredientes. Registre o saldo inicial como entrada, com custo entregue por kg."],
    ["Produza ração", "Em Criar ração, escolha energia, proteína e núcleo, informe os percentuais e a quantidade final. Os percentuais devem somar 100%. Produzir 500 kg de Ração 80-15-5 consome 400 kg, 75 kg e 25 kg dos ingredientes, aumentando a ração pronta em 500 kg."],
    ["Registre as movimentações", "Entradas aumentam o estoque; saídas e perdas reduzem. Vincule os componentes da dieta para baixar o consumo nos próximos tratos. Produção de ração e trato já movimentam os itens: não duplique com saídas manuais."],
    ["Consulte os animais", "Selecione um lote para atualizar os indicadores. Ative a projeção pelo GMD se desejar e use Detalhar para acompanhar os animais, o ganho de peso e a comparação entre compra e venda estimada."],
    ["Confira compra e equipamentos", "No detalhamento dos bovinos, confira os preços de compra e venda estimada. A diferença não é lucro líquido. Em Máquinas/Equipamentos, informe aquisição, valor, ano de fabricação e nota fiscal quando disponíveis."]
  ), tip: "Arrobas de carcaça são estimadas com rendimento configurável. A avaliação dos animais não representa dinheiro recebido. Tratos antigos não são baixados automaticamente ao instalar." },
  { id: "health", title: "Tratamentos e ocorrências", group: "Sanidade", summary: "Registre o que aconteceu e acompanhe o manejo sanitário.", path: "Sanidade > Tratamentos e Ocorrências", route: "/sanidade/tratamentos", steps: steps(
    ["Confira o animal ou lote", "Identifique o grupo ou animal correto antes de registrar o tratamento. Consulte protocolos e histórico quando necessário."],
    ["Registre o tratamento", "Informe data, produto, dose e os demais dados solicitados. Confira as informações de carência disponíveis no manejo."],
    ["Registre as ocorrências", "Na página Ocorrências, descreva o acontecimento e os vínculos solicitados. Ocorrência e aplicação de tratamento são registros distintos."],
    ["Acompanhe a evolução", "Consulte as listagens e o histórico sanitário. Antes de uma saída, confira a situação e as carências aplicáveis."]
  ), tip: "Protocolos organizam o manejo. Aplicações e ocorrências devem refletir o que foi realizado; confirme produto e dose com o responsável técnico." },
  { id: "sale", title: "Projeção e saída dos animais", group: "Resultado do ciclo", summary: "Compare cenários e diferencie estimativa de venda realizada.", path: "Lotes > Detalhes e Financeiro > Estoque > Bovinos", route: "/lotes", steps: steps(
    ["Confira peso e GMD", "Abra o lote e confira entrada, última pesagem e GMD. Sem dados suficientes, a previsão fica indisponível. Um intervalo curto entre pesagens torna a projeção mais sensível."],
    ["Compare a previsão de abate", "Confira o peso-alvo e compare os cenários conservador, realista e otimista. A previsão depende dos dados registrados; não é uma data garantida de venda."],
    ["Estime o valor dos bovinos", "No Estoque, configure preço e rendimento. Selecione o lote para atualizar os indicadores e use Detalhar. Projetar peso pelo GMD exige ganho válido; confira os animais que mantêm o peso de referência."],
    ["Registre a saída e o recebimento", "Nos detalhes do lote, use a ação de saída correspondente e confira os animais e a data. No Fluxo de caixa, registre a receita e confirme quando recebida, sem duplicar lançamentos existentes."]
  ), tip: "Peso, arrobas e valor projetados são estimativas. Compare compra, alimentação e demais despesas para analisar o resultado; venda estimada menos compra não é lucro líquido." },
  { id: "plan", title: "Meu plano e acesso", group: "Conta", summary: "Consulte sua condição de acesso e acompanhe cobranças quando disponíveis.", path: "Perfil no topo ou Configurações > Meu plano", route: "/config/plano", steps: steps(
    ["Confira sua condição", "Em Minha assinatura, consulte o plano, a situação e a validade. Quando houver cortesia, confira a data de expiração exibida."],
    ["Escolha a contratação", "Quando a cobrança estiver habilitada, confira os planos mensal e anual, os valores e as formas de pagamento oferecidas antes de confirmar."],
    ["Acompanhe o pagamento", "Pix e cartão são identificados pela integração. Enquanto aguarda, use Atualizar situação quando disponível. Gerar cobrança não equivale a pagamento confirmado."],
    ["Entre na fazenda", "Após a confirmação do pagamento, use o botão de acesso à plataforma. Para dúvidas de liberação, consulte a mensagem da sua conta e o suporte."]
  ), tip: "Confirmação do e-mail não é confirmação de pagamento. Convites de equipe, cortesia e acesso do proprietário podem seguir condições diferentes." },
  { id: "exports", title: "Exportações e filtros", group: "Relatórios", summary: "Confira a consulta antes de gerar PDF ou Excel.", path: "Listagens > Exportar ou botões do relatório", steps: steps(
    ["Escolha a página", "Abra a listagem ou cálculo e confira o menu Exportar e os formatos disponíveis."],
    ["Aplique os filtros", "Revise busca, movimentação, local, lote, data ou situação antes de exportar."],
    ["Aguarde os dados", "Os botões podem ficar desabilitados durante o carregamento ou quando não há linhas."],
    ["Exporte e confira", "PDF favorece leitura; Excel permite trabalhar com os dados em planilha. Confira fazenda, data, filtros, unidades e quantidade de registros."]
  ), tip: "A sugestão diária de trato é diferente das exportações gerais: ela considera todos os lotes ativos e usa uma grade própria." },
  { id: "team", title: "Equipe e administração", group: "Gestão", summary: "Convide pessoas com suas próprias contas e os perfis corretos.", path: "Gestão > Usuários e Configurações", route: "/config/usuarios", managerOnly: true, steps: steps(
    ["Crie o convite", "Informe e-mail e perfil do convidado. Depois de criar, use Copiar instruções e encaminhe o acesso à pessoa pelo canal desejado."],
    ["Oriente o cadastro", "O convidado deve cadastrar-se com o mesmo e-mail, confirmar quando solicitado e aceitar o convite. Não há envio automático do e-mail de convite."],
    ["Confira os vínculos", "O convite vale por 14 dias. Consulte pendentes, cancele convites quando necessário e revise a equipe. O perfil do proprietário e o seu próprio perfil têm restrições de alteração."],
    ["Diferencie os controles", "Gestor administra os cadastros liberados; operador usa suas rotinas. Administração do sistema é exclusiva do administrador da plataforma e fica em Configurações."]
  ), tip: "Aprovação de proprietário e aceite de convite de equipe são fluxos diferentes. Cortesia financeira não reativa uma conta suspensa." },
  { id: "market", title: "Mercado e cotações", group: "Gestão", summary: "Consulte a fonte, a data e a unidade antes de comparar preços.", path: "Gestão > Mercado e cotações", route: "/gestao/mercado", steps: steps(
    ["Escolha físico ou futuro", "No físico, Bovinos reúne abas de boi gordo, vaca gorda, novilha e bezerro, com referências das regiões disponíveis na fonte. Soja, milho e sorgo têm quadros próprios. A cobertura pode variar por produto."],
    ["Confira os contratos", "O mercado futuro tem abas de gráficos para Boi Gordo (BGI), Soja (SJC) e Milho (CCM), todos negociados na B3, com dados exibidos por TradingView."],
    ["Compare referências compatíveis", "Boi futuro está em R$/@, milho em R$/saca de 60 kg e soja SJC em US$/saca de 60 kg. As séries contínuas mostram a evolução histórica e não uma previsão ou curva por vencimento."],
    ["Consulte a alternativa", "Se o quadro não abrir, use o botão da fonte. Recarregar o quadro não altera a data do preço publicado."]
  ), tip: "Confira sempre fonte, data, praça e unidade. Os gráficos e tabelas dependem da disponibilidade do provedor e não garantem atualização em tempo real." },
  { id: "help", title: "Dúvidas e conferência diária", group: "Ajuda", summary: "Confira os registros e as permissões antes de repetir uma ação.", path: "Consulta rápida", steps: steps(
    ["Não consigo criar o lote", "Confira local, manutenção, vagas, quantidade e pesos válidos."],
    ["Dieta ou lote não aparece no trato", "Confira se a dieta está ativa, se o plano diário já foi iniciado e se as refeições do dia foram concluídas."],
    ["O GMD está em branco", "Confira a pesagem posterior à entrada. Para o animal, precisa haver pesagem individual compatível."],
    ["Preciso relatar um erro", "Leia a mensagem e consulte a listagem antes de repetir o salvamento. Use o botão de feedback e descreva a página, a ação e o resultado."]
  ), tip: "Ao encerrar o dia, confira tratos, leituras, ocorrências e pendências. Antes de compartilhar relatórios, revise fazenda, data, filtros e unidades." },
];

export const tutorialJourney = [
  { title: "Criar a fazenda", shortTitle: "Criar a fazenda", result: "Propriedade identificada e sistema de criação definido.", chapters: ["access", "settings"] },
  { title: "Locais de manejo", shortTitle: "Locais de manejo", result: "Espaços cadastrados, com capacidade e vagas para os lotes.", chapters: ["pens"] },
  { title: "Planejar nutrição e sanidade", shortTitle: "Nutrição e sanidade", result: "Dietas, adaptação, protocolos e custos planejados.", chapters: ["diets", "adaptation", "protocols", "finance"] },
  { title: "Preparar o estoque", shortTitle: "Preparar estoque", result: "Ingredientes disponíveis e ração pronta produzida pela composição.", chapters: ["inventory"] },
  { title: "Cadastrar lotes e animais", shortTitle: "Lotes e animais", result: "Animais identificados, pesados, precificados e alocados.", chapters: ["lots", "animals"] },
  { title: "Tratos e leitura de cocho", shortTitle: "Tratos e cocho", result: "Refeições registradas, estoque baixado e oferta acompanhada.", chapters: ["feed", "reading", "suggestion"] },
  { title: "Acompanhar a saúde", shortTitle: "Saúde do rebanho", result: "Tratamentos e ocorrências registrados no histórico sanitário.", chapters: ["health"] },
  { title: "Pesar e avaliar o desempenho", shortTitle: "Pesagem e GMD", result: "Pesagens atualizadas, ganho e GMD disponíveis quando calculáveis.", chapters: ["weighings"] },
  { title: "Projetar a venda", shortTitle: "Projetar a venda", result: "Peso, arrobas e valor estimados para apoiar a decisão de venda.", chapters: ["sale", "market"] },
  { title: "Vender e registrar o resultado", shortTitle: "Venda e resultado", result: "Saída registrada e recebimentos e despesas conferidos no caixa.", chapters: ["sale", "cashFlow"] },
];

export function chapterForPath(pathname: string): number {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const aliases: [string, string][] = [["/lotes", "lots"], ["/currais", "pens"], ["/pesagens", "weighings"], ["/sanidade/ocorrencias", "health"]];
  const candidates = tutorialChapters.flatMap((chapter, index) => chapter.route && !["suggestion", "sale"].includes(chapter.id) ? [{ route: chapter.route, index }] : []);
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
