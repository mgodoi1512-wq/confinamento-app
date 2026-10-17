# Tutorial interativo

O botão Tutorial fica na barra superior, ao lado da troca de tema. No celular aparece o ícone de livro; no PC aparece também o texto.

O guia abre em tela cheia no capítulo correspondente à página atual. Há 18 capítulos, índice, Anterior, Próxima e Concluir. O conteúdo acompanha os temas claro/escuro. Escape fecha a janela; as setas do teclado mudam a página quando o foco está no texto. O botão Abrir página real fecha o tutorial e navega para a ferramenta.

Criação de lotes inclui uma demonstração clicável com dados fictícios e exigência de seleção do curral. Ela não chama o banco nem cria registros. O conteúdo do manual foi adaptado para texto interativo; não é um visualizador do arquivo PDF. Para atualizar os capítulos, edite `src/lib/tutorial.ts`.

## Instalação

1. Faça uma cópia de segurança do projeto.
2. Copie a pasta `src` deste pacote para a raiz do projeto, mesclando pastas e substituindo somente os arquivos de mesmo nome.
3. Execute `npm run build` antes de publicar. Não é necessária alteração no Supabase nem instalação de dependências.
4. Para publicar pelo Git, adicione os arquivos desta atualização, faça commit e push na branch conectada à Vercel.

```powershell
git add src/components/app/topbar.tsx src/components/tutorial src/lib/tutorial.ts
git commit -m "Adiciona tutorial interativo da plataforma"
git push origin main
```

O pacote inclui apenas o tutorial e a alteração da barra superior. Ele pressupõe as atualizações anteriores já instaladas. Conteúdo sobre Mercado corresponde à atualização de mercado preparada anteriormente.

## Validação

`node --test tests/tutorial.test.mjs` valida rotas, limites da navegação e o fluxo de demonstração pelos handlers reais dos botões. `npm run build` valida lint, TypeScript e o pacote de produção. A inspeção visual em navegador não foi executada neste ambiente. Após instalar, confira abertura, índice, navegação e fechamento em PC e celular.
