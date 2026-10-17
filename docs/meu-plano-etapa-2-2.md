# Meu plano — etapa 2.2, Sandbox

O botão **Meu plano** fica em **Configurações**, abaixo do atalho **Usuários e perfis**. Abre `/config/plano`. Layout responsivo: dois planos lado a lado no computador e empilhados no celular; campos e ações se ajustam à largura.

Valores iniciais: **R$ 24,90 mensal** e **R$ 249,90 anual**, lidos do painel administrativo. O anual é um pagamento único por um ano, sem parcelamento implementado pelo LiBen. Os valores já alterados no painel são preservados.

## O que está disponível

- Página com planos, formas de pagamento e situação da cobrança mais recente.
- Criação de uma cobrança de teste por Pix ou cartão. O pagamento abre na fatura do Asaas; o LiBen não recebe número, validade ou código do cartão.
- **Atualizar situação** consulta a API do Asaas e confere cliente, identificador, valor e forma de pagamento antes de atualizar o registro.
- Validade simulada de um mês ou um ano, com início na primeira confirmação elegível, usando a data de São Paulo. Consultas repetidas não estendem esse período. Pix só valida em RECEIVED; cartão em CONFIRMED ou RECEIVED. Autorização do cartão sem captura e análise de risco não validam o período.
- Após concluir o pagamento, **Encerrar este teste** arquiva o ensaio local e permite experimentar outro plano ou forma de pagamento. Mantém o registro e não cancela nem estorna o pagamento no Asaas.
- Testes permitidos somente ao administrador da plataforma que também seja titular de uma fazenda aprovada. Gestores convidados visualizam a página, mas a gestão do pagamento pertence ao titular. Usuários comuns não geram cobranças Sandbox.

**O acesso permanece manual.** Esta etapa não ativa a cobrança de produção, não bloqueia usuários, não gera renovação automática e não instala Webhook. O pagamento cobre um período de teste; ainda não é uma assinatura recorrente. A confirmação nesta versão ocorre ao clicar em Atualizar situação, sem consultas automáticas repetidas.

## Instalação

Pré-requisitos: controle de cobrança da etapa 1 instalado e teste da conexão Sandbox da etapa 2.1 funcionando.

1. Extraia o pacote na raiz do projeto, onde está `package.json`, substituindo os arquivos correspondentes. Não apague o restante do projeto.
2. No **SQL Editor** do projeto Supabase correto, execute todo o arquivo `supabase/migrations/20261017020000_sandbox_my_plan.sql`. A migração pode ser reaplicada; preserva os registros e preços. Não execute scripts de limpeza.
3. Em **Edge Functions**, crie uma nova função usando o editor. Cole **todo** o conteúdo de `instalacao/asaas-sandbox-payment-editor.txt` em `index.ts`. O nome da nova função deve ser exatamente **asaas-sandbox-payment**. A função anterior **asaas-sandbox-check** permanece como está. Mantenha a verificação JWT habilitada, assim como na função anterior.
4. Os Secrets já cadastrados são reutilizados: `ASAAS_SANDBOX_API_KEY` e `APP_ALLOWED_ORIGINS`. A chave aceita começa com `$aact_hmlg_`. Não habilite operações de saque/transferência para esta integração. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis internas disponibilizadas às funções hospedadas. Nunca copie a chave service role ou a chave Asaas para o frontend, `.env` do Vite, Git ou mensagens.
5. Publique a nova função no Supabase. Depois execute `npm run build` localmente e publique o frontend pelo Git integrado à Vercel.

Alternativa pelo terminal, para quem já utiliza Supabase CLI:

```powershell
npx supabase functions deploy asaas-sandbox-payment --project-ref SEU_PROJECT_REF --use-api
```

Use o identificador do seu projeto real; não utilize o identificador de exemplo do arquivo de configuração local. A publicação na Vercel não executa o SQL e não publica Edge Functions do Supabase.

## Teste acompanhado

1. Entre com a conta administrativa titular de uma fazenda aprovada.
2. Acesse **Configurações → Meu plano** e confira os preços.
3. Escolha o mensal e Pix, preencha nome fictício e CPF/CNPJ numérico válido para homologação e marque a confirmação de teste. Os dígitos verificadores são validados antes da geração. Não use documentos reais de clientes.
4. Clique em **Gerar pagamento de teste**, depois em **Abrir pagamento no Asaas**. Não tente pagar QR Code de teste em aplicativo bancário real.
5. No painel **Sandbox do Asaas**, abra a cobrança e utilize a opção para simular/confirmar o pagamento. A opção e o estado final dependem da situação da conta de teste. Caso o Pix permaneça CONFIRMED, aguarde RECEIVED para a validade simulada aparecer.
6. Volte ao LiBen e clique em **Atualizar situação**. Confira valor, forma e período simulado. Atualize novamente: a validade deve permanecer igual.
7. Clique em **Encerrar este teste**. Agora experimente o anual e cartão. Na fatura do Asaas, utilize os dados de homologação oficiais: cartão `4444 4444 4444 4444`, CVV `123` e validade futura; os dados do titular devem ser fictícios.
8. Confira também uma conta comum: ela não deve gerar cobranças de teste. O acesso ao restante da plataforma continua como antes, inclusive para quem não pagou nada.

## Proteção contra duplicidade e falhas

O banco reserva um único pagamento em andamento por fazenda, com trava transacional. Repetir o clique ou mudar o plano durante uma geração em andamento reaproveita a reserva existente. Preço e vínculo da fazenda vêm do banco, não do navegador.

Se a resposta da criação se perder, Atualizar situação procura a cobrança pelo identificador externo. Não faz um novo POST de cobrança. Se ainda não houver cobrança identificável, o registro fica **Geração em conferência** e requer verificar no Asaas antes de qualquer recuperação. Uma recusa de dados pelo provedor também pode exigir essa conferência; o sistema prefere manter a tentativa bloqueada a criar duas cobranças. Não remova reservas diretamente sem conferir no Sandbox se a cobrança chegou a ser criada.

Consultas com início anterior à última aplicada não sobrescrevem uma situação mais recente. Chaves, documentos e corpos de erro do provedor não são devolvidos ao navegador. O documento informado é enviado ao cliente de teste no Asaas; o LiBen guarda somente os identificadores do cliente e da cobrança, além do registro do plano.

## Validação realizada no desenvolvimento

Build de produção com lint e TypeScript; tipagem estrita do handler; 16 testes locais do handler com API simulada, testes SQL em PostgreSQL/PGlite e integração com as migrações reais nos esquemas legados UUID e TEXT para permissões, isolamento, valores, retomada, idempotência e validade. Não foi executado pagamento real nem teste conectado à sua conta Asaas. A homologação na conta do usuário ocorre após instalar o pacote.

## Próxima etapa

Após os testes: Webhooks autenticados e conciliação automática, recorrência/cancelamento, política de atraso e acesso, homologação final e liberação do modo automático pelo painel. Pix comum exige um novo pagamento em cada período; isso não é Pix Automático.

Referências oficiais consultadas em 17/10/2026:
- https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito
- https://docs.asaas.com/reference/criar-nova-cobranca
- https://docs.asaas.com/reference/listar-cobrancas
- https://docs.asaas.com/docs/faq-sandbox
- https://docs.asaas.com/docs/como-adicionar-dinheiro-para-testes
- https://docs.asaas.com/docs/sobre-os-webhooks
