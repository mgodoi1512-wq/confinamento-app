# Resultado da revisão de continuidade — 24/10/2026

## Estado de cada frente

| Frente | Resultado | Limite |
|---|---|---|
| Integridade | Regra do banco e formulário já existentes, revalidados | Instalação na produção não confirmada |
| Lotes antigos | Consulta ampliada para ativos/encerrados e vínculos de animais | Não executada no banco real; não corrige automaticamente |
| Supabase real | Diagnóstico de grants, RLS, funções, aceite/triggers e comparação de histórico | Precisa dos resultados reais e revisão das funções instaladas |
| Recuperação | Ensaio com dados fictícios exportados/restaurados em outra instância local | Não certifica backups, Auth ou serviços hospedados |
| Exclusão/retenção | Roteiro de atendimento e matriz para adoção | Sem expurgo automático; prazos jurídicos por categoria ainda precisam definição |
| Desempenho | Imagens otimizadas, logo menor para PDFs, gráfico separado e carregado perto da área visível | Sem medição de velocidade em dispositivos reais |

## Imagens utilizadas nas telas e relatórios

Os fundos mantêm 1536 × 1024; as versões de logo são 512 × 512. A arte e as cores foram mantidas, com compressão WebP nos fundos. Os originais continuam disponíveis para compatibilidade. Isto reduz transferência nas páginas, não promete a mesma redução no tamanho total do backup de código.

| Original | Antes | Versão usada | Depois | Redução |
|---|---:|---|---:|---:|
| public/bg-luz.png | 2270.8 KiB | public/bg-luz.webp | 128.0 KiB | 94.4% |
| public/bg-dark.png | 1987.8 KiB | public/bg-dark.webp | 80.4 KiB | 96.0% |
| public/logo-liben-2.png | 2545.2 KiB | public/logo-liben-2.webp | 287.2 KiB | 88.7% |
| public/logo-liben-dark.png | 3062.1 KiB | public/logo-liben-dark.webp | 312.2 KiB | 89.8% |
| public/logo-liben-2.png | 2545.2 KiB | public/logo-relatorio.png | 437.2 KiB | 82.8% |

O gráfico Recharts continua com os mesmos dados e cálculos. Sua implementação passa para `weight-chart-content.tsx`, carregada dinamicamente quando se aproxima da tela. Painel sem dados não carrega a biblioteca. Navegadores sem IntersectionObserver usam o carregamento imediato com fallback. A compilação produziu um chunk separado de aproximadamente 368 kB (108 kB gzip).

PDF e Excel já utilizavam importação dinâmica; esse comportamento foi preservado. O PDF agora busca `logo-relatorio.png`, mais leve e ainda em PNG para compatibilidade com o gerador. Nenhum limite de chunk foi aumentado para esconder avisos. O bundle principal e Excel ainda geram aviso de tamanho; não houve alegação de que toda a aplicação foi otimizada.

## Verificação local

- Build completo: ESLint, TypeScript e Vite aprovados.
- 30 testes de formulário de lote, exportações, projeção, home e carregamento adiado de gráficos aprovados.
- Cadeia de rebanho: criação completa, baixa única, isolamento, papéis, encerramento e reaplicação aprovados.
- Restauração local: snapshot de dados/políticas/funções idêntico; anon sem mutação e replay sem nova baixa.
- Consulta de divergências executada no banco fictício e verificada como não modificadora de dados.

As verificações não incluem Safari/Android real, medição de rede/Lighthouse, credenciais de produção, pagamentos reais ou configuração instalada do Supabase.

Veja `OPERACAO-RECUPERACAO-E-PRIVACIDADE.md` para roteiro, evidências necessárias e fontes oficiais.
