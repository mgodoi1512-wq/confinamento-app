import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { PageLoading } from "@/components/app/page-loading";
const MyPlan = lazy(() => import("@/pages/config/plan"));
export function BillingGate() {
  const { tenant, signOut, refreshProfile } = useAuth();
  return <main className="min-h-dvh bg-background p-4 text-foreground md:p-8">
    <div className="mx-auto mb-5 flex max-w-5xl flex-wrap items-center justify-end gap-2"><ThemeToggle /><Button variant="outline" onClick={() => void refreshProfile()}>Verificar acesso</Button><Button variant="ghost" onClick={() => void signOut().catch(error => toast.error(error.message))}>Sair</Button></div>
    {tenant?.billingOwner ? <Suspense fallback={<PageLoading />}><MyPlan forceProduction /></Suspense> : <section className="mx-auto max-w-lg space-y-3 rounded-xl border bg-card p-6"><h1 className="text-xl font-semibold">Acesso da fazenda pendente</h1><p>O responsável pela fazenda precisa regularizar o plano ou consultar o administrador. Seu usuário de equipe não precisa contratar uma assinatura separada.</p></section>}
  </main>;
}
