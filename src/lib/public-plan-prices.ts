export type PublicPlanPrices = { monthly: number; annual: number };
export function parsePublicPlanPrices(value: unknown): PublicPlanPrices {
  if (!value || typeof value !== "object") throw new Error("Preços indisponíveis.");
  const data = value as Record<string, unknown>;
  const valid = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 100 && n <= 100000000;
  if (!valid(data.monthlyCents) || !valid(data.annualCents)) throw new Error("Preços indisponíveis.");
  return { monthly: data.monthlyCents, annual: data.annualCents };
}
