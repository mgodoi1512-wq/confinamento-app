type Dependencies = {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now?: () => Date;
};

/** Diagnóstico somente leitura. Não cria clientes, cobranças ou acessos. */
export const createSandboxCheckHandler = (deps: Dependencies) => async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  const allowed = (deps.env("APP_ALLOWED_ORIGINS") ?? "").split(",").map(value => value.trim()).filter(Boolean);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  const reply = (status: number, code: string, message: string) => new Response(JSON.stringify({ error: { code, message } }), { status, headers });
  if (origin && !allowed.includes(origin)) return reply(403, "ORIGIN_DENIED", "Origem do site não autorizada para este teste. Confira APP_ALLOWED_ORIGINS no Supabase.");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, "METHOD_NOT_ALLOWED", "Use o botão de teste no painel administrador.");
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return reply(401, "AUTH_REQUIRED", "Entre novamente com sua conta administrativa.");
  const supabaseUrl = deps.env("SUPABASE_URL")?.replace(/\/$/, "");
  const supabaseKey = deps.env("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) return reply(503, "SERVER_NOT_CONFIGURED", "As variáveis internas do Supabase não estão disponíveis nesta função.");
  const supabaseHeaders = { apikey: supabaseKey, Authorization: authorization, "Content-Type": "application/json" };
  const call = (url: string, options: RequestInit) => deps.fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(10000) });

  try {
    // Valida a sessão no Auth; não confia apenas no conteúdo de um JWT recebido.
    const session = await call(`${supabaseUrl}/auth/v1/user`, { method: "GET", headers: supabaseHeaders });
    if (session.status === 401 || session.status === 403) return reply(401, "AUTH_REQUIRED", "Sua sessão expirou. Entre novamente com a conta administrativa.");
    if (!session.ok) return reply(503, "AUTH_UNAVAILABLE", "Não foi possível verificar sua sessão. Tente novamente.");
    const user: unknown = await session.json();
    if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string" || !user.id) return reply(401, "AUTH_REQUIRED", "Sessão de usuário inválida.");
    const admin = await call(`${supabaseUrl}/rest/v1/rpc/is_platform_admin`, { method: "POST", headers: supabaseHeaders, body: "{}" });
    if (!admin.ok) return reply(503, "ADMIN_CHECK_FAILED", "Não foi possível verificar o perfil administrativo. Confira as migrações de acesso do LiBen.");
    if (await admin.json() !== true) return reply(403, "ADMIN_REQUIRED", "Teste exclusivo do administrador da plataforma.");

    let body: unknown;
    const raw = await request.text();
    if (raw.length > 1024) return reply(413, "INVALID_REQUEST", "Dados do teste inválidos.");
    try { body = JSON.parse(raw); } catch { return reply(400, "INVALID_REQUEST", "Dados do teste inválidos."); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("action" in body) || body.action !== "check_connection") return reply(400, "INVALID_REQUEST", "Ação de teste inválida.");

    const key = deps.env("ASAAS_SANDBOX_API_KEY")?.trim();
    if (!key) return reply(503, "ASAAS_KEY_MISSING", "Cadastre ASAAS_SANDBOX_API_KEY nos Secrets das Edge Functions do Supabase.");
    if (!key.startsWith("$aact_hmlg_") || /\s/.test(key)) return reply(503, "ASAAS_KEY_ENVIRONMENT", "Use uma chave nova do Sandbox do Asaas, com prefixo $aact_hmlg_. Chaves de produção não são aceitas neste teste.");
    // O destino é fixo. Nem o navegador nem o ambiente podem apontar para produção.
    const response = await call("https://api-sandbox.asaas.com/v3/customers?limit=1&offset=0", {
      method: "GET", headers: { access_token: key, Accept: "application/json", "User-Agent": "LiBen-Sandbox-Connection/1.0" },
    });
    if (response.status === 401 || response.status === 403) return reply(502, "ASAAS_AUTH_FAILED", "O Sandbox recusou a chave. Confira se ela está correta, ativa e autorizada para consultar clientes.");
    if (response.status === 429) return reply(429, "ASAAS_RATE_LIMIT", "Limite de consultas do Asaas atingido. Aguarde antes de testar novamente.");
    if (!response.ok) return reply(502, "ASAAS_UNAVAILABLE", "O Sandbox não respondeu como esperado. Tente novamente mais tarde.");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("object" in data) || data.object !== "list" || !("data" in data) || !Array.isArray(data.data)) return reply(502, "ASAAS_INVALID_RESPONSE", "A resposta recebida não confirmou a conexão com o Sandbox.");
    // Não devolve nem armazena clientes, dados pessoais, chave ou resposta bruta.
    return new Response(JSON.stringify({ ok: true, environment: "sandbox", checkedAt: (deps.now?.() ?? new Date()).toISOString(), paymentCreationEnabled: false, accessModeChanged: false }), { status: 200, headers });
  } catch {
    return reply(502, "CONNECTION_FAILED", "Não foi possível concluir o teste de conexão. Confira a configuração e tente novamente.");
  }
};
