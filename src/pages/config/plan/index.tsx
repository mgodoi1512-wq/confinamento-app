import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CreditCard, ExternalLink, FlaskConical, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { billingMoney, getMyPlan, getProductionPlan, productionPayment, productionSubscription, productionAnnual, type AnnualPurchaseInput, sandboxPayment, sandboxSubscription, type SandboxPaymentInput, type SubscriptionInput, type MyPlanOrder } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { AnnualPurchasePanel } from "@/components/app/annual-purchase-panel";
import { PlanPixDialog } from "@/components/app/plan-pix-dialog";

const statusLabel: Record<string, string> = { creating: "Geração em conferência", PENDING: "Aguardando pagamento", RECEIVED: "Recebido", CONFIRMED: "Confirmado", OVERDUE: "Vencido", REFUNDED: "Estornado", DELETED: "Cancelado", AWAITING_RISK_ANALYSIS: "Em análise", AUTHORIZED: "Aguardando captura", REFUND_REQUESTED: "Estorno solicitado", REFUND_IN_PROGRESS: "Estorno em andamento", CHARGEBACK_REQUESTED: "Contestado", CHARGEBACK_DISPUTE: "Contestação em análise" };
const subLabel: Record<string, string> = { creating: "Criação em conferência", ACTIVE: "Renovação ativa", INACTIVE: "Renovação pausada", EXPIRED: "Recorrência encerrada", canceling: "Cancelamento em conferência", CANCELLED: "Renovação cancelada" };
const simulationLabel: Record<string, string> = { paid: "Período pago", grace: "Em tolerância de pagamento", expired: "Período encerrado", awaiting_payment: "Aguardando primeiro pagamento" };
const dateLabel = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "—";
const timeLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
const paid = (o: MyPlanOrder) => !(o.refundedCents ?? 0) && (o.status === "RECEIVED" || (o.status === "CONFIRMED" && o.method === "CREDIT_CARD"));
const safeLink = (url: string | null): url is string => !!url && /^https:\/\/(sandbox\.asaas\.com|www\.asaas\.com|asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(url);

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
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [cancelSubscriptionOpen, setCancelSubscriptionOpen] = useState(false);
  const subscriptionAction = useMutation({ mutationFn: (input: SubscriptionInput) => real ? input.action === "create" && input.plan === "annual" && input.method === "CREDIT_CARD" ? productionAnnual({ action: "create", installmentCount, name: input.name, cpfCnpj: input.cpfCnpj }, query.data?.billingVersion) : productionSubscription(input, query.data?.billingVersion) : sandboxSubscription(input),
    onSuccess: (_, input) => { setCpf(""); setAccepted(false); toast.success(input.action === "cancel" ? "Cancelamento confirmado." : real ? input.action === "create" && input.plan === "annual" && input.method === "CREDIT_CARD" ? "Contratação anual preparada." : input.action === "create" ? "Assinatura preparada." : "Assinatura atualizada." : "Assinatura consultada no Sandbox."); },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const annualAction = useMutation({ mutationFn: (input: AnnualPurchaseInput) => productionAnnual(input, query.data?.billingVersion),
    onSuccess: (_, input) => { setAccepted(false); toast.success(input.action === "cancel" ? "Contratação cancelada." : "Contratação anual consultada."); },
    onError: (error: Error) => toast.error(error.message), onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const payment = useMutation({ mutationFn: (input: SandboxPaymentInput) => real ? input.action === "refresh" && query.data?.orders.find(order => order.id === input.id)?.installmentCount ? productionAnnual({ action: "refresh", id: input.id }) : productionPayment(input.action === "refresh" ? input.id : "") : sandboxPayment(input),
    onSuccess: () => toast.success("Pagamento consultado."), onError: (error: Error) => toast.error(error.message),
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const overview = query.data;
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const enterPlatform = async () => {
    setEntering(true);
    try { await refreshProfile(); navigate("/", { replace: true }); }
    catch { toast.error("Não foi possível verificar o acesso. Tente novamente."); }
    finally { setEntering(false); }
  };
  const entryLabel = overview?.farmName ? `Ir para Fazenda ${overview.farmName}` : "Ir para Plataforma";
  const canCreate = real ? overview?.canCreate === true : overview?.canTest === true;
  const pixOrder = real ? overview?.orders.find(order => order.id === pixOrderId && order.method === "PIX") : undefined;
  const subscription = overview?.subscription;
  const annualPurchase = real ? overview?.annualPurchase : null;
  // Cancelamentos confirmados sem cobertura ficam apenas no histórico de pagamentos.
  const showAnnualPurchase = !!annualPurchase && !(
    annualPurchase.status === "DELETED" && annualPurchase.cancelState === "CANCELLED"
    && !annualPurchase.validFrom && !annualPurchase.active
  );
  const activeAnnual = annualPurchase?.active === true;
  const hasPaidSubscription = !!subscription && !!overview?.orders.some(order => order.subscriptionId === subscription.id && (paid(order) || order.validFrom));
  const active = !!subscription && subscription.status !== "CANCELLED";
  const legacy = overview?.orders.filter(order => !order.subscriptionId && !order.installmentCount) ?? [];
  const legacyPending = legacy.some(order => !order.archived && !["REFUNDED", "DELETED"].includes(order.status));
  const busy = subscriptionAction.isPending || payment.isPending || annualAction.isPending;
  const selectedPlan = activeAnnual ? "annual" : active ? subscription.plan : plan;
  const annualCard = real && plan === "annual" && method === "CREDIT_CARD";
  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="font-display text-2xl font-semibold md:text-3xl">Meu plano</h1><p className="text-sm text-muted-foreground">Planos, renovação e pagamentos da sua fazenda.</p></div>
      {approved ? <Button variant="outline" asChild><Link to="/config"><ArrowLeft className="size-4" />Configurações</Link></Button> : null}
    </div>
    {tenant?.isAdmin && !forceProduction ? <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">Ambiente<select className="rounded-lg border bg-background px-3 py-2" value={chosenEnvironment} disabled={busy} onChange={event => { setPixOrderId(null); setChosenEnvironment(event.target.value as "sandbox" | "production"); }}><option value="sandbox">Sandbox · testes</option><option value="production">Produção · pagamentos reais</option></select></label></div> : null}
    {query.isPending ? <p role="status">Carregando seu plano…</p> : query.isError ? <Card><CardContent className="space-y-3 pt-5"><p role="alert">{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></CardContent></Card> : overview ? <>
      <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm"><p className="font-semibold">{real ? "Acesso à plataforma" : "Sandbox · testes"}</p><p className="mt-1 text-muted-foreground">{real ? overview.mode === "automatic" ? "Seu acesso acompanha a vigência do plano. Cortesias e liberações do administrador também são respeitadas." : "Seu acesso é gerenciado pelo administrador da plataforma. Assinaturas existentes continuam disponíveis para consulta e cancelamento." : "As assinaturas estão em teste. A simulação não altera o acesso da fazenda."}</p>{real && ["rejected", "suspended"].includes(tenant?.status ?? "") ? <p className="mt-2 text-destructive">Sua conta está bloqueada pelo administrador. Pagamento não remove esse bloqueio; você pode consultar ou cancelar a assinatura.</p> : null}</div>
      {real && overview.access?.allowed && overview.access.reason === "paid" ? <section className="space-y-3 rounded-xl border border-green-600/30 bg-green-600/5 p-5" aria-live="polite"><h2 className="text-xl font-semibold text-green-700 dark:text-green-400">Pagamento confirmado!</h2><p className="text-sm">Seu pagamento foi identificado. Clique abaixo para continuar.</p><Button disabled={entering} onClick={() => void enterPlatform()}>{entering ? "Verificando acesso…" : entryLabel}</Button></section> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["monthly", "annual"] as const).map(item => <Card key={item} className={cn("flex h-full flex-col transition-colors", selectedPlan === item && "border-primary ring-1 ring-primary/30")}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-lg">{item === "monthly" ? "Mensal" : "Anual"}{item === "annual" && overview.annualCents < overview.monthlyCents * 12 ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Melhor valor</span> : null}</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div><p className="font-display text-3xl font-semibold">{billingMoney(item === "monthly" ? overview.monthlyCents : overview.annualCents)}</p><p className="text-sm text-muted-foreground">{item === "monthly" ? "a cada mês" : real ? "12 meses de acesso · cartão em até 12x sem juros" : "a cada ano, sem parcelamento"}</p></div>
            <ul className="space-y-2 text-sm">{["Gestão de animais, lotes e currais", "Dietas, tratos, pesagens e sanidade", "Exportação em PDF e Excel"].map(text => <li key={text} className="flex gap-2"><Check className="size-4 shrink-0 text-primary" />{text}</li>)}</ul>
            {item === "annual" && overview.annualCents < overview.monthlyCents * 12 ? <p className="text-sm font-bold text-green-700 dark:text-green-400">Economize {billingMoney(overview.monthlyCents * 12 - overview.annualCents)} em relação a 12 mensalidades.</p> : null}
            {overview.canTest ? <label className="mt-auto flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" name="plan" value={item} checked={selectedPlan === item} onChange={() => { setPlan(item); setAccepted(false); }} disabled={busy || active || activeAnnual || legacyPending || !canCreate} />Selecionar {item === "monthly" ? "mensal" : "anual"}</label> : null}
          </CardContent>
        </Card>)}
      </div>
      {!overview.isOwner ? <p className="text-sm text-muted-foreground">O plano é administrado pelo titular da fazenda.</p> : !overview.canTest ? <p className="text-sm text-muted-foreground">Os pagamentos serão disponibilizados quando a cobrança for ativada pelo administrador.</p> : <>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg">{real ? <CreditCard className="size-5" /> : <FlaskConical className="size-5" />}{real ? activeAnnual || annualCard ? "Meu plano anual" : "Minha assinatura" : "Assinatura de teste"}</CardTitle><p className="text-sm text-muted-foreground">{activeAnnual || annualCard ? "Anual no cartão: contratação de 12 meses, em até 12x sem juros, sem renovação automática." : "Mensal no cartão: renovação automática. Pix: nova fatura a cada período, para pagar manualmente."}</p></CardHeader>
        <CardContent className="space-y-4">
          {real && overview.courtesy?.enabled ? <section className="space-y-2 rounded-lg border bg-muted/30 p-4"><p className="font-semibold">Plano cortesia{overview.courtesy.active ? " · Ativo" : " · Encerrado"}</p><p className="text-sm">{overview.courtesy.expiresOn ? `${overview.courtesy.active ? "Sua cortesia expira em" : "Sua cortesia expirou em"} ${dateLabel(overview.courtesy.expiresOn)}.` : "Cortesia sem data de expiração definida."}</p></section> : null}
          {showAnnualPurchase && annualPurchase ? <AnnualPurchasePanel purchase={annualPurchase} busy={busy} onRefresh={() => annualAction.mutate({ action: "refresh", id: annualPurchase.id })} onCancel={() => annualAction.mutate({ action: "cancel", id: annualPurchase.id, confirm: true })} /> : null}
          {subscription && (!activeAnnual || subscription.status !== "CANCELLED") ? <div className="space-y-3 rounded-lg border bg-muted/30 p-4" aria-live="polite">
            <p className="font-semibold">{subscription.plan === "annual" ? "Anual" : "Mensal"} · {billingMoney(subscription.amountCents)} · {subscription.method === "PIX" ? "Pix" : "Cartão"}</p>
            <p className="text-sm">{subLabel[subscription.status]} · {real ? ({manual:"Liberação manual",admin:"Conta administradora",manual_release:"Acesso liberado manualmente",courtesy:"Cortesia",paid:"Período pago",grace:"Em tolerância",expired:"Pagamento pendente",awaiting_payment:"Aguardando pagamento",review:"Pagamento em conferência"} as Record<string,string>)[overview.access?.reason ?? ""] ?? "Em conferência" : simulationLabel[overview.simulatedStatus ?? ""] ?? "Em conferência"}</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2"><p>Próximo vencimento: <strong>{dateLabel(subscription.nextDueOn)}</strong></p><p>Cobertura paga até: <strong>{dateLabel(real ? overview.access?.paidThrough : overview.paidThrough)}</strong></p></div>
            <p className="text-xs text-muted-foreground">A cobertura termina na data indicada, quando começa o próximo período. Nas renovações em atraso, você tem {overview.graceDays ?? 3} dias de tolerância para regularizar o pagamento.</p>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || subscription.status === "CANCELLED"} onClick={() => subscriptionAction.mutate({ action: "refresh", id: subscription.id })}><RefreshCw className={cn("size-4", subscriptionAction.isPending && "animate-spin")} />Consultar assinatura</Button>
            {active ? <AlertDialog open={cancelSubscriptionOpen} onOpenChange={setCancelSubscriptionOpen}><AlertDialogTrigger asChild><Button variant="outline" disabled={busy || subscription.status === "creating"}>{subscription.status === "canceling" ? "Conferir cancelamento" : hasPaidSubscription ? "Cancelar renovação" : "Cancelar contratação"}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{hasPaidSubscription ? "Cancelar a renovação?" : "Desistir da contratação?"}</AlertDialogTitle><AlertDialogDescription>{hasPaidSubscription ? real ? "As próximas cobranças serão interrompidas" : "As próximas cobranças de teste serão interrompidas" : "A contratação será cancelada"} e as faturas pendentes da assinatura serão removidas no Asaas. Os períodos já pagos permanecem registrados. Isso não solicita estorno.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => subscriptionAction.mutate({ action: "cancel", id: subscription.id, confirm: true })}>{hasPaidSubscription ? "Confirmar cancelamento" : "Confirmar desistência"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}</div>
          </div> : null}
          {!active && !activeAnnual && !legacyPending && canCreate ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (accepted) subscriptionAction.mutate({ action: "create", plan, method, name: name.trim(), cpfCnpj: cpf.replace(/\D/g, "") }); }}>
            <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">Forma de pagamento</legend>{(["PIX", "CREDIT_CARD"] as const).map(value => <label key={value} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm", method === value && "border-primary bg-primary/5")}><input type="radio" name="method" checked={method === value} onChange={() => { setMethod(value); setAccepted(false); }} />{value === "PIX" ? <QrCode className="size-4" /> : <CreditCard className="size-4" />}{value === "PIX" ? "Pix" : "Cartão"}</label>)}</fieldset>
            {annualCard ? <div className="space-y-2 rounded-lg border p-3"><label className="flex flex-wrap items-center gap-3 text-sm font-medium"><span>Parcelamento do anual</span><select className="min-h-11 rounded-lg border bg-background px-3 py-2" value={installmentCount} disabled={busy} onChange={event => { setInstallmentCount(Number(event.target.value)); setAccepted(false); }}>{Array.from({ length: Math.max(1, overview.maxAnnualInstallments ?? 12) }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count === 1 ? "1x · à vista" : `${count}x sem juros`}</option>)}</select></label><p className="text-sm">Total: <strong>{billingMoney(overview.annualCents)}</strong>. 12 meses de acesso, sem renovação automática.</p><p className="text-xs text-muted-foreground">O valor de cada parcela será apresentado pelo Asaas, mantendo o total contratado. O total utiliza o limite do cartão. Os dados serão preenchidos na página segura do Asaas.</p></div> : null}
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>{real ? "Nome do pagador" : "Nome do pagador de teste"}</span><Input value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={120} disabled={busy} autoComplete="off" /></label><label className="space-y-1 text-sm"><span>{real ? "CPF/CNPJ do pagador" : "CPF/CNPJ de teste"}</span><Input value={cpf} onChange={e => setCpf(e.target.value)} required inputMode="numeric" maxLength={18} disabled={busy} autoComplete="off" /></label></div>
            {real ? <p className="text-xs text-muted-foreground">Início do próximo período: {dateLabel(overview.newSubscriptionStartsOn)}. O primeiro pagamento no cartão ocorre ao informar os dados no Asaas, mesmo com vencimento futuro.</p> : null}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={busy} className="mt-1" /><span>{annualCard ? <>Autorizo a contratação anual no total de {billingMoney(overview.annualCents)}, {installmentCount === 1 ? "à vista" : `em ${installmentCount} parcelas sem juros no cartão`}, com 12 meses de acesso após confirmação. Não há renovação automática.</> : <>{real ? "Autorizo a contratação da assinatura:" : "Autorizo a recorrência de teste no Sandbox:"} {billingMoney(plan === "annual" ? overview.annualCents : overview.monthlyCents)} {plan === "annual" ? "a cada ano" : "a cada mês"}. {real ? "A renovação permanece ativa até eu cancelar. No cartão, as próximas cobranças serão automáticas; no Pix, pagarei cada fatura." : "Usarei apenas dados fictícios."}</>}</span></label>
            <Button type="submit" disabled={busy || !accepted}>{subscriptionAction.isPending ? "Preparando…" : real ? annualCard ? `Contratar anual em ${installmentCount}x` : "Contratar assinatura" : "Criar assinatura de teste"}</Button>
          </form> : legacyPending ? <p className="text-sm">Encerre o teste avulso anterior na lista de pagamentos antes de iniciar a assinatura.</p> : !active && !activeAnnual && !canCreate ? <p className="text-sm text-muted-foreground">{real ? "A contratação não está disponível para esta conta ou a fazenda tem liberação sem cobrança. Consulte o administrador; contratos existentes continuam disponíveis para cancelamento." : "Contratação indisponível."}</p> : null}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Pagamentos e vencimentos</CardTitle><p className="text-sm text-muted-foreground">Consulte suas cobranças, vencimentos e confirmações de pagamento. A situação é atualizada automaticamente enquanto esta página estiver aberta.</p></CardHeader><CardContent className="space-y-3">
          {!overview.orders.length ? <p className="text-sm text-muted-foreground">Suas cobranças aparecerão aqui após a contratação do plano.</p> : overview.orders.map(order => <div key={order.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{order.installmentCount ? `Anual · ${order.installmentCount}x sem juros` : order.subscriptionId ? "Assinatura" : real ? "Pagamento" : "Teste avulso"} · {billingMoney(order.amountCents)} · {order.method === "PIX" ? "Pix" : "Cartão"}{order.archived ? " · Encerrado" : ""}</p><p className="text-sm">{statusLabel[order.status] ?? "Em conferência"}</p></div>
            <p className="text-xs text-muted-foreground">Vencimento: {dateLabel(order.dueOn)}{paid(order) && order.validUntil ? ` · Período: ${dateLabel(order.validFrom)} a ${dateLabel(order.validUntil)}` : ""}</p>
            {(order.refundedCents ?? 0) > 0 ? <p className="text-sm">Estorno: {billingMoney(order.refundedCents!)}. Período sujeito a conferência.</p> : null}
            {order.lastWebhookAt ? <p className="text-xs text-primary">Sincronização automática: webhook processado em {timeLabel(order.lastWebhookAt)}.</p> : null}
            <div className="flex flex-wrap gap-2">{safeLink(order.invoiceUrl) && !paid(order) && !["DELETED", "REFUNDED"].includes(order.status) && !order.archived ? real && order.method === "PIX" ? <Button size="sm" onClick={() => setPixOrderId(order.id)}><QrCode className="size-4" />Abrir pagamento</Button> : <Button asChild size="sm"><a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer">Abrir pagamento<ExternalLink className="size-4" /></a></Button> : null}
              {!order.archived && ["PENDING", "OVERDUE"].includes(order.status) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => payment.mutate({ action: "refresh", id: order.id })}>Atualizar situação</Button> : null}
              {!real && !order.subscriptionId && !order.archived && (paid(order) || ["REFUNDED", "DELETED"].includes(order.status)) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => payment.mutate({ action: "archive", id: order.id })}>Encerrar teste avulso</Button> : null}
            </div>
          </div>)}
        </CardContent></Card>
      </>}
    </> : null}
    {pixOrder ? <PlanPixDialog key={pixOrder.id} order={pixOrder} entryLabel={entryLabel} onEnter={() => void enterPlatform()} entering={entering} onClose={() => setPixOrderId(null)} onCancel={!hasPaidSubscription && subscription && active && pixOrder.subscriptionId === subscription.id ? () => { setPixOrderId(null); requestAnimationFrame(() => setCancelSubscriptionOpen(true)); } : undefined} cancelDisabled={busy || subscription?.status === "creating"} /> : null}
  </div>;
}
