import { expectedSubscriptionPaymentCents } from "../_shared/coupon-payment.ts";
type SubscriptionDeps = { env: (key: string) => string | undefined; fetch: typeof fetch; now?: () => Date };
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
export function createProductionSubscriptionHandler(deps: SubscriptionDeps) {
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
    try {
      const auth = await call(`${url}/auth/v1/user`, { headers: userHeaders });
      if (!auth.ok) return fail(auth.status === 401 || auth.status === 403 ? 401 : 503, "Não foi possível validar sua sessão.");
      const user: unknown = await auth.json();
      if (!object(user) || typeof user.id !== "string") return fail(401, "Sessão inválida.");
      const raw = await request.text();
      if (raw.length > 4096) return fail(413, "Formulário muito grande.");
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return fail(400, "Dados inválidos."); }
      if (!object(body) || !["create", "refresh", "cancel"].includes(String(body.action))) return fail(400, "Ação inválida.");
      const creating = body.action === "create";
      if (body.couponQuoteId !== undefined && (typeof body.couponQuoteId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.couponQuoteId))) return fail(400,"Cupom inválido. Aplique novamente.");
      if (Object.keys(body).some(x => !(creating ? ["action", "plan", "method", "name", "cpfCnpj", "productionConsent", "priceVersion", "couponQuoteId"] : ["action", "id", "confirm"]).includes(x))) return fail(400, "Campo não permitido.");
      if (creating && (!["monthly", "annual"].includes(String(body.plan)) || !["PIX", "CREDIT_CARD"].includes(String(body.method)) || typeof body.name !== "string" || body.name.trim().length < 3 || body.name.length > 120 || typeof body.cpfCnpj !== "string" || !validDocument(body.cpfCnpj))) return fail(400, "Informe nome, CPF/CNPJ e um plano válido. Use apenas dados do pagador.");
      if (!creating && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id))) return fail(400, "Pagamento inválido.");
      if (body.action === "cancel" && body.confirm !== true) return fail(400, "Confirme o cancelamento da renovação.");
      if (creating && (body.productionConsent !== true || typeof body.priceVersion !== "string")) return fail(400, "Confirme o valor e a autorização da assinatura em produção.");
      const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
      const rpc = async (action: string, payload: RecordData): Promise<RecordData> => {
        const res = await call(`${url}/rest/v1/rpc/app_production_subscription_server`, { method: "POST", headers: serviceHeaders, body: JSON.stringify({ p_action: action, p_user_id: user.id, p_payload: payload }) });
        if (!res.ok) throw new Error("DATABASE");
        const value: unknown = await res.json(); if (!object(value)) throw new Error("DATABASE"); return value;
      };
      const asaas = async (path: string, data?: RecordData, method?: string): Promise<RecordData> => {
        const res = await call(`https://api.asaas.com/v3/${path}`, { method: method ?? (data ? "POST" : "GET"), headers: { access_token: key, "User-Agent": "LiBen-Production-Subscription/1.0", "Content-Type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) }, data ? 65000 : 15000);
        if (res.status === 404 && method === "DELETE") return { deleted: true };
        if (!res.ok) throw new Error("PROVIDER");
        const value: unknown = await res.json(); if (!object(value)) throw new Error("PROVIDER"); return value;
      };
      let subscription = await rpc(creating ? "prepare" : "get", creating ? { plan: body.plan, method: body.method, productionConsent: body.productionConsent, priceVersion: body.priceVersion, ...(body.couponQuoteId ? { couponQuoteId: body.couponQuoteId } : {}) } : { id: body.id });
      if (subscription.status === "CANCELLED" && body.action === "refresh") return new Response(JSON.stringify({ ok: true, environment: "production", id: subscription.id }), { headers });
      let provider: RecordData | undefined;
      const observedAt = (deps.now?.() ?? new Date()).toISOString();
      if (body.action === "cancel") {
        subscription = await rpc("cancel_begin", { id: subscription.id });
        if (subscription.status !== "CANCELLED") {
          if (typeof subscription.provider_id !== "string") throw new Error("UNKNOWN_SUBSCRIPTION");
          const removed = await asaas(`subscriptions/${encodeURIComponent(subscription.provider_id)}`, undefined, "DELETE");
          if (removed.deleted !== true) throw new Error("CANCEL_NOT_CONFIRMED");
        }
        provider = { id: subscription.provider_id, customer: subscription.customer_id, externalReference: subscription.id, value: Number(subscription.amount_cents) / 100, cycle: subscription.plan === "annual" ? "YEARLY" : "MONTHLY", billingType: subscription.method, status: "CANCELLED", deleted: true };
      } else if (subscription.provider_id) {
        provider = await asaas(`subscriptions/${encodeURIComponent(String(subscription.provider_id))}`);
      } else if (subscription.fresh === true) {
        const customer = await asaas("customers", { name: String(body.name).trim(), cpfCnpj: body.cpfCnpj, externalReference: `liben-sub-production-${subscription.id}`, notificationDisabled: true });
        if (typeof customer.id !== "string") throw new Error("INVALID_CUSTOMER");
        subscription = await rpc("customer", { id: subscription.id, customerId: customer.id });
        provider = await asaas("subscriptions", { customer: subscription.customer_id, billingType: subscription.method, value: Number(subscription.amount_cents) / 100, nextDueDate: subscription.first_due_on, cycle: subscription.plan === "annual" ? "YEARLY" : "MONTHLY", externalReference: subscription.id, description: `LiBen - assinatura ${subscription.plan === "annual" ? "anual" : "mensal"}` });
      } else {
        const found = await asaas(`subscriptions?externalReference=${encodeURIComponent(String(subscription.id))}&includeDeleted=true&limit=10`);
        if (Array.isArray(found.data) && found.data.length === 1 && object(found.data[0])) provider = found.data[0];
      }
      if (!provider) return fail(409, "A criação anterior está em conferência. Use Consultar assinatura; não repita a criação no Asaas.");
      const mismatches = [
        typeof provider.id !== "string" || (subscription.provider_id != null && subscription.provider_id !== provider.id) ? "identificador" : null,
        provider.customer !== subscription.customer_id ? "cliente" : null,
        provider.externalReference !== subscription.id ? "referência" : null,
        !compatibleMethod(subscription.method, provider.billingType) ? "forma de pagamento" : null,
        provider.cycle !== (subscription.plan === "annual" ? "YEARLY" : "MONTHLY") ? "periodicidade" : null,
        typeof provider.value !== "number" || Math.round(provider.value * 100) !== subscription.amount_cents ? "valor" : null,
      ].filter(Boolean);
      if (mismatches.length) return fail(502, `A assinatura não corresponde ao plano solicitado (${mismatches.join(", ")}). Use Consultar assinatura; não gere outra cobrança.`);
      const cancelled = provider.deleted === true || provider.status === "CANCELLED";
      subscription = await rpc("save", { id: subscription.id, providerId: provider.id, customerId: provider.customer, externalReference: provider.externalReference, method: subscription.method, cycle: provider.cycle, amountCents: Math.round(Number(provider.value) * 100), nextDueDate: provider.nextDueDate ?? null, status: cancelled ? "CANCELLED" : provider.status, observedAt });
      if (!cancelled && subscription.status !== "canceling") {
        // Conciliação explícita, paginada. Webhooks continuam sendo a atualização principal.
        for (let page = 0; page < 10; page++) {
          const paymentsObservedAt = (deps.now?.() ?? new Date()).toISOString();
          const list = await asaas(`subscriptions/${encodeURIComponent(String(provider.id))}/payments?limit=100&offset=${page * 100}`);
          if (!Array.isArray(list.data)) throw new Error("INVALID_PAYMENTS");
          for (let item of list.data) {
            if (subscription.coupon_quote_id && object(item) && item.dueDate === subscription.first_due_on) {
              if (typeof item.id !== "string" || !/^pay_[A-Za-z0-9_-]+$/.test(item.id) || item.subscription !== provider.id || item.customer !== subscription.customer_id || !compatibleMethod(subscription.method,item.billingType)) throw new Error("COUPON_PAYMENT_MISMATCH");
              const bind = await call(`${url}/rest/v1/rpc/app_coupon_bind_first_payment`, { method:"POST", headers:serviceHeaders, body:JSON.stringify({p_subscription_id:subscription.id,p_payment_id:item.id,p_due:item.dueDate}) });
              const bound:unknown=await bind.json();if(!bind.ok||!object(bound))throw new Error("COUPON_BIND");subscription=bound;
              if (typeof item.value!=="number")throw new Error("COUPON_VALUE");
              if (Math.round(item.value*100)!==subscription.first_payment_cents) {
                if (Math.round(item.value*100)!==subscription.amount_cents || !["PENDING","OVERDUE"].includes(String(item.status)))throw new Error("COUPON_ALREADY_PAID");
                item=await asaas(`payments/${encodeURIComponent(String(item.id))}`,{value:Number(subscription.first_payment_cents)/100,billingType:item.billingType,dueDate:item.dueDate},"PUT");
              }
            }
            if (!object(item) || typeof item.id !== "string" || item.subscription !== provider.id || item.customer !== subscription.customer_id || !compatibleMethod(subscription.method, item.billingType) || typeof item.value !== "number" || Math.round(item.value * 100) !== expectedSubscriptionPaymentCents(subscription,item) || typeof item.dueDate !== "string" || !invoice(item.invoiceUrl)) throw new Error("INVALID_PAYMENT");
            const refunds = Array.isArray(item.refunds) ? item.refunds : [];
            const refundedCents = refunds.reduce((sum: number, x: unknown) => sum + (object(x) && x.status === "DONE" && typeof x.value === "number" ? Math.round(x.value * 100) : 0), 0);
            const sync = await call(`${url}/rest/v1/rpc/app_ingest_production_subscription_payment`, { method: "POST", headers: serviceHeaders, body: JSON.stringify({ p_subscription_id: subscription.id, p_payload: { paymentId: item.id, providerSubscriptionId: item.subscription, customerId: item.customer, externalReference: subscription.id, method: subscription.method, amountCents: Math.round(item.value * 100), dueDate: item.dueDate, invoiceUrl: item.invoiceUrl, status: item.deleted === true ? "DELETED" : item.status, refundedCents, observedAt: paymentsObservedAt } }) });
            if (!sync.ok) throw new Error("PAYMENT_SYNC");
          }
          if (list.hasMore !== true) break;
          if (page === 9) throw new Error("RECONCILIATION_LIMIT");
        }
      }
      if (subscription.coupon_quote_id && !subscription.coupon_first_payment_id && !cancelled) return fail(409,"Primeira fatura com cupom em preparação. Use Consultar assinatura para concluir, sem criar outra cobrança.");
      return new Response(JSON.stringify({ ok: true, environment: "production", id: subscription.id }), { headers });
    } catch {
      return fail(502, "Não foi possível concluir. Se a assinatura já foi iniciada, use Consultar assinatura para recuperar a situação. Um cancelamento só termina após confirmação do Asaas.");
    }
  };
}
