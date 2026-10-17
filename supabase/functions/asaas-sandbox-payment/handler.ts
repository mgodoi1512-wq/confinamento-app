type PaymentDeps = { env: (key: string) => string | undefined; fetch: typeof fetch; now?: () => Date };
type RecordData = Record<string, unknown>;
const object = (value: unknown): value is RecordData => !!value && typeof value === "object" && !Array.isArray(value);
const invoice = (value: unknown): value is string => typeof value === "string" && /^https:\/\/(sandbox\.asaas\.com|www\.asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(value);
const validDocument = (value: string): boolean => {
  if (!/^\d{11}(\d{3})?$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digits = [...value].map(Number);
  if (digits.length === 11) {
    return [9, 10].every(size => {
      const check = (digits.slice(0, size).reduce((sum, digit, index) => sum + digit * (size + 1 - index), 0) * 10) % 11;
      return digits[size] === (check === 10 ? 0 : check);
    });
  }
  return [12, 13].every(size => {
    const weights = size === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const remainder = digits.slice(0, size).reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
    return digits[size] === (remainder < 2 ? 0 : 11 - remainder);
  });
};
export function createSandboxPaymentHandler(deps: PaymentDeps) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const origins = (deps.env("APP_ALLOWED_ORIGINS") ?? "").split(",").map(x => x.trim());
    const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
    if (origin && origins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
    const fail = (status: number, message: string) => new Response(JSON.stringify({ error: { message } }), { status, headers });
    if (origin && !origins.includes(origin)) return fail(403, "Origem não autorizada. Confira APP_ALLOWED_ORIGINS.");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return fail(405, "Método inválido.");
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return fail(401, "Entre novamente na plataforma.");
    const url = deps.env("SUPABASE_URL")?.replace(/\/$/, ""), anon = deps.env("SUPABASE_ANON_KEY"), service = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    const key = deps.env("ASAAS_SANDBOX_API_KEY")?.trim();
    if (!url || !anon || !service || !key?.startsWith("$aact_hmlg_") || /\s/.test(key)) return fail(503, "Confira os Secrets do Sandbox na Edge Function.");
    const call = (target: string, options: RequestInit, timeout = 15000) => deps.fetch(target, { ...options, redirect: "error", signal: AbortSignal.timeout(timeout) });
    const userHeaders = { apikey: anon, Authorization: authorization, "Content-Type": "application/json" };
    try {
      const auth = await call(`${url}/auth/v1/user`, { headers: userHeaders });
      if (!auth.ok) return fail(auth.status === 401 || auth.status === 403 ? 401 : 503, "Não foi possível validar sua sessão.");
      const user: unknown = await auth.json();
      if (!object(user) || typeof user.id !== "string") return fail(401, "Sessão inválida.");
      const admin = await call(`${url}/rest/v1/rpc/is_platform_admin`, { method: "POST", headers: userHeaders, body: "{}" });
      if (!admin.ok || await admin.json() !== true) return fail(403, "Os pagamentos Sandbox estão disponíveis somente ao administrador.");
      const raw = await request.text();
      if (raw.length > 4096) return fail(413, "Formulário muito grande.");
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return fail(400, "Dados inválidos."); }
      if (!object(body) || !["create", "refresh", "archive"].includes(String(body.action))) return fail(400, "Ação inválida.");
      const creating = body.action === "create";
      if (Object.keys(body).some(x => !(creating ? ["action", "plan", "method", "name", "cpfCnpj"] : ["action", "id"]).includes(x))) return fail(400, "Campo não permitido.");
      if (creating && (!["monthly", "annual"].includes(String(body.plan)) || !["PIX", "CREDIT_CARD"].includes(String(body.method)) || typeof body.name !== "string" || body.name.trim().length < 3 || body.name.length > 120 || typeof body.cpfCnpj !== "string" || !validDocument(body.cpfCnpj))) return fail(400, "Informe nome, CPF/CNPJ e um plano válido. Use apenas dados de teste.");
      if (!creating && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id))) return fail(400, "Pagamento inválido.");
      const rpc = async (action: string, payload: RecordData): Promise<RecordData> => {
        const res = await call(`${url}/rest/v1/rpc/app_billing_sandbox_server`, { method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_action: action, p_user_id: user.id, p_payload: payload }) });
        if (!res.ok) throw new Error("DATABASE");
        const value: unknown = await res.json();
        if (!object(value)) throw new Error("DATABASE");
        return value;
      };
      const asaas = async (path: string, data?: RecordData): Promise<RecordData> => {
        const res = await call(`https://api-sandbox.asaas.com/v3/${path}`, { method: data ? "POST" : "GET", headers: { access_token: key, "User-Agent": "LiBen-Sandbox-Payment/1.0", "Content-Type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) }, data ? 65000 : 15000);
        if (!res.ok) throw new Error("PROVIDER");
        const value: unknown = await res.json();
        if (!object(value)) throw new Error("PROVIDER");
        return value;
      };
      let order = await rpc(creating ? "prepare" : "get", creating ? { plan: body.plan, method: body.method } : { id: body.id });
      let payment: RecordData | undefined;
      const observedAt = (deps.now?.() ?? new Date()).toISOString();
      if (order.payment_id) {
        payment = await asaas(`payments/${encodeURIComponent(String(order.payment_id))}`);
      } else if (order.fresh === true) {
        const customer = await asaas("customers", { name: String(body.name).trim(), cpfCnpj: body.cpfCnpj, externalReference: `liben-sandbox-${order.farm_id}`, notificationDisabled: true });
        if (typeof customer.id !== "string") throw new Error("PROVIDER");
        order = await rpc("customer", { id: order.id, customerId: customer.id });
        const dueDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(deps.now?.() ?? new Date());
        payment = await asaas("payments", { customer: order.customer_id, billingType: order.method, value: Number(order.amount_cents) / 100, dueDate, externalReference: order.id, description: `LiBen TESTE - plano ${order.plan === "annual" ? "anual" : "mensal"}` });
      } else if (order.customer_id) {
        // Uma resposta perdida nunca dispara um novo POST de cobrança.
        const found = await asaas(`payments?externalReference=${encodeURIComponent(String(order.id))}&limit=10`);
        if (Array.isArray(found.data) && found.data.length === 1 && object(found.data[0])) payment = found.data[0];
      }
      if (!payment) return fail(409, "A geração anterior ainda não foi confirmada. Confira o Sandbox do Asaas e tente Atualizar situação. Não crie outra cobrança manualmente.");
      if (typeof payment.id !== "string" || (order.provider_subscription_id ? payment.subscription !== order.provider_subscription_id : payment.externalReference !== order.id) || payment.customer !== order.customer_id || payment.billingType !== order.method || typeof payment.value !== "number" || Math.round(payment.value * 100) !== order.amount_cents || !invoice(payment.invoiceUrl)) return fail(502, "A cobrança retornada não corresponde ao plano solicitado.");
      await rpc("sync", { id: order.id, customerId: payment.customer, externalReference: order.provider_reference ?? payment.externalReference, providerSubscriptionId: payment.subscription ?? null, dueDate: payment.dueDate ?? null, paymentId: payment.id, amountCents: Math.round(payment.value * 100), method: payment.billingType, invoiceUrl: payment.invoiceUrl, observedAt, status: payment.deleted === true ? "DELETED" : payment.status });
      if (body.action === "archive") await rpc("archive", { id: order.id });
      return new Response(JSON.stringify({ ok: true, environment: "sandbox", id: order.id }), { headers });
    } catch {
      return fail(502, "Não foi possível concluir. Confira a migração e os Secrets. Se a cobrança já foi iniciada, use Atualizar situação; ela não será reenviada automaticamente.");
    }
  };
}
