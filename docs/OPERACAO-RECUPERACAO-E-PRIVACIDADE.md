# Operação, recuperação e atendimento a exclusões — LiBen

Revisão técnica de 24/10/2026. Procedimento preparado; não é prova de implantação na produção. Responsável operacional proposto: Mateus Godoi. Não foram acessados o Supabase real, segredos, backups reais ou contas Asaas. Nenhum usuário foi excluído e nenhuma rotina de expurgo foi ativada.

## 1. Integridade do rebanho e legado

A migração `20261024010000_herd_count_integrity.sql`, já enviada anteriormente, exige um cadastro individual para cada cabeça na criação do lote pela RPC. O formulário gera os animais com peso inicial igual à média informada; o banco rejeita uma quantidade diferente. Não inventa brincos no servidor quando um cliente antigo manda uma lista vazia: a operação inteira é recusada.

A exclusão de cadastro equivocado mantém os bloqueios de histórico, reduz cabeças e quantidade inicial uma única vez e encerra um lote que ficou vazio. Venda, abate e óbito continuam sendo saídas físicas com histórico, não exclusões. Pesagens e planos de trato já iniciados não são recalculados retroativamente.

Execute `scripts/conferir-rebanho-todos-lotes.sql` para localizar diferenças, incluindo lotes encerrados e animais presentes sem lote/vínculo compatível. O script não cria, recria, exclui nem atualiza nada. Animal sem lote é um item para revisão, não prova automática de falha. Examine a origem de cada diferença antes de uma correção individual; não iguale quantidades em massa e não recrie animais apagados.

## 2. Evidências do Supabase real

No projeto correto, pelo SQL Editor administrativo:

1. Execute `scripts/diagnostico-seguranca-supabase.sql`. Se uma tabela de aceite não existir, pare nesse resultado e informe o erro: não suponha que o restante foi conferido.
2. Execute a primeira consulta de `scripts/conferir-historico-migracoes.sql`; só execute a segunda se a tabela de histórico existir.
3. Execute a conferência do rebanho. Guarde os resultados com data, responsável e projeto, em local restrito. Os IDs e nomes de fazendas continuam sendo informações da operação; não publique os arquivos.
4. Confira no Dashboard a versão das Edge Functions, verificação JWT, SMTP, URLs autorizadas e disponibilidade dos backups. Não exporte chaves ou tokens para o diagnóstico.

Versão registrada não comprova que a função tem o conteúdo esperado. Arquivos executados no SQL Editor podem estar instalados sem registro no histórico. Não use `migration repair`, não remova registros e não reaplique toda a pasta para fazer o histórico coincidir. Compare assinaturas, políticas, concessões e comportamento antes de decidir.

O aceite no formulário não substitui o controle do servidor. A configuração `enforce_on_signup=false` é de transição; nessa condição o servidor ainda não obriga o aceite. Após atualizar site e aplicativo, teste em ambiente isolado um cadastro sem aceite, com versão antiga e com versão válida. Só então planeje ativar a exigência no projeto real. O diagnóstico é somente leitura e não ativa nada.

A função pública de preços é uma exceção intencional: anon pode executar `app_public_plan_prices()`, que retorna apenas mensal/anual. Anon não deve chamar mutações privadas nem ler a tabela de configuração. `SECURITY DEFINER` exige análise conjunta de dono, search_path, grants e validações internas; uma flag sozinha não certifica segurança.

## 3. Backup e restauração

### O que foi ensaiado aqui

`node tests/restore-drill-db.test.mjs` monta dados fictícios usando a cadeia local de testes, exporta o diretório do PGlite e restaura em uma segunda instância. Compara tabelas, políticas RLS, funções/grants e o reenvio de uma exclusão. É um ensaio do banco local; não usa um dump do Supabase, nem testa Auth hospedado, rede, Storage, SMTP, Edge Functions ou Asaas.

### Ensaio necessário no Supabase

1. Identificar plano, tipo e data do backup realmente disponível. Exportação CSV e ZIP do código não são backup recuperável de toda a aplicação.
2. Escolher um backup e restaurar **em projeto de teste separado**. Não apertar restaurar na produção para fazer um teste. Conferir eventuais custos antes de criar o ambiente.
3. Manter o destino sem credenciais Asaas reais, SMTP real, webhooks de produção e tarefas automáticas externas. Inventariar extensões/tarefas antes de habilitar qualquer saída de rede. O clone contém dados pessoais: restringir acesso e manter a mesma proteção do original.
4. Reconfigurar separadamente funções, autenticação, origens, políticas de Storage e arquivos necessários. O backup de banco contém metadados de Storage, não os arquivos. O recurso de restauração em novo projeto também requer reconfiguração de componentes fora do banco.
5. Usar uma cópia local do frontend apontando exclusivamente ao destino. Nunca alterar a Vercel de produção para ensaiar. Conferir duas fazendas isoladas, gestor/operador/anon, contagem de lotes e animais, pesagens/GMD, estoque/tratos, fluxo/parcelas, recibos de aceite e configurações.
6. Conferir integridade e reenvios das RPCs, autenticação de teste e políticas; nenhuma cobrança real deve ser criada. Comparar contagens e amostras ao instante do backup, explicando registros posteriores que não pertencem àquele instante.
7. Registrar horário do backup e início/fim da recuperação; medir perda máxima de dados e duração real. Não declarar meta atendida sem medir. Destruir a cópia com dados reais ao encerrar o ensaio, após guardar somente evidências mínimas.

### Rotina proposta para adoção

Backup do banco antes de cada migração e exportação externa diária criptografada; rotação de cópias operacionais por 30 dias, com acesso restrito e teste mensal em ambiente isolado. São metas propostas, não tarefas agendadas nem garantias do plano contratado. Confirmar armazenamento, custo, cobertura e responsabilidade antes de adotar. Manter inventário separado de Storage, fontes das funções, configurações sem segredos e procedimento seguro de recuperação de credenciais. Nunca guardar dumps reais no Git ou em um ZIP de atualização do site.

## 4. Atendimento de exclusão de conta e retenção

Fluxo operacional proposto, inicialmente manual pelo contato `liben-agro@outlook.com`:

1. Registrar protocolo e escopo: sair de uma equipe, encerrar conta pessoal, excluir uma fazenda ou cancelar apenas a assinatura são ações diferentes.
2. Confirmar identidade por canal autenticado e autoridade sobre cada fazenda; não pedir senha ou código de autenticação por e-mail. Identificar se há outros responsáveis/equipe. Não apagar a fazenda inteira por solicitação de um operador.
3. Informar dados atingidos, alternativa de exportação/transferência da gestão, valores ou registros preservados e motivo. A exportação não deve se tornar obstáculo ao atendimento.
4. Tratar cancelamento de recorrência no Asaas separadamente, com confirmação do provedor. Apagar o usuário do Supabase não cancela cobrança; cancelar plano não apaga dados.
5. Preparar uma execução individual com escopo explícito e ensaio isolado. Revisar FKs e efeitos em cascata; este projeto não recebe um DELETE genérico por usuário. Não apagar o proprietário se isso remover a operação compartilhada de terceiros. Avaliar transferência de gestão ou encerramento autorizado da fazenda.
6. Encerrar acesso/sessões pelos mecanismos administrativos apropriados e verificar as proteções no servidor. Tokens emitidos podem sobreviver até expirar; apagar Auth ou ocultar usuário no frontend não é prova de revogação imediata em todas as APIs.
7. Excluir ou anonimizar o que deixou de ser necessário; conservar apenas registros com justificativa e prazo específico. Limpar arquivos e rascunhos locais conforme escopo; o servidor não apaga automaticamente armazenamento de aparelhos offline.
8. Responder com o que foi executado, o que permanece, fundamento, prazo e responsável pela revisão. Guardar evidência mínima de atendimento. Não guardar uma cópia completa da conta como prova do pedido.

### Matriz de retenção a preencher antes de automatizar expurgo

| Grupo | Tratamento no encerramento | Critério de prazo |
|---|---|---|
| Perfil, contato e acesso | Excluir/anonimizar após análise do pedido e desligamento autorizado | Somente o tempo necessário para atendimento ou obrigação identificada |
| Registros da fazenda com outros usuários | Separar dados pessoais do histórico operacional; transferir gestão quando autorizado | Finalidade da operação e direitos dos demais titulares |
| Cobranças, recibos e aceite | Preservar apenas o mínimo justificável, com acesso restrito | Obrigação concreta, necessidade de comprovação e revisão jurídica/contábil; não foi fixado um prazo universal |
| Logs e evidência do atendimento | Minimizar dados e limitar acesso | Definir janela proporcional à finalidade, revisar no fechamento do pedido |
| Backups operacionais | Não reutilizar como consulta normal; expirar pela rotação e reaplicar exclusões se restaurados | Janela técnica proposta de 30 dias, a validar com o serviço realmente contratado |
| Storage e rascunhos em dispositivos | Inventariar e tratar separadamente | Não presumir eliminação pelo backup do banco ou logout |

As exceções de conservação dependem de justificativa; não tornam todo histórico retido indefinidamente. A LGPD prevê eliminação ao fim do tratamento e hipóteses de conservação no art. 16, além dos direitos do art. 18. Os prazos finais por categoria precisam de revisão da finalidade e das obrigações aplicáveis; esta entrega não altera os termos públicos nem cria promessas legais de prazo. Antes de automatizar exclusões, preencher essa matriz e testar cascatas/restauração em ambiente isolado.

Após restaurar backup antigo, manter os pedidos de eliminação posteriores disponíveis em registro mínimo separado e reaplicá-los antes de reabrir o ambiente. Avaliar também novos consentimentos/versões, convites e vínculos alterados após a data do backup.

## Fontes consultadas em 24/10/2026

- Backup e limites de cobertura: https://supabase.com/docs/guides/platform/backups
- Restauração em projeto separado e componentes não copiados: https://supabase.com/docs/guides/platform/clone-project
- Exclusão de usuário, Storage e tokens emitidos: https://supabase.com/docs/guides/auth/managing-user-data
- LGPD, texto compilado, arts. 16 e 18: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
