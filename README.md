# Atualização para vários clientes e fazendas

Para instalar esta versão no banco existente, siga **LEIA-PRIMEIRO-MULTIFAZENDAS.md**. Execute apenas a nova migração e a configuração de administrador; não reaplique o esquema antigo.

# Gestão de Confinamento — versão corrigida

Leia **CORRECOES.md** antes de substituir a versão existente. O frontend depende da nova migração do banco.

```bash
npm ci
npm run check
npm test
npm run test:db
npm run dev
```

Compilação de produção: `npm run build`. Servir `dist/` com fallback de rotas para `index.html`.

O projeto usa React, TypeScript, Vite, Tailwind/shadcn, TanStack Query e Supabase.
A instalação atende **uma fazenda compartilhada por usuários autorizados**. Não usar esta versão como serviço com várias fazendas no mesmo banco.
