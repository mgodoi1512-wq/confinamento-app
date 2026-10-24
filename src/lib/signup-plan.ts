/** Preferência de interface: não autoriza acesso, cobrança nem fixa preço. */
export type SignupPlan = "monthly" | "annual";
export function signupPlan(value: unknown): SignupPlan | null {
  return value === "monthly" || value === "annual" ? value : null;
}
export function signupPlanFromSearch(search: string): SignupPlan | null {
  return signupPlan(new URLSearchParams(search).get("plano"));
}
export function initialSignupPlan(searchPlan: unknown, metadataPlan: unknown): SignupPlan {
  return signupPlan(searchPlan) ?? signupPlan(metadataPlan) ?? "monthly";
}
