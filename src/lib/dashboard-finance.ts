import type { CashEntry, WorkspaceSettings } from "./financial-workspace";
export const cashFlowPath = "/gestao/financeiro/fluxo-de-caixa";
export type CashScope = "hoje" | "atrasados" | "";
export function matchesCashScope(entry: CashEntry, scope: CashScope, today: string) {
  return !scope || (!entry.settled_on && (scope === "hoje" ? entry.due_date === today : entry.due_date < today));
}
export function dashboardFinance(entries: CashEntry[], settings: WorkspaceSettings | null, today: string) {
  const total = (rows: CashEntry[]) => ({count: rows.length, amount: rows.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100});
  const configured = !!settings && settings.cash_configured !== false && settings.opening_date <= today;
  const balance = configured ? (Math.round(settings.opening_balance * 100) + entries.reduce((sum, e) =>
    e.settled_on && e.settled_on >= settings.opening_date && e.settled_on <= today
      ? sum + Math.round(e.amount * 100) * (e.direction === "entrada" ? 1 : -1) : sum, 0)) / 100 : null;
  return {balance,
    payable: total(entries.filter(e => e.direction === "saida" && matchesCashScope(e, "hoje", today))),
    receivable: total(entries.filter(e => e.direction === "entrada" && matchesCashScope(e, "hoje", today))),
    overdue: total(entries.filter(e => e.direction === "saida" && matchesCashScope(e, "atrasados", today)))};
}
