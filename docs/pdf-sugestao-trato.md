# PDF da sugestão de fornecimento

Na página **Trato**, use **PDF sugestão de trato**. O botão atualiza os dados e
exporta todos os lotes ativos da fazenda, inclusive os já tratados no dia.
O arquivo é A4 em paisagem, com logo LiBen, fazenda, data, curral, lote, dia de
confinamento, animais, peso médio, etapa, percentuais e quilos por lote para cada
uma das três refeições: manhã, tarde e noite. Há totais gerais por refeição e dia.

A grade da imagem é aplicada automaticamente pelo dia de confinamento:

| Dias | Ração (% PV) | Volumoso (% PV) |
|---|---:|---:|
| 1 a 3 | 0,3 | 3,0 |
| 4 a 6 | 0,8 | 2,5 |
| 7 a 9 | 1,3 | 2,0 |
| 10 a 12 | 1,8 | 1,5 |
| 13 a 15 | 2,3 | 1,0 |
| 16 em diante | 2,5 | 0,8 |

A imagem repete o dia 15 em duas faixas. Este recurso segue a adaptação de 15
dias já cadastrada: o dia 15 fica em 13-15 e a etapa final começa no dia 16.
O dia de entrada do lote é contado como dia 1. Transferência de curral não
reinicia a contagem, pois usa a data de entrada do lote no confinamento.

## Cálculo

Ração diária do lote = peso vivo médio x % ração / 100 x número atual de animais.
Volumoso diário do lote = peso vivo médio x % volumoso / 100 x número de animais.

O peso é o da última pesagem válida do lote até a data atual. Sem pesagem, usa
o peso médio de entrada. Não multiplica pela matéria seca.

Cada quantidade diária é dividida em três refeições em kg, com duas casas
decimais. A diferença de centavos fica na noite, para a soma das refeições
coincidir com o total diário arredondado de cada ingrediente.

Exemplo: 10 animais de 400 kg no primeiro dia. Ração: 12 kg/dia; volumoso:
120 kg/dia. Cada refeição: 4 kg de ração e 40 kg de volumoso para o lote.

## Escopo

É uma sugestão pela grade fixa da imagem, independentemente da dieta vinculada,
da quantidade de tratos do plano diário e dos registros já feitos no dia.
Não registra fornecimento, não modifica dietas e não altera planos congelados.
O PDF não representa o restante a fornecer depois dos tratos já realizados.

Lotes sem data/peso/quantidade válidos aparecem sinalizados, sem inventar quilos.
Se houver esses casos, os totais incluem apenas os lotes com cálculo válido.
Lotes sem curral aparecem como Sem curral, conservando o cálculo quando possível.
Lotes encerrados não entram. A ordenação é natural por curral e lote.

## Instalação

Extraia o pacote dentro do projeto e substitua todos os arquivos, incluindo os
arquivos de fonte em public/fonts. Não precisa executar SQL, instalar pacotes ou
configurar novas variáveis de ambiente.

As fontes DejaVu foram reduzidas para os caracteres usados em textos europeus
e incorporadas ao PDF para impressão consistente. Sua licença acompanha os
arquivos em public/fonts/LICENSE-DejaVu.txt. Os demais relatórios mantêm seu
formato e fonte anteriores.

Valide com npm test e npm run build e publique pelo fluxo habitual de Git/Vercel.
Foram conferidos 54 testes, limites das seis fases, peso e pesagens futuras,
conservação dos totais, casos inválidos e PDF real com logo e fontes incorporadas.
O exemplo com dez lotes foi renderizado e inspecionado para conferência visual.
