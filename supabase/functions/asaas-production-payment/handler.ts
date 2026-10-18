type PaymentDeps = { env: (key: string) => string | undefined; fetch: typeof fetch; now?: () => Date };
type RecordData = Record<string, unknown>;
const object = (value: unknown): value is RecordData => !!value && typeof value === "object" && !Array.isArray(value);
const invoice = (value: unknown): value is string => typeof value === "string" && /^https:\/\/(www\.asaas\.com|asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(value);
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
// O Asaas pode retornar BOLETO para a fatura Boleto/Pix de uma assinatura PIX.
// Normalizar somente nesse sentido; nunca aceitar cartão ou método indefinido.
const compatibleMethod = (requested: unknown, actual: unknown): boolean =>
  (requested === "PIX" && (actual === "PIX" || actual === "BOLETO")) ||
  (requested === "CREDIT_CARD" && actual === "CREDIT_CARD");
export function createProductionPaymentHandler(deps: PaymentDeps) {
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
    const key = deps.env("ASAAS_PRODUCTION_API_KEY")?.trim();
    if (!url || !anon || !service || !key?.startsWith("$aact_prod_") || /\s/.test(key)) return fail(503, "Confira os Secrets do Production na Edge Function.");
    const call = (target: string, options: RequestInit, timeout = 15000) => deps.fetch(target, { ...options, redirect: "error", signal: AbortSignal.timeout(timeout) });
    const userHeaders = { apikey: anon, Authorization: authorization, "Content-Type": "application/json" };
    let pixRequested = false;
    try {
      const auth = await call(`${url}/auth/v1/user`, { headers: userHeaders });
      if (!auth.ok) return fail(auth.status === 401 || auth.status === 403 ? 401 : 503, "Não foi possível validar sua sessão.");
      const user: unknown = await auth.json();
      if (!object(user) || typeof user.id !== "string") return fail(401, "Sessão inválida.");
      const raw = await request.text();
      if (raw.length > 4096) return fail(413, "Formulário muito grande.");
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return fail(400, "Dados inválidos."); }
      if (!object(body) || !["refresh", "pix"].includes(String(body.action))) return fail(400, "Ação inválida.");
      if (Object.keys(body).some(x => !["action", "id"].includes(x)) || typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return fail(400, "Pagamento inválido.");
      pixRequested = body.action === "pix";
      const rpc = async (action: string, payload: RecordData): Promise<RecordData> => {
        const res = await call(`${url}/rest/v1/rpc/app_billing_production_server`, { method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_action: action, p_user_id: user.id, p_payload: payload }) });
        if (!res.ok) throw new Error("DATABASE");
        const value: unknown = await res.json();
        if (!object(value)) throw new Error("DATABASE");
        return value;
      };
      const asaas = async (path: string, data?: RecordData): Promise<RecordData> => {
        const res = await call(`https://api.asaas.com/v3/${path}`, { method: data ? "POST" : "GET", headers: { access_token: key, "User-Agent": "LiBen-Production-Payment/1.0", "Content-Type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) }, data ? 65000 : 15000);
        if (!res.ok) throw new Error("PROVIDER");
        const value: unknown = await res.json();
        if (!object(value)) throw new Error("PROVIDER");
        return value;
      };
      const order = await rpc("get", { id: body.id });
      if (pixRequested && (order.method !== "PIX" || order.archived === true)) return fail(409, "Pix indisponível para esta cobrança.");
      if (typeof order.payment_id !== "string") return fail(409, "Cobrança ainda em conferência.");
      const observedAt = (deps.now?.() ?? new Date()).toISOString();
      const payment = await asaas(`payments/${encodeURIComponent(order.payment_id)}`);
      if (!payment) return fail(409, "A geração anterior ainda não foi confirmada. Confira o Production do Asaas e tente Atualizar situação. Não crie outra cobrança manualmente.");
      if (payment.id !== order.payment_id || (order.provider_subscription_id ? payment.subscription !== order.provider_subscription_id : payment.externalReference !== order.id) || payment.customer !== order.customer_id || !compatibleMethod(order.method, payment.billingType) || typeof payment.value !== "number" || Math.round(payment.value * 100) !== order.amount_cents || !invoice(payment.invoiceUrl)) return fail(502, "A cobrança retornada não corresponde ao plano solicitado.");
      const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
      let refundedCents = 0;
      for (const refund of refunds) {
        if (object(refund) && refund.status === "DONE") {
          if (typeof refund.value !== "number" || !Number.isFinite(refund.value) || refund.value < 0) throw new Error("INVALID_REFUND");
          refundedCents += Math.round(refund.value * 100);
        }
      }
      await rpc("sync", { id: order.id, customerId: payment.customer, externalReference: order.provider_reference ?? payment.externalReference, providerSubscriptionId: payment.subscription ?? null, dueDate: payment.dueDate ?? null, paymentId: payment.id, amountCents: Math.round(payment.value * 100), method: order.method, refundedCents, invoiceUrl: payment.invoiceUrl, observedAt, status: payment.deleted === true ? "DELETED" : payment.status });
      if (pixRequested) {
        const status = payment.deleted === true ? "DELETED" : payment.status;
        const state = refundedCents > 0 ? "unavailable" : status === "RECEIVED" ? "paid" : status === "CONFIRMED" ? "processing" : ["PENDING", "OVERDUE"].includes(String(status)) ? "pending" : "unavailable";
        const result = { ok: true, environment: "production", id: order.id, amountCents: order.amount_cents, status, state, checkedAt: observedAt };
        if (state !== "pending") return new Response(JSON.stringify({ ...result, pix: null }), { headers });
        // Apenas recupera o QR da cobrança existente. Nunca cria cobrança nem usa chave no frontend.
        const qr = await asaas(`payments/${encodeURIComponent(order.payment_id)}/pixQrCode`);
        if (typeof qr.encodedImage !== "string" || qr.encodedImage.length > 1048576 || !/^[A-Za-z0-9+/]+={0,2}$/.test(qr.encodedImage)
          || typeof qr.payload !== "string" || !qr.payload.startsWith("000201") || qr.payload.length < 50 || qr.payload.length > 4096 || Array.from(qr.payload).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
          || typeof qr.expirationDate !== "string") throw new Error("INVALID_QR");
        const png = atob(qr.encodedImage);
        if (![137,80,78,71,13,10,26,10].every((value, index) => png.charCodeAt(index) === value)) throw new Error("INVALID_PNG");
        let expiry = qr.expirationDate.trim().replace(" ", "T");
        if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) expiry += "T23:59:59";
        if (!/(Z|[+-]\d{2}:?\d{2})$/.test(expiry)) expiry += "-03:00";
        const expiresAt = Date.parse(expiry);
        if (!Number.isFinite(expiresAt)) throw new Error("INVALID_EXPIRY");
        if (expiresAt <= (deps.now?.() ?? new Date()).getTime()) return fail(409, "Este código Pix expirou. Consulte a fatura no Asaas antes de pagar.");
        return new Response(JSON.stringify({ ...result, pix: { encodedImage: qr.encodedImage, payload: qr.payload, expirationDate: new Date(expiresAt).toISOString() } }), { headers });
      }
      return new Response(JSON.stringify({ ok: true, environment: "production", id: order.id }), { headers });
    } catch {
      return fail(502, pixRequested ? "Não foi possível carregar o Pix. Tente novamente ou abra a fatura no Asaas." : "Não foi possível concluir. Confira a migração e os Secrets. Se a cobrança já foi iniciada, use Atualizar situação; ela não será reenviada automaticamente.");
    }
  };
}
