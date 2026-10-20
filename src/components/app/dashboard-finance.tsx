import { CoinStackIcon } from "./coin-stack-icon";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Wallet, AlertTriangle } from "lucide-react";
import type { Workspace } from "@/lib/financial-workspace";
import { cashFlowPath, dashboardFinance } from "@/lib/dashboard-finance";
import { money } from "@/lib/financial-format";
export function DashboardFinance({data, loading, error, retry, today}: {data?: Workspace; loading: boolean; error: boolean; retry: () => void; today: string}) {
  const summary = data && !error ? dashboardFinance(data.entries, data.settings, today) : null;
  const link = (tab: string, scope: string) => `${cashFlowPath}?situacao=${tab}&prazo=${scope}`;
  return <section className="dashboard-finance" aria-label="Financeiro de hoje">
    <div className="dashboard-finance-heading"><h2><Wallet aria-hidden="true"/>Financeiro de hoje</h2><Link to={cashFlowPath}>Ver fluxo de caixa →</Link></div>
    {error ? <div role="alert" className="dashboard-finance-message">Não foi possível carregar o financeiro. <button onClick={retry}>Tentar novamente</button></div> : loading || !summary ? <p className="dashboard-finance-message" role="status">Carregando financeiro…</p> : <>
      <div className="dashboard-finance-grid">
        <Link className="dashboard-finance-card" to={cashFlowPath}><CoinStackIcon aria-hidden="true"/><div><span>Saldo do fluxo de caixa</span><strong className={summary.balance !== null && summary.balance < 0 ? "is-expense" : ""}>{summary.balance === null ? "Não configurado" : money(summary.balance)}</strong><small>{summary.balance === null ? "Configure o saldo inicial e a data" : "Saldo inicial + entradas − saídas pagas"}</small></div></Link>
        <Link className="dashboard-finance-card" to={link("pay", "hoje")}><ArrowUpRight className="is-expense" aria-hidden="true"/><div><span>A pagar hoje</span><strong className="is-expense">{money(summary.payable.amount)}</strong><small>{summary.payable.count} conta(s) pendente(s)</small></div></Link>
        <Link className="dashboard-finance-card" to={link("receive", "hoje")}><ArrowDownLeft className="is-income" aria-hidden="true"/><div><span>A receber hoje</span><strong className="is-income">{money(summary.receivable.amount)}</strong><small>{summary.receivable.count} recebimento(s) pendente(s)</small></div></Link>
      </div>
      {summary.overdue.count > 0 && <Link className="dashboard-finance-overdue" to={link("pay", "atrasados")}><AlertTriangle aria-hidden="true"/><span>{summary.overdue.count} conta(s) em atraso · <strong>{money(summary.overdue.amount)}</strong></span><span>Consultar →</span></Link>}
    </>}
  </section>;
}
