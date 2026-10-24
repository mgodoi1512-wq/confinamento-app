type CouponData = Record<string, unknown>;
/** A fatura bonificada só é aceita depois do vínculo do ID no servidor. */
export function expectedSubscriptionPaymentCents(subscription: CouponData, payment: CouponData): number {
  if (subscription.coupon_quote_id && payment.dueDate === subscription.first_due_on) {
    return subscription.coupon_first_payment_id === payment.id && typeof subscription.first_payment_cents === "number" ? subscription.first_payment_cents : -1;
  }
  return Number(subscription.amount_cents);
}
