import { ArrowRight, ChartNoAxesCombined, Package, Calculator } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialWorkspace } from "@/hooks/use-financial-workspace";
import { useCostSheet } from "@/hooks/use-finance";
import { dashboardFinance } from "@/lib/dashboard-finance";
import { computeFinance } from "@/lib/finance";
import { money } from "@/lib/financial-format";
import { todayIso } from "@/lib/format";

function FinanceOverview() {
  const workspace = useFinancialWorkspace();
  const costSheet = useCostSheet();
  const today = todayIso();
  const data = workspace.isSuccess ? workspace.data : null;
  const balance = data ? dashboardFinance(data.entries, data.settings, today).balance : null;
  const stockValue = data?.items.length ? data.items.reduce((sum, item) => sum + item.stock_value, 0) : null;
  let rationPrice: number | null = null;
  let invalidCost = false;
  if (costSheet.isSuccess && costSheet.data) {
    try { rationPrice = computeFinance(costSheet.data.parameters).rationPerKg; }
    catch { invalidCost = true; }
  }
  const workspaceValue = (value: number | null) => workspace.isError ? "Resumo indisponível" : workspace.isLoading ? "Carregando…" : value === null ? "Ainda não informado" : money(value);
  const cards = [
    { title: "Fluxo de caixa", description: "Acompanhe entradas, saídas e contas pendentes.", path: "/gestao/financeiro/fluxo-de-caixa", icon: ChartNoAxesCombined, label: "Saldo atual", value: workspaceValue(balance), negative: balance !== null && balance < 0, hint: "Pagamentos e recebimentos realizados até hoje." },
    { title: "Estoque", description: "Gerencie alimentos, animais e equipamentos.", path: "/gestao/financeiro/estoque", icon: Package, label: "Alimentos em estoque", value: workspaceValue(stockValue), negative: false, hint: "Ração, volumoso e ingredientes pelo custo registrado." },
    { title: "Calculadora de ração", description: "Calcule a composição, os custos e o frete.", path: "/gestao/financeiro/alimentacao", icon: Calculator, label: "Último custo salvo da ração", value: costSheet.isError ? "Resumo indisponível" : costSheet.isLoading ? "Carregando…" : invalidCost ? "Revisar cálculo salvo" : rationPrice === null ? "Ainda não informado" : `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(rationPrice)}/kg`, negative: false, hint: "Referência da última composição salva." },
  ];
  return <div className="space-y-5">
    <PageHeader titleKey="nav.finance" subtitleKey="Escolha a área financeira que deseja acessar." />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(card => {
        const Icon = card.icon;
        return <Link key={card.path} to={card.path} className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-6" /></span>
            <div className="min-w-0 flex-1"><h2 className="font-sans text-base font-semibold">{card.title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p></div>
            <ArrowRight className="mt-3 size-4 shrink-0 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <div className="mt-auto pt-4"><div className="space-y-1 border-t border-border pt-3"><p className="text-xs text-muted-foreground">{card.label}</p><p className={`break-words font-sans text-lg font-semibold num ${card.negative && workspace.isSuccess ? "text-destructive" : "text-foreground"}`}>{card.value}</p><p className="text-[11px] leading-relaxed text-muted-foreground">{card.hint}</p></div></div>
        </Link>;
      })}
    </div>
  </div>;
}

export default function FinanceHome() {
  const { isGestor, tenant } = useAuth();
  const farmId = tenant?.farmId;
  if (!isGestor || !farmId) return <p className="p-6">Acesso ao Financeiro disponível aos gestores da fazenda.</p>;
  return <FinanceOverview key={farmId} />;
}
