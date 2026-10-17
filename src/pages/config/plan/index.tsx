import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CreditCard, ExternalLink, FlaskConical, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { billingMoney, getMyPlan, sandboxPayment, type SandboxPaymentInput, type MyPlanOrder } from "@/lib/billing";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = { creating: "Geração em conferência", PENDING: "Aguardando pagamento", RECEIVED: "Pagamento recebido", CONFIRMED: "Pagamento confirmado", OVERDUE: "Vencido", REFUNDED: "Estornado", DELETED: "Cancelado", AWAITING_RISK_ANALYSIS: "Em análise", AUTHORIZED: "Aguardando captura", REFUND_REQUESTED: "Estorno solicitado", REFUND_IN_PROGRESS: "Estorno em andamento", CHARGEBACK_REQUESTED: "Pagamento contestado", CHARGEBACK_DISPUTE: "Contestação em análise" };
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "—";
const paid = (o: MyPlanOrder) => o.status === "RECEIVED" || (o.status === "CONFIRMED" && o.method === "CREDIT_CARD");
const safeLink = (url: string | null): url is string => !!url && /^https:\/\/(sandbox\.asaas\.com|www\.asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(url);

export default function MyPlan() {
  const { tenant, user } = useAuth();
  const client = useQueryClient();
  const key = ["my-plan", user?.id, tenant?.farmId];
  const query = useQuery({ queryKey: key, queryFn: getMyPlan, enabled: !!tenant?.farmId, retry: false });
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const payment = useMutation({ mutationFn: (input: SandboxPaymentInput) => sandboxPayment(input),
    onSuccess: () => { setCpf(""); toast.success("Situação consultada no Sandbox."); },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => { void client.invalidateQueries({ queryKey: key }); },
  });
  const overview = query.data;
  const current = overview?.orders[0];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const pending = current && !current.archived && !["REFUNDED", "DELETED"].includes(current.status) && (!paid(current) || !!current.validUntil && current.validUntil > today);
  const busy = payment.isPending;
  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="font-display text-2xl font-semibold md:text-3xl">Meu plano</h1><p className="text-sm text-muted-foreground">Planos e pagamentos da sua fazenda.</p></div>
      <Button variant="outline" asChild><Link to="/config"><ArrowLeft className="size-4" />Configurações</Link></Button>
    </div>
    {query.isPending ? <p role="status">Carregando seu plano…</p> : query.isError ? <Card><CardContent className="space-y-3 pt-5"><p role="alert">{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></CardContent></Card> : overview ? <>
      <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
        <p className="font-semibold">Acesso atual: liberação manual</p>
        <p className="mt-1 text-muted-foreground">A cobrança ainda está em preparação. Os testes não alteram o acesso da fazenda.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["monthly", "annual"] as const).map(item => <Card key={item} className={cn("transition-colors", (pending ? current.plan : plan) === item && "border-primary ring-1 ring-primary/30")}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-lg">{item === "monthly" ? "Mensal" : "Anual"}{item === "annual" && overview.annualCents < overview.monthlyCents * 12 ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Melhor valor</span> : null}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><p className="font-display text-3xl font-semibold">{billingMoney(item === "monthly" ? overview.monthlyCents : overview.annualCents)}</p><p className="text-sm text-muted-foreground">{item === "monthly" ? "por mês" : "por ano, em pagamento único"}</p></div>
            <ul className="space-y-2 text-sm">{["Gestão de animais, lotes e currais", "Dietas, tratos, pesagens e sanidade", "Exportação em PDF e Excel"].map(text => <li key={text} className="flex gap-2"><Check className="size-4 shrink-0 text-primary" />{text}</li>)}</ul>
            {item === "annual" && overview.annualCents < overview.monthlyCents * 12 ? <p className="text-sm text-muted-foreground">Economize {billingMoney(overview.monthlyCents * 12 - overview.annualCents)} em relação a 12 mensalidades.</p> : null}
            {overview.canTest ? <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" name="plan" value={item} checked={(pending ? current.plan : plan) === item} onChange={() => setPlan(item)} disabled={busy || !!pending} />Selecionar {item === "monthly" ? "mensal" : "anual"}</label> : null}
          </CardContent>
        </Card>)}
      </div>
      {!overview.isOwner ? <p className="text-sm text-muted-foreground">O plano é administrado pelo titular da fazenda.</p> : !overview.canTest ? <p className="text-sm text-muted-foreground">Os pagamentos serão disponibilizados quando a cobrança for ativada pelo administrador.</p> : <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FlaskConical className="size-5" />Pagamento de teste</CardTitle><p className="text-sm text-muted-foreground">Sandbox do Asaas. Use dados fictícios e os meios de teste indicados no guia. Nenhum pagamento aqui é uma assinatura de produção.</p></CardHeader>
        <CardContent className="space-y-4">
          {pending ? <p className="text-sm">Já existe um pagamento em andamento ou um período de teste confirmado. Consulte a situação abaixo antes de iniciar outro.</p> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (accepted) payment.mutate({ action: "create", plan, method, name: name.trim(), cpfCnpj: cpf.replace(/\D/g, "") }); }}>
            <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">Forma de pagamento</legend>{(["PIX", "CREDIT_CARD"] as const).map(value => <label key={value} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm", method === value && "border-primary bg-primary/5")}><input type="radio" name="method" checked={method === value} onChange={() => setMethod(value)} />{value === "PIX" ? <QrCode className="size-4" /> : <CreditCard className="size-4" />}{value === "PIX" ? "Pix" : "Cartão"}</label>)}</fieldset>
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Nome do pagador de teste</span><Input value={name} onChange={e => setName(e.target.value)} required minLength={3} maxLength={120} disabled={busy} autoComplete="off" /></label><label className="space-y-1 text-sm"><span>CPF/CNPJ de teste</span><Input value={cpf} onChange={e => setCpf(e.target.value)} required inputMode="numeric" maxLength={18} disabled={busy} autoComplete="off" /></label></div>
            <p className="text-xs text-muted-foreground">Os dados do cartão ou o QR Code Pix serão apresentados na página do Asaas. Nesta etapa, cada pagamento cobre um período; a renovação automática está desativada.</p>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={busy} className="mt-1" /><span>Entendi que este é um teste no Sandbox.</span></label>
            <Button type="submit" disabled={busy || !accepted}>{busy ? "Preparando…" : "Gerar pagamento de teste"}</Button>
          </form>}
          {current ? <div className="space-y-3 rounded-lg border bg-muted/30 p-4" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{current.archived ? "Teste encerrado · " : ""}{current.plan === "annual" ? "Anual" : "Mensal"} · {billingMoney(current.amountCents)} · {current.method === "PIX" ? "Pix" : "Cartão"}</p><p className="text-sm text-muted-foreground">{statusLabel[current.status] ?? "Em conferência"}{current.status === "CONFIRMED" && current.method === "PIX" ? " — aguardando recebimento" : ""}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs">Teste</span></div>
            {paid(current) && current.validUntil ? <p className="text-sm">Período simulado: de {dateLabel(current.validFrom)} até {dateLabel(current.validUntil)} (renovação). O acesso atual permanece manual.</p> : null}
            <div className="flex flex-wrap gap-2">{safeLink(current.invoiceUrl) && pending && !paid(current) ? <Button asChild><a href={current.invoiceUrl} target="_blank" rel="noopener noreferrer">Abrir pagamento no Asaas<ExternalLink className="size-4" /></a></Button> : null}<Button variant="outline" disabled={busy} onClick={() => payment.mutate({ action: "refresh", id: current.id })}><RefreshCw className={cn("size-4", busy && "animate-spin")} />Atualizar situação</Button>{!current.archived && (paid(current) || ["REFUNDED", "DELETED"].includes(current.status)) ? <Button variant="outline" disabled={busy} onClick={() => payment.mutate({ action: "archive", id: current.id })}>Encerrar este teste</Button> : null}</div>
            <p className="text-xs text-muted-foreground">Última consulta: {dateLabel(current.checkedAt)}. Após simular o pagamento no Asaas, clique em Atualizar situação. Encerrar o teste permite experimentar outro plano e mantém o registro do pagamento.</p>
          </div> : null}
        </CardContent>
      </Card>}
    </> : null}
  </div>;
}
