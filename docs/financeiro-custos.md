# Financeiro — custo da alimentação

Acesso em **Gestão → Financeiro** para gestores da fazenda. A página calcula o preço entregue dos ingredientes, a composição da ração e o custo da silagem. Mantém um conjunto de custos atuais por fazenda, com salvamento explícito e proteção contra sobrescrever alterações de outro gestor.

## Valores iniciais

| Grupo | Ingrediente editável | Peso da saca | Composição |
| --- | --- | ---: | ---: |
| Energia | Milho; pode informar sorgo ou outro nome | 50 kg | 80% |
| Proteína | Torta de Algodão; pode informar casquinha de soja ou outro nome | 30 kg | 15% |
| Núcleo | Núcleo | 25 kg | 5% |

Os preços começam vazios para não sugerir cotações. Frete começa em zero. Pesos e percentuais podem ser editados. A mistura precisa somar 100%; o núcleo entra proporcionalmente com 5% no padrão confirmado.

## Cálculos

Para cada ingrediente:

- Compra por kg = preço da saca ÷ peso da saca.
- Frete por saca: frete por kg = frete ÷ peso da saca.
- Frete por tonelada: frete por kg = frete ÷ 1.000.
- Frete total da carga: frete por kg = frete total ÷ peso total da carga em kg.
- Preço entregue por kg = compra por kg + frete por kg.

**Ração por kg = energia entregue × 80% + proteína entregue × 15% + núcleo entregue × 5%.** As participações utilizadas acompanham os percentuais informados na tela. Os resumos mostram também o custo para 100 kg e uma tonelada de mistura.

A silagem é calculada separadamente. O preço de compra começa em kg e pode ser informado por kg ou tonelada; o frete pode ser por kg, tonelada ou carga. Se o preço estiver vazio e o frete for zero, a silagem fica sem cotação e aparece “—”. Para considerar somente o frete, informar explicitamente preço zero. Frete positivo por carga exige o peso total transportado.

Quando o frete de uma carga contém produtos diferentes, informe para cada ingrediente o valor e o peso que lhe foram atribuídos. Não repita o valor integral de um único frete em todos os ingredientes. O sistema não presume esse rateio entre produtos diferentes.

Preços e fretes são custos informados pelo usuário. Os cálculos não acrescentam automaticamente impostos, perdas, margem, custo de mistura ou matéria seca. A silagem não faz parte dos percentuais da mistura da ração.

## Conferência matemática de teste

| Grupo | Compra | Frete | Custo entregue por kg |
| --- | --- | --- | ---: |
| Energia | R$ 100 / 50 kg | R$ 10 por saca | R$ 2,2000 |
| Proteína | R$ 90 / 30 kg | R$ 30 por tonelada | R$ 3,0300 |
| Núcleo | R$ 200 / 25 kg | R$ 1.000 por carga de 10.000 kg | R$ 8,1000 |

Composição 80/15/5: ração = **R$ 2,6195/kg**, **R$ 261,95 por 100 kg** e **R$ 2.619,50/t**. Silagem de R$ 180/t com frete de R$ 40/t = **R$ 0,2200/kg**. São valores fictícios para conferir a fórmula.

Os cálculos intermediários não são arredondados. A tela mostra quatro casas nos custos por kg e duas nos custos agregados. Os relatórios mantêm mais casas nos custos normalizados.

## Salvamento e relatórios

- Salvar custos guarda os parâmetros na fazenda atual. Não registra uma compra nem um trato.
- Recarregar valores salvos pede confirmação antes de descartar alterações locais.
- Se outro gestor alterar os valores, um salvamento com a versão anterior é rejeitado até recarregar os dados.
- Gestores de outra fazenda, operadores e administradores sem vínculo não têm leitura dos custos daquela fazenda. A segurança é aplicada no banco, além do menu.
- PDF com logo e Excel exportam a simulação atual: preços, peso das sacas, fretes, unidades, peso da carga, percentuais e resultados.
- Os valores não substituem automaticamente preços em planos de adaptação, dietas ou registros já salvos.

## Validação

Build/ESLint/TypeScript e **31 testes** passaram. Os testes cobrem a mistura 80/15/5, equivalência entre unidades de frete, silagem por kg/tonelada, silagem opcional, custo zero explícito e rejeição de valores inválidos.

As suites PostgreSQL UUID/TEXT cobrem instalação sem superusuário, isolamento por fazenda, gestor/operador, chamada anônima, revogação, edição concorrente, reenvio idempotente, acesso direto bloqueado e reaplicação da migração. O executor permanece sem CREATE permanente em public/app_private e sem depender de acesso ao schema auth.

O layout usa cards e tabelas responsivos. A aparência em PC e celular precisa ser conferida após instalar; não houve inspeção visual em navegador nesta entrega.
