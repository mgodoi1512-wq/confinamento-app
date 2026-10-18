export type AnnualData = Record<string, unknown>;
export type AnnualGet = (path: string) => Promise<AnnualData | null>;
const rec = (value: unknown): value is AnnualData => !!value && typeof value === "object" && !Array.isArray(value);
const providerId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,240}$/.test(value);
const invoiceUrl = (value: unknown): value is string => typeof value === "string" && /^https:\/\/(www\.asaas\.com|asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(value);
// GET-only: verifies the complete installment operation before it can grant a year.
export async function annualSnapshot(order: AnnualData, get: AnnualGet, observedAt: string, eventPaymentId?: string, created?: AnnualData) {
  const count = Number(order.installment_count), total = Number(order.amount_cents);
  if (!Number.isInteger(count) || count < 1 || count > 12 || !Number.isSafeInteger(total) || typeof order.customer_id !== "string") throw new Error("INVALID_ANNUAL_ORDER");
  const previous = Array.isArray(order.annual_members) ? order.annual_members.filter(rec) : [];
  let anchor: AnnualData | null | undefined = created;
  if (!anchor && providerId(order.payment_id)) anchor = await get(`payments/${encodeURIComponent(order.payment_id)}`);
  if (!anchor && !order.payment_id) {
    const found = await get(`payments?externalReference=${encodeURIComponent(String(order.id))}&limit=100`);
    if (!found || !Array.isArray(found.data) || found.hasMore === true) throw new Error("RECOVERY_UNAVAILABLE");
    const matches = found.data.filter(rec);
    const groups = new Set(matches.map(x => count > 1 ? x.installment : x.id));
    if (groups.size !== 1 || !matches.length) throw new Error("RECOVERY_AMBIGUOUS");
    anchor = matches.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || Number(a.installmentNumber ?? 1) - Number(b.installmentNumber ?? 1))[0];
  }
  const allowMissing = previous.length > 0;
  const group = count > 1 ? anchor?.installment ?? order.provider_installment_id : null;
  if (count > 1 && !providerId(group)) throw new Error("INVALID_INSTALLMENT_ID");
  if (count === 1 && anchor?.installment != null) throw new Error("UNEXPECTED_INSTALLMENT");
  if (order.provider_installment_id != null && order.provider_installment_id !== group) throw new Error("INSTALLMENT_CHANGED");
  let raw: AnnualData[] = [];
  if (group) {
    const list = await get(`payments?installment=${encodeURIComponent(String(group))}&limit=100`);
    if (list && (!Array.isArray(list.data) || list.hasMore === true)) throw new Error("INCOMPLETE_INSTALLMENTS");
    if (!list && !allowMissing) throw new Error("INSTALLMENTS_NOT_FOUND");
    raw = list && Array.isArray(list.data) ? list.data.filter(rec) : [];
  } else if (anchor) raw = [anchor];
  const ids = new Set(raw.map(x => x.id));
  // Removed invoices may disappear from the group list. Only known and rechecked IDs can become DELETED.
  const missing = previous.filter(x => !ids.has(x.id));
  if (missing.length && allowMissing) {
    const restored = await Promise.all(missing.map(async old => {
      if (!providerId(old.id)) throw new Error("INVALID_PREVIOUS_ID");
      const value = await get(`payments/${encodeURIComponent(old.id)}`);
      if (value) return value;
      if (!["PENDING", "OVERDUE", "DELETED"].includes(String(old.status))) throw new Error("MISSING_PAID_PAYMENT");
      return { id: old.id, customer: old.customerId, billingType: old.method, installment: old.installmentId, value: Number(old.amountCents) / 100,
        externalReference: old.externalReference, invoiceUrl: old.invoiceUrl, dueDate: old.dueDate, deleted: true, status: "DELETED" };
    }));
    raw.push(...restored);
  }
  if (raw.length !== count || new Set(raw.map(x => x.id)).size !== count) throw new Error("INCOMPLETE_INSTALLMENTS");
  if (eventPaymentId && !raw.some(x => x.id === eventPaymentId)) throw new Error("EVENT_NOT_IN_INSTALLMENT");
  const payments = raw.map(item => {
    if (!providerId(item.id) || !String(item.id).startsWith("pay_") || item.customer !== order.customer_id || item.billingType !== "CREDIT_CARD"
      || (count > 1 ? item.installment !== group : item.installment != null) || typeof item.value !== "number" || !Number.isFinite(item.value)
      || Math.round(item.value * 100) < 500 || Math.abs(Math.round(item.value * 100) - total / count) > count
      || !invoiceUrl(item.invoiceUrl) || typeof item.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
      || (item.externalReference != null && item.externalReference !== order.id)) throw new Error("PAYMENT_MISMATCH");
    let refundedCents = 0;
    for (const refund of Array.isArray(item.refunds) ? item.refunds : []) {
      if (rec(refund) && refund.status === "DONE") {
        if (typeof refund.value !== "number" || !Number.isFinite(refund.value) || refund.value < 0) throw new Error("INVALID_REFUND");
        refundedCents += Math.round(refund.value * 100);
      }
    }
    if (refundedCents > Math.round(item.value * 100)) throw new Error("INVALID_REFUND");
    return { id: item.id, customerId: item.customer, method: item.billingType, installmentId: group, amountCents: Math.round(item.value * 100),
      externalReference: item.externalReference ?? null, invoiceUrl: item.invoiceUrl, dueDate: item.dueDate, refundedCents, status: item.deleted === true ? "DELETED" : item.status };
  });
  if (payments.reduce((sum, item) => sum + item.amountCents, 0) !== total) throw new Error("ANNUAL_TOTAL_MISMATCH");
  const first = order.payment_id ? payments.find(x => x.id === order.payment_id) : [...payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (!first || first.externalReference !== order.id || first.dueDate !== order.due_on) throw new Error("FIRST_PAYMENT_MISMATCH");
  return { paymentId: first.id, installmentId: group, payments, observedAt };
}
