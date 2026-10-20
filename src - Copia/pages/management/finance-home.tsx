import { ArrowRight, ChartNoAxesCombined, Package, Calculator } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/hooks/use-auth";

export default function FinanceHome() {
  const { isGestor, tenant } = useAuth();
  const farmId = tenant?.farmId;
  if (!isGestor || !farmId) return <p className="p-6">Acesso ao Financeiro disponível aos gestores da fazenda.</p>;
  return <div className="space-y-6">
    <PageHeader titleKey="nav.finance" subtitleKey="Escolha a área financeira que deseja acessar." />
    <div className="grid gap-4 lg:grid-cols-3">
      <Link to="/gestao/financeiro/alimentacao" className="group flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Calculator className="size-6" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-semibold">Calculadora de ração</h2><p className="mt-1 text-sm text-muted-foreground">Calcule os custos da ração, dos ingredientes, da silagem e do frete.</p></div>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
      </Link>
      <Link to="/gestao/financeiro/fluxo-de-caixa" className="group flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ChartNoAxesCombined className="size-6" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-semibold">Fluxo de caixa</h2><p className="mt-1 text-sm text-muted-foreground">Registre entradas, saídas e acompanhe as contas a pagar e receber.</p></div>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
      </Link>
      <Link to="/gestao/financeiro/estoque" className="group flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="size-6" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-display text-xl font-semibold">Estoque</h2><p className="mt-1 text-sm text-muted-foreground">Controle alimentos, movimentações e o peso dos animais em kg e arrobas.</p></div>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" />
      </Link>
    </div>
  </div>;
}
