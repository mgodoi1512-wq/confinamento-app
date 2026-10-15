# Adaptação: fórmulas e comportamento

Fonte: `GESTÃO DE CONFINAMENTO ATUALIZADA 10-10-26.xlsm`, aba `ADAPTAÇÃO`.
A planilha original foi apenas lida. Não foram executadas macros ou importados dados de rebanho.

## Entradas

- Lote: H1; número de animais: H3; peso vivo total: H5.
- Na página, o peso total é calculado por `peso médio por animal × animais`.
  Essa interpretação mantém a relação de F22, que divide o custo diário pelo número de animais.
- Início: B13. Cada etapa tem três dias; a data final é a inicial mais dois.
- Ração por kg: H7, referenciada a `RAÇÃO!C14`; valor no arquivo: R$ 1,87/kg.
  A aba RAÇÃO forma esse custo ponderando os ingredientes pela composição.
- Volumoso por kg: H9, busca em `Insumos!C8:G30`; valor no arquivo: R$ 0,80/kg.
- Na página, os dois preços por kg são editáveis. Não há integração automática com as abas RAÇÃO e Insumos do Excel.
- Dias totais: G22, inicialmente 75; incluem os 15 dias de adaptação.

## Etapas

| Dias | Ração (% PV) | Volumoso (% PV) |
| --- | ---: | ---: |
| 1–3 | 0,3% | 3,0% |
| 4–6 | 0,8% | 2,5% |
| 7–9 | 1,3% | 2,0% |
| 10–12 | 1,8% | 1,5% |
| 13–15 | 2,3% | 1,0% |

Os valores vêm de D13:E17. No Excel, 0,3% é armazenado como 0,003;
no formulário, informa-se 0,3 e o cálculo divide por 100. Os percentuais são editáveis.

- F13:G17: peso vivo total × percentual de ração ou volumoso.
- H13:I17: quantidade diária do lote × 3 dias.
- J13:J17: ração do período × custo/kg + volumoso do período × custo/kg.
- H18:I18: somas do consumo nos 15 dias; J18: custo total da adaptação.
- F18:G18 somam quantidades diárias de etapas diferentes. A página não apresenta essa soma como consumo de um único dia; usa os totais de período H18:I18.

## Após adaptação e confinamento completo

- A22:B22: 2,3% de ração e 0,8% de volumoso, editáveis.
- C22:D22: quantidades diárias do lote = peso vivo total × percentual.
- E22: custo diário do lote = ração diária × preço/kg + volumoso diário × preço/kg.
- F22: custo diário por animal = custo diário do lote ÷ animais.
- H22:I22: consumo da adaptação + consumo diário após adaptação × (dias totais − 15).
- J22: custo de toda a ração + custo de todo o volumoso.

O peso não cresce ao longo da simulação, conforme as fórmulas originais.
A página bloqueia dias totais inferiores a 15 para evitar períodos e consumos negativos.
As contas usam a precisão integral; os resultados são formatados apenas na apresentação.

## Exemplo conferido

10 animais × 400 kg; ração a R$ 1,87/kg; volumoso a R$ 0,80/kg; 75 dias.

- Adaptação: 780 kg de ração e 1.200 kg de volumoso; R$ 2.418,60 por lote.
- Após adaptação: 92 kg/dia de ração e 32 kg/dia de volumoso; R$ 197,64/dia por lote.
- Confinamento inteiro: 6.300 kg de ração e 3.120 kg de volumoso; R$ 14.277,00 por lote.
- Custo total por animal: R$ 1.427,70.

A pasta de testes contém três cenários calculados a partir das fórmulas reais,
com entradas sintéticas. Inclui 15 dias totais e preços iguais a zero.
Nenhum resultado usa os zeros salvos em cache da planilha sem lote preenchido.

## Página e salvamento

- Menu Nutrição → Adaptação; endereço `/nutricao/adaptacao`.
- Selecionar um lote preenche animais e peso médio; se houver plano salvo, abre os parâmetros salvos.
- A média vem da última pesagem válida do lote ou do peso médio de entrada quando não houver pesagem.
- Os parâmetros ficam congelados no plano. O botão Atualizar dados do lote carrega novamente peso e animais sem alterar os demais campos.
- Há um plano por lote, com resumo de custos por lote e por animal, e exportação PDF/Excel.
- Gestores salvam; operadores consultam, simulam e exportam. Fazendas não compartilham planos.
- O salvamento usa verificação de versão para evitar sobrescrever alterações de outro usuário.
- Planos de lotes encerrados continuam disponíveis para consulta.
- Salvar não lança tratos, não altera dietas e não altera pesagens.
- Os campos de custo por lote na lateral da planilha (L2:M22) não continham fórmulas ou valores de custo. Na página, o resumo vem dos planos salvos.

## Validação e limites

21 testes de domínio/exportação passaram, incluindo comparação de todos os resultados
quantitativos e custos das etapas e da simulação com os três cenários extraídos da planilha.
Os testes PostgreSQL em perfis UUID e TEXT validaram gravação, repetição sem duplicar,
controle de versão, isolamento por fazenda, consulta por operador e gravação apenas por gestor.
Build, lint e TypeScript passaram. O navegador automatizado não estava disponível neste
ambiente; a aparência deve ser conferida no PC e no celular após aplicar a atualização.
