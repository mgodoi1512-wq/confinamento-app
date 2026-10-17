import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CreditCard, ExternalLink, FlaskConical, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { billingMoney, getMyPlan, getProductionPlan, productionPayment, productionSubscription, sandboxPayment, sandboxSubscription, type SandboxPaymentInput, type SubscriptionInput, type MyPlanOrder } from "@/lib/billing";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = { creating: "Geração em conferência", PENDING: "Aguardando pagamento", RECEIVED: "Recebido", CONFIRMED: "Confirmado", OVERDUE: "Vencido", REFUNDED: "Estornado", DELETED: "Cancelado", AWAITING_RISK_ANALYSIS: "Em análise", AUTHORIZED: "Aguardando captura", REFUND_REQUESTED: "Estorno solicitado", REFUND_IN_PROGRESS: "Estorno em andamento", CHARGEBACK_REQUESTED: "Contestado", CHARGEBACK_DISPUTE: "Contestação em análise" };
const subLabel: Record<string, string> = { creating: "Criação em conferência", ACTIVE: "Renovação ativa", INACTIVE: "Renovação pausada", EXPIRED: "Recorrência encerrada", canceling: "Cancelamento em conferência", CANCELLED: "Renovação cancelada" };
const simulationLabel: Record<string, string> = { paid: "Período pago", grace: "Em tolerância de pagamento", expired: "Período encerrado", awaiting_payment: "Aguardando primeiro pagamento" };
const dateLabel = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "—";
const timeLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
const paid = (o: MyPlanOrder) => !(o.refundedCents ?? 0) && (o.status === "RECEIVED" || (o.status === "CONFIRMED" && o.method === "CREDIT_CARD"));
const safeLink = (url: string | null): url is string => !!url && /^https:\/\/(sandbox\.asaas\.com|www\.asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(url);

export default function MyPlan({ forceProduction = false }: { forceProduction?: boolean }) {
  const { tenant, user, approved, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const [chosenEnvironment, setChosenEnvironment] = useState<"sandbox" | "production">(params.get("ambiente") === "production" || tenant?.billingMode === "automatic" ? "production" : "sandbox");
  const real = forceProduction || !tenant?.isAdmin || chosenEnvironment === "production";
  const client = useQueryClient();
  const key = ["my-plan", user?.id, tenant?.billingFarmId ?? tenant?.farmId, real ? "production" : "sandbox"];
  const query = useQuery({ queryKey: key, queryFn: real ? getProductionPlan : getMyPlan, enabled: !!(tenant?.billingFarmId ?? tenant?.farmId), retry: false,
    refetchInterval: state => state.state.data?.canTest && (state.state.data.subscription?.status !== "CANCELLED" && !!state.state.data.subscription || state.state.data.orders.some(order => !order.archived)) ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const subscriptionAction = useMutation({ mutationFn: (input: SubscriptionInput) => real ? productionSubscription(input, query.data?.billingVersion) : sandboxSubscription(input),
    onSuccess: (_, input) => { setCpf(""); toast.success(input.action === "cancel" ? "Cancelamento confirmado." : real ? "Assinatura consultada em produção." : "Assinatura consultada no Sandbox."); },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const payment = useMutation({ mutationFn: (input: SandboxPaymentInput) => real ? productionPayment(input.action === "refresh" ? input.id : "") : sandboxPayment(input),
    onSuccess: () => toast.success("Pagamento consultado."), onError: (error: Error) => toast.error(error.message),
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const overview = query.data;
  const refreshedAccess = useRef(false);
  useEffect(() => {
    if (real && overview?.access?.allowed && tenant?.billingRequired && (tenant.status === "approved" || (tenant.status === "pending" && user?.email_confirmed_at && overview.access.reason === "paid")) && !refreshedAccess.current) {
      refreshedAccess.current = true;
      void refreshProfile();
    }
    if (!overview?.access?.allowed) refreshedAccess.current = false;
    }, [real, overview?.access?.allowed, overview?.access?.reason, tenant?.billingRequired, tenant?.status, user?.email_confirmed_at, refreshProfile]);
  const canCreate = real ? overview?.canCreate === true : overview?.canTest === true;
  const subscription = overview?.subscription;
  const active = !!subscription && subscription.status !== "CANCELLED";
  const legacy = overview?.orders.filter(order => !order.subscriptionId) ?? [];
  const legacyPending = legacy.some(order => !order.archived && !["REFUNDED", "DELETED"].includes(order.status));
  const busy = subscriptionAction.isPending || payment.isPending;
  const selectedPlan = active ? subscription.plan : plan;
  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="font-display text-2xl font-semibold md:text-3xl">Meu plano</h1><p className="text-sm text-muted-foreground">Planos, renovação e pagamentos da sua fazenda.</p></div>
      {approved ? <Button variant="outline" asChild><Link to="/config"><ArrowLeft className="size-4" />Configurações</Link></Button> : null}
    </div>
    {tenant?.isAdmin && !forceProduction ? <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">Ambiente<select className="rounded-lg border bg-background px-3 py-2" value={chosenEnvironment} disabled={subscriptionAction.isPending || payment.isPending} onChange={event => setChosenEnvironment(event.target.value as "sandbox" | "production")}><option value="sandbox">Sandbox · testes</option><option value="production">Produção · pagamentos reais</option></select></label></div> : null}
    {query.isPending ? <p role="status">Carregando seu plano…</p> : query.isError ? <Card><CardContent className="space-y-3 pt-5"><p role="alert">{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></CardContent></Card> : overview ? <>
      <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm"><p className="font-semibold">{real ? "Produção · pagamentos reais" : "Sandbox · testes"}</p><p className="mt-1 text-muted-foreground">{real ? overview.mode === "automatic" ? "Acesso conforme pagamento, cortesia ou liberação manual. Pagamentos em teste não liberam o acesso." : "A exigência de pagamento está desativada. Desligar o modo automático não cancela assinaturas no Asaas." : "As assinaturas estão em teste. A simulação não altera o acesso da fazenda."}</p>{real && ["rejected", "suspended"].includes(tenant?.status ?? "") ? <p className="mt-2 text-destructive">Sua conta está bloqueada pelo administrador. Pagamento não remove esse bloqueio; você pode consultar ou cancelar a assinatura.</p> : null}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["monthly", "annual"] as const).map(item => <Card key={item} className={cn("flex h-full flex-col transition-colors", selectedPlan === item && "border-primary ring-1 ring-primary/30")}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-lg">{item === "monthly" ? "Mensal" : "Anual"}{item === "annual" && overview.annualCents < overview.monthlyCents * 12 ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Melhor valor</span> : null}</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div><p className="font-display text-3xl font-semibold">{billingMoney(item === "monthly" ? overview.monthlyCents : overview.annualCents)}</p><p className="text-sm text-muted-foreground">{item === "monthly" ? "a cada mês" : "a cada ano, sem parcelamento"}</p></div>
            <ul className="space-y-2 text-sm">{["Gestão de animais, lotes e currais", "Dietas, tratos, pesagens e sanidade", "Exportação em PDF e Excel"].map(text => <li key={text} className="flex gap-2"><Check className="size-4 shrink-0 text-primary" />{text}</li>)}</ul>
            {item === "annual" && overview.annualCents < overview.monthlyCents * 12 ? <p className="text-sm text-muted-foreground">Economize {billingMoney(overview.monthlyCents * 12 - overview.annualCents)} em relação a 12 mensalidades.</p> : null}
            {overview.canTest ? <label className="mt-auto flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" name="plan" value={item} checked={selectedPlan === item} onChange={() => setPlan(item)} disabled={busy || active || legacyPending || !canCreate} />Selecionar {item === "monthly" ? "mensal" : "anual"}</label> : null}
          </CardContent>
        </Card>)}
      </div>
      {!overview.isOwner ? <p className="text-sm text-muted-foreground">O plano é administrado pelo titular da fazenda.</p> : !overview.canTest ? <p className="text-sm text-muted-foreground">Os pagamentos serão disponibilizados quando a cobrança for ativada pelo administrador.</p> : <>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg">{real ? <CreditCard className="size-5" /> : <FlaskConical className="size-5" />}{real ? "Minha assinatura" : "Assinatura de teste"}</CardTitle><p className="text-sm text-muted-foreground">Cartão: primeira fatura no Asaas e próximas cobranças automáticas no vencimento. Pix: nova fatura a cada período, para pagar manualmente.</p></CardHeader>
        <CardContent className="space-y-4">
          {subscription ? <div className="space-y-3 rounded-lg border bg-muted/30 p-4" aria-live="polite">
            <p className="font-semibold">{subscription.plan === "annual" ? "Anual" : "Mensal"} · {billingMoney(subscription.amountCents)} · {subscription.method === "PIX" ? "Pix" : "Cartão"}</p>
            <p className="text-sm">{subLabel[subscription.status]} · {real ? ({manual:"Liberação manual",admin:"Conta administradora",manual_release:"Acesso liberado manualmente",courtesy:"Cortesia",paid:"Período pago",grace:"Em tolerância",expired:"Pagamento pendente",awaiting_payment:"Aguardando pagamento",review:"Pagamento em conferência"} as Record<string,string>)[overview.access?.reason ?? ""] ?? "Em conferência" : simulationLabel[overview.simulatedStatus ?? ""] ?? "Em conferência"}</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2"><p>Próximo vencimento: <strong>{dateLabel(subscription.nextDueOn)}</strong></p><p>Cobertura paga até: <strong>{dateLabel(real ? overview.access?.paidThrough : overview.paidThrough)}</strong></p></div>
            <p className="text-xs text-muted-foreground">A cobertura termina na data indicada, quando começa o próximo período. Tolerância de {overview.graceDays ?? 3} dias nas renovações em atraso; não há teste grátis antes do primeiro pagamento.</p>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || subscription.status === "CANCELLED"} onClick={() => subscriptionAction.mutate({ action: "refresh", id: subscription.id })}><RefreshCw className={cn("size-4", subscriptionAction.isPending && "animate-spin")} />Consultar assinatura</Button>
            {active ? <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={busy || subscription.status === "creating"}>{subscription.status === "canceling" ? "Conferir cancelamento" : "Cancelar renovação"}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancelar a renovação?</AlertDialogTitle><AlertDialogDescription>{real ? "As próximas cobranças serão interrompidas" : "As próximas cobranças de teste serão interrompidas"} e as faturas pendentes da assinatura serão removidas no Asaas. Os períodos já pagos permanecem registrados. Isso não solicita estorno.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => subscriptionAction.mutate({ action: "cancel", id: subscription.id, confirm: true })}>Confirmar cancelamento</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}</div>
          </div> : null}
          {!active && !legacyPending && canCreate ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (accepted) subscriptionAction.mutate({ action: "create", plan, method, name: name.trim(), cpfCnpj: cpf.replace(/\D/g, "") }); }}>
            <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">Forma de pagamento</legend>{(["PIX", "CREDIT_CARD"] as const).map(value => <label key={value} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm", method === value && "border-primary bg-primary/5")}><input type="radio" name="method" checked={method === value} onChange={() => setMethod(value)} />{value === "PIX" ? <QrCode className="size-4" /> : <CreditCard className="size-4" />}{value === "PIX" ? "Pix" : "Cartão"}</label>)}</fieldset>
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>{real ? "Nome do pagador" : "Nome do pagador de teste"}</span><Input value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={120} disabled={busy} autoComplete="off" /></label><label className="space-y-1 text-sm"><span>{real ? "CPF/CNPJ do pagador" : "CPF/CNPJ de teste"}</span><Input value={cpf} onChange={e => setCpf(e.target.value)} required inputMode="numeric" maxLength={18} disabled={busy} autoComplete="off" /></label></div>
            {real ? <p className="text-xs text-muted-foreground">Início do próximo período: {dateLabel(overview.newSubscriptionStartsOn)}. O primeiro pagamento no cartão ocorre ao informar os dados no Asaas, mesmo com vencimento futuro.</p> : null}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={busy} className="mt-1" /><span>{real ? "Autorizo a assinatura com pagamentos reais:" : "Autorizo a recorrência de teste no Sandbox:"} {billingMoney(plan === "annual" ? overview.annualCents : overview.monthlyCents)} {plan === "annual" ? "a cada ano" : "a cada mês"}. {real ? "A renovação permanece ativa até eu cancelar. No cartão, as próximas cobranças serão automáticas; no Pix, pagarei cada fatura." : "Usarei apenas dados fictícios."}</span></label>
            <Button type="submit" disabled={busy || !accepted}>{subscriptionAction.isPending ? "Preparando…" : real ? "Contratar assinatura · pagamento real" : "Criar assinatura de teste"}</Button>
          </form> : legacyPending ? <p className="text-sm">Encerre o teste avulso anterior na lista de pagamentos antes de iniciar a assinatura.</p> : !active && !canCreate ? <p className="text-sm text-muted-foreground">{real ? "A contratação não está disponível para esta conta ou a fazenda tem liberação sem cobrança. Consulte o administrador; contratos existentes continuam disponíveis para cancelamento." : "Contratação indisponível."}</p> : null}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Pagamentos e vencimentos</CardTitle><p className="text-sm text-muted-foreground">A fatura Pix ou os campos do cartão são apresentados pelo Asaas. A lista acompanha os registros a cada 5 segundos enquanto esta página está aberta.</p></CardHeader><CardContent className="space-y-3">
          {!overview.orders.length ? <p className="text-sm text-muted-foreground">As faturas aparecerão aqui após a geração no Asaas.</p> : overview.orders.map(order => <div key={order.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{order.subscriptionId ? "Assinatura" : real ? "Pagamento" : "Teste avulso"} · {billingMoney(order.amountCents)} · {order.method === "PIX" ? "Pix" : "Cartão"}{order.archived ? " · Encerrado" : ""}</p><p className="text-sm">{statusLabel[order.status] ?? "Em conferência"}</p></div>
            <p className="text-xs text-muted-foreground">Vencimento: {dateLabel(order.dueOn)}{paid(order) && order.validUntil ? ` · Período: ${dateLabel(order.validFrom)} a ${dateLabel(order.validUntil)}` : ""}</p>
            {(order.refundedCents ?? 0) > 0 ? <p className="text-sm">Estorno: {billingMoney(order.refundedCents!)}. Período sujeito a conferência.</p> : null}
            {order.lastWebhookAt ? <p className="text-xs text-primary">Sincronização automática: webhook processado em {timeLabel(order.lastWebhookAt)}.</p> : null}
            <div className="flex flex-wrap gap-2">{safeLink(order.invoiceUrl) && !paid(order) && !["DELETED", "REFUNDED"].includes(order.status) && !order.archived ? <Button asChild size="sm"><a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer">Abrir pagamento<ExternalLink className="size-4" /></a></Button> : null}
              <Button size="sm" variant="outline" disabled={busy || order.status === "DELETED"} onClick={() => payment.mutate({ action: "refresh", id: order.id })}>Atualizar situação</Button>
              {!real && !order.subscriptionId && !order.archived && (paid(order) || ["REFUNDED", "DELETED"].includes(order.status)) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => payment.mutate({ action: "archive", id: order.id })}>Encerrar teste avulso</Button> : null}
            </div>
          </div>)}
        </CardContent></Card>
      </>}
    </> : null}
  </div>;
}
