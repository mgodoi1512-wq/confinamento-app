import { annualSnapshot } from "../_shared/annual-reconcile.ts";
type WebhookDeps = { env: (name: string) => string | undefined; fetch: typeof fetch; now?: () => Date };
type Data = Record<string, unknown>;
const record = (value: unknown): value is Data => !!value && typeof value === "object" && !Array.isArray(value);
const supportedEvents = new Set([
  "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED",
  "PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE",
  "PAYMENT_DELETED", "PAYMENT_RESTORED", "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_REFUND_DENIED", "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_AWAITING_RISK_ANALYSIS", "PAYMENT_APPROVED_BY_RISK_ANALYSIS", "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_AUTHORIZED", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_ANTICIPATED",
]);
const equalToken = async (expected: string, received: string) => {
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([expected, received].map(x => crypto.subtle.digest("SHA-256", encode.encode(x))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
};
// O Asaas pode retornar BOLETO para a fatura Boleto/Pix de uma assinatura PIX.
// Normalizar somente nesse sentido; nunca aceitar cartão ou método indefinido.
const compatibleMethod = (requested: unknown, actual: unknown): boolean =>
  (requested === "PIX" && (actual === "PIX" || actual === "BOLETO")) ||
  (requested === "CREDIT_CARD" && actual === "CREDIT_CARD");
export function createProductionWebhookHandler(deps: WebhookDeps) {
  return async (request: Request): Promise<Response> => {
    const deadline = Date.now() + 8000;
    const timeout = (limit: number) => AbortSignal.timeout(Math.max(1, Math.min(limit, deadline - Date.now())));
    const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    if (request.method !== "POST") return reply(405, "METHOD_NOT_ALLOWED");
    const token = deps.env("ASAAS_PRODUCTION_WEBHOOK_TOKEN");
    if (!token || token.length < 32 || token.length > 255 || /\s/.test(token) || token.startsWith("$aact_")) return reply(503, "WEBHOOK_NOT_CONFIGURED");
    const received = request.headers.get("asaas-access-token") ?? "";
    if (!received || received.length > 255 || !await equalToken(token, received)) return reply(401, "WEBHOOK_UNAUTHORIZED");
    const key = deps.env("ASAAS_PRODUCTION_API_KEY")?.trim();
    const url = deps.env("SUPABASE_URL")?.replace(/\/$/, ""), service = deps.env("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service || !key?.startsWith("$aact_prod_") || /\s/.test(key)) return reply(503, "PRODUCTION_NOT_CONFIGURED");
    let event: Data;
    try {
      const raw = await request.text();
      if (raw.length > 262144) return reply(413, "EVENT_TOO_LARGE");
      const parsed: unknown = JSON.parse(raw);
      if (!record(parsed) || typeof parsed.id !== "string" || !/^evt_[^\s]{1,251}$/.test(parsed.id) || typeof parsed.event !== "string") return reply(400, "INVALID_EVENT");
      event = parsed;
    } catch { return reply(400, "INVALID_JSON"); }
    // Eventos não utilizados são reconhecidos sem interpretar campos adicionais.
    if (!supportedEvents.has(String(event.event))) return reply(200, "EVENT_IGNORED");
    const lifecycle = String(event.event).startsWith("SUBSCRIPTION_");
    const resource = lifecycle ? event.subscription : event.payment;
    if (!record(resource) || typeof resource.id !== "string" || !(lifecycle ? /^sub_[A-Za-z0-9_-]{1,240}$/ : /^pay_[A-Za-z0-9_-]{1,240}$/).test(resource.id)) return reply(400, "INVALID_RESOURCE");
    const paymentId = resource.id;
    const rpc = async (action: string, payload: Data): Promise<Data> => {
      const res = await deps.fetch(`${url}/rest/v1/rpc/app_production_webhook`, { method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_action: action, p_payload: payload }), redirect: "error", signal: timeout(2000) });
      if (!res.ok) throw new Error("DATABASE_UNAVAILABLE");
      const value: unknown = await res.json();
      if (!record(value)) throw new Error("INVALID_DATABASE_RESPONSE");
      return value;
    };
    let claimToken: string | undefined;
    try {
      const claim = await rpc("claim", { eventId: event.id, eventType: event.event, paymentId, externalReference: typeof resource.externalReference === "string" ? resource.externalReference : null, providerSubscriptionId: typeof resource.subscription === "string" ? resource.subscription : null, providerInstallmentId: typeof resource.installment === "string" ? resource.installment : null });
      if (claim.duplicate === true) return reply(200, "EVENT_ALREADY_PROCESSED");
      if (claim.ignored === true) return reply(200, "UNRELATED_PAYMENT_IGNORED");
      if (claim.busy === true) return reply(503, "EVENT_IN_PROGRESS");
      if (typeof claim.claimToken !== "string" || (!record(claim.order) && !record(claim.subscription))) throw new Error("INVALID_CLAIM");
      claimToken = claim.claimToken;
      const order = record(claim.order) ? claim.order : undefined;
      const subscription = record(claim.subscription) ? claim.subscription : undefined;
      const observedAt = (deps.now?.() ?? new Date()).toISOString();
      if (!lifecycle && order?.installment_count != null) {
        const get = async (path: string): Promise<Data | null> => {
          const response = await deps.fetch(`https://api.asaas.com/v3/${path}`, { method: "GET", headers: { access_token: key, "User-Agent": "LiBen-Annual-Webhook/1.0", Accept: "application/json" }, redirect: "error", signal: timeout(3000) });
          if (response.status === 404) return null;
          if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
          const value: unknown = await response.json(); if (!record(value)) throw new Error("PROVIDER_UNAVAILABLE"); return value;
        };
        const snapshot = await annualSnapshot(order, get, observedAt, paymentId);
        const applied = await deps.fetch(`${url}/rest/v1/rpc/app_apply_annual_snapshot`, { method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_order_id: order.id, p_snapshot: { ...snapshot, source: "webhook" } }), redirect: "error", signal: timeout(2000) });
        if (!applied.ok) throw new Error("DATABASE_UNAVAILABLE");
        await rpc("complete_annual", { eventId: event.id, claimToken });
        return reply(200, "EVENT_PROCESSED");
      }
      const endpoint = lifecycle ? "subscriptions" : "payments";
      const response = await deps.fetch(`https://api.asaas.com/v3/${endpoint}/${encodeURIComponent(paymentId)}`, { method: "GET", headers: { access_token: key, "User-Agent": "LiBen-Production-Webhook/1.0", Accept: "application/json" }, redirect: "error", signal: timeout(3000) });
      if (lifecycle) {
        if (!subscription) throw new Error("MISSING_SUBSCRIPTION");
        let provider: unknown;
        if (response.status === 404 && event.event === "SUBSCRIPTION_DELETED" && subscription.provider_id === paymentId) {
          provider = { id: paymentId, customer: subscription.customer_id, externalReference: subscription.id, billingType: subscription.method, cycle: subscription.plan === "annual" ? "YEARLY" : "MONTHLY", value: Number(subscription.amount_cents) / 100, status: "CANCELLED", deleted: true };
        } else { if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE"); provider = await response.json(); }
        if (!record(provider) || provider.id !== paymentId || provider.customer !== subscription.customer_id || provider.externalReference !== subscription.id || !compatibleMethod(subscription.method, provider.billingType) || provider.cycle !== (subscription.plan === "annual" ? "YEARLY" : "MONTHLY") || typeof provider.value !== "number" || Math.round(provider.value * 100) !== subscription.amount_cents || (subscription.provider_id != null && subscription.provider_id !== provider.id)) throw new Error("SUBSCRIPTION_MISMATCH");
        await rpc("complete", { eventId: event.id, claimToken, subscription: { providerId: provider.id, customerId: provider.customer, externalReference: provider.externalReference, method: subscription.method, cycle: provider.cycle, amountCents: Math.round(provider.value * 100), nextDueDate: provider.nextDueDate ?? null, status: provider.deleted === true ? "CANCELLED" : provider.status, observedAt } });
        return reply(200, "EVENT_PROCESSED");
      }
      if (response.status === 404 && event.event === "PAYMENT_DELETED" && subscription && (!order || !order.invoice_url)) {
        await rpc("deleted_unimported", { eventId: event.id, claimToken });
        return reply(200, "EVENT_PROCESSED");
      }
      let payment: unknown;
      if (response.status === 404 && event.event === "PAYMENT_DELETED" && order?.payment_id === paymentId) {
        payment = { id: paymentId, customer: order.customer_id, externalReference: order.provider_reference ?? order.id, subscription: order.provider_subscription_id, dueDate: order.due_on, value: Number(order.amount_cents) / 100, billingType: order.method, invoiceUrl: order.invoice_url, deleted: true };
      } else { if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE"); payment = await response.json(); }
      const expected = subscription ?? order;
      if (!expected || !record(payment) || payment.id !== paymentId || payment.customer !== expected.customer_id || !compatibleMethod(expected.method, payment.billingType) || typeof payment.value !== "number" || Math.round(payment.value * 100) !== expected.amount_cents || typeof payment.invoiceUrl !== "string" || !/^https:\/\/(www\.asaas\.com|asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(payment.invoiceUrl)) throw new Error("PAYMENT_MISMATCH");
      if (subscription ? (!subscription.provider_id || payment.subscription !== subscription.provider_id) : (payment.externalReference !== order?.id || order?.payment_id != null && order.payment_id !== payment.id)) throw new Error("PAYMENT_MISMATCH");
      const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
      let refundedCents = 0;
      for (const refund of refunds) {
        if (record(refund) && refund.status === "DONE") {
          if (typeof refund.value !== "number" || !Number.isFinite(refund.value) || refund.value < 0) throw new Error("INVALID_REFUND");
          refundedCents += Math.round(refund.value * 100);
        }
      }
      await rpc("complete", { eventId: event.id, claimToken, payment: { paymentId: payment.id, customerId: payment.customer, externalReference: subscription?.id ?? payment.externalReference, providerSubscriptionId: payment.subscription ?? null, dueDate: payment.dueDate ?? null, method: expected.method, amountCents: Math.round(payment.value * 100), invoiceUrl: payment.invoiceUrl, observedAt, refundedCents, status: payment.deleted === true ? "DELETED" : payment.status } });
      return reply(200, "EVENT_PROCESSED");
    } catch {
      if (claimToken) {
        try { await rpc("fail", { eventId: event.id, claimToken }); } catch { /* A reserva expira e permite a retomada na próxima entrega. */ }
      }
      return reply(503, "EVENT_RETRY_REQUIRED");
    }
  };
}
