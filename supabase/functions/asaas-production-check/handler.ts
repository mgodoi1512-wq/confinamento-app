type CheckDependencies = { env: (name: string) => string | undefined; fetch: typeof fetch; now?: () => Date };
type RecordData = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordData => !!value && typeof value === "object" && !Array.isArray(value);
export const createProductionCheckHandler = (deps: CheckDependencies) => async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  const allowed = (deps.env("APP_ALLOWED_ORIGINS") ?? "").split(",").map(x => x.trim());
  const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  const fail = (status: number, message: string) => new Response(JSON.stringify({ error: { message } }), { status, headers });
  if (origin && !allowed.includes(origin)) return fail(403, "Origem não autorizada.");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return fail(405, "Método inválido.");
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return fail(401, "Entre como administrador.");
  const url = deps.env("SUPABASE_URL")?.replace(/\/$/, ""), anon = deps.env("SUPABASE_ANON_KEY"), service = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  const key = deps.env("ASAAS_PRODUCTION_API_KEY")?.trim(), token = deps.env("ASAAS_PRODUCTION_WEBHOOK_TOKEN");
  if (!url || !anon || !service || !key?.startsWith("$aact_prod_") || /\s/.test(key) || !token || token.length < 32 || token.length > 255 || /\s/.test(token) || token.startsWith("$aact_")) return fail(503, "Configure os Secrets exclusivos de produção: ASAAS_PRODUCTION_API_KEY e ASAAS_PRODUCTION_WEBHOOK_TOKEN.");
  const call = (target: string, init: RequestInit) => deps.fetch(target, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) });
  const userHeaders = { apikey: anon, Authorization: authorization, "Content-Type": "application/json" };
  try {
    const session = await call(`${url}/auth/v1/user`, { headers: userHeaders });
    if (!session.ok) return fail(401, "Sessão não autorizada.");
    const user: unknown = await session.json();
    if (!isRecord(user) || typeof user.id !== "string") return fail(401, "Sessão inválida.");
    const admin = await call(`${url}/rest/v1/rpc/is_platform_admin`, { method: "POST", headers: userHeaders, body: "{}" });
    if (!admin.ok || await admin.json() !== true) return fail(403, "Verificação exclusiva do administrador.");
    const raw = await request.text();
    if (raw.length > 1024) return fail(400, "Pedido inválido.");
    const body: unknown = JSON.parse(raw);
    if (!isRecord(body) || body.action !== "check_production" || Object.keys(body).length !== 1) return fail(400, "Pedido inválido.");
    const providerHeaders = { access_token: key, Accept: "application/json", "User-Agent": "LiBen-Production-Readiness/1.0" };
    const status = await call("https://api.asaas.com/v3/myAccount/status/", { headers: providerHeaders });
    if (!status.ok) return fail(502, "Não foi possível consultar a conta de produção. Confira a chave e suas permissões.");
    const account: unknown = await status.json();
    if (!isRecord(account) || account.general !== "APPROVED") return fail(409, "A conta de produção precisa estar aprovada no Asaas antes da ativação.");
    const hooks = await call("https://api.asaas.com/v3/webhooks?limit=100", { headers: providerHeaders });
    if (!hooks.ok) return fail(502, "Não foi possível consultar os webhooks de produção.");
    const configs: unknown = await hooks.json();
    const endpoint = `${url}/functions/v1/asaas-production-webhook`;
    const required = ["PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL", "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"];
    if (!isRecord(configs) || !Array.isArray(configs.data) || !configs.data.some(item => isRecord(item) && item.url === endpoint && item.enabled === true && item.interrupted === false && Array.isArray(item.events) && required.every(event => (item.events as unknown[]).includes(event)))) return fail(409, "Cadastre e ative o webhook de produção com a URL e os eventos indicados no guia.");
    // Sonda autenticada sem cobrança: valida rota publicada, JWT desabilitado e token correto.
    const probe = await call(endpoint, { method: "POST", headers: { "asaas-access-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ id: "evt_liben_production_readiness", event: "LIBEN_CONNECTION_CHECK" }) });
    if (!probe.ok || (await probe.json())?.code !== "EVENT_IGNORED") return fail(409, "O receptor de produção não confirmou o token. Confira a publicação e desative JWT somente no webhook.");
    const saved = await call(`${url}/rest/v1/rpc/app_record_production_check`, { method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_actor: user.id }) });
    if (!saved.ok) return fail(503, "A verificação passou, mas não foi registrada. Confira o SQL desta etapa.");
    return new Response(JSON.stringify({ ok: true, environment: "production", checkedAt: (deps.now?.() ?? new Date()).toISOString(), paymentCreated: false, modeChanged: false }), { headers });
  } catch { return fail(502, "Não foi possível concluir a verificação. Nenhuma cobrança foi criada e o modo permanece como estava."); }
};
