import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, ExternalLink, LoaderCircle, QrCode, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { billingMoney, getProductionPix, type MyPlanOrder } from "@/lib/billing";
import { useAuth } from "@/hooks/use-auth";

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
const safeInvoice = (value: string | null): value is string => !!value && /^https:\/\/(www\.asaas\.com|asaas\.com)\/i\/[A-Za-z0-9_-]+$/.test(value);

export function PlanPixDialog({ order, onClose, onCancel, cancelDisabled }: { order: MyPlanOrder; onClose: () => void; onCancel?: () => void; cancelDisabled?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const query = useQuery({ queryKey: ["plan-pix", user?.id, "production", order.id], queryFn: () => getProductionPix(order.id), retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false });
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (query.dataUpdatedAt) void client.invalidateQueries({ queryKey: ["my-plan"] }); }, [query.dataUpdatedAt, client]);
  const result = query.data;
  const fromList = !result || !!order.checkedAt && Date.parse(order.checkedAt) >= Date.parse(result.checkedAt);
  const status = fromList ? order.status : result.status;
  const refunded = fromList ? (order.refundedCents ?? 0) > 0 : result.state === "unavailable";
  const isPaid = !refunded && status === "RECEIVED";
  const processing = !refunded && status === "CONFIRMED";
  const pending = !refunded && ["PENDING", "OVERDUE"].includes(status) && !order.archived;
  const qr = result?.pix;
  const expired = !!qr && Date.parse(qr.expirationDate) <= clock;
  const showQr = pending && !!qr && !expired && result?.amountCents === order.amountCents && !query.isError;
  const copy = async () => {
    if (!showQr || !qr || Date.parse(qr.expirationDate) <= Date.now()) return;
    try { await navigator.clipboard.writeText(qr.payload); setCopied(true); toast.success("Código Pix copiado."); }
    catch { codeRef.current?.focus(); codeRef.current?.select(); toast.info("Copie o código selecionado. No celular, toque e segure para copiar."); }
  };
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] flex h-[94dvh] max-h-[900px] w-[calc(100%_-_1rem)] max-w-[1100px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl outline-none sm:h-[88dvh] sm:w-[94vw] sm:rounded-2xl" onOpenAutoFocus={event => { event.preventDefault(); closeRef.current?.focus(); }}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><QrCode className="hidden size-6 shrink-0 text-primary sm:block" /><div><Dialog.Title className="font-display text-lg font-semibold">Pagamento via Pix</Dialog.Title><Dialog.Description className="text-xs text-muted-foreground">Produção · pagamento real processado pelo Asaas</Dialog.Description></div></div>
          <Dialog.Close asChild><Button ref={closeRef} variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Fechar pagamento Pix"><X /></Button></Dialog.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:p-5"><div><p className="text-sm text-muted-foreground">{order.plan === "annual" ? "Plano anual" : "Plano mensal"} · LiBen</p><p className="font-display text-3xl font-semibold sm:text-4xl">{billingMoney(order.amountCents)}</p></div><p role="status" aria-live="polite" className={isPaid ? "rounded-full bg-green-600/15 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-300" : "rounded-full bg-muted px-3 py-2 text-sm font-medium"}>{isPaid ? "Pagamento recebido" : processing ? "Pagamento em processamento" : pending ? "Aguardando pagamento" : "Pagamento indisponível"}</p></div>
            {isPaid ? <section className="space-y-3 rounded-xl border border-green-600/30 bg-green-600/5 p-6 text-center sm:p-10"><CheckCircle2 className="mx-auto size-14 text-green-600 dark:text-green-400" /><h2 className="font-display text-2xl font-semibold">Pagamento recebido!</h2><p className="text-sm text-muted-foreground">O recebimento foi confirmado na consulta ao Asaas ou pelo webhook. O acesso segue as regras do seu plano e da sua conta.</p><Button onClick={onClose}>Voltar ao meu plano</Button></section>
            : processing ? <section className="space-y-3 rounded-xl border p-6 text-center"><LoaderCircle className="mx-auto size-10 animate-spin text-primary" /><h2 className="text-lg font-semibold">Aguardando confirmação do recebimento</h2><p className="text-sm text-muted-foreground">Não repita o pagamento. A situação será atualizada quando o Asaas confirmar o recebimento.</p></section>
            : !pending ? <p role="status" className="rounded-xl border bg-muted/30 p-6">Esta cobrança não está disponível para pagamento por Pix. Consulte a situação em Meu plano.</p>
            : query.isPending ? <div role="status" className="flex min-h-60 flex-col items-center justify-center gap-3"><LoaderCircle className="size-9 animate-spin text-primary" /><p>Carregando seu Pix…</p></div>
            : showQr && qr ? <div className="grid items-center gap-6 md:grid-cols-[minmax(260px,340px)_1fr] md:gap-8">
              <div className="mx-auto w-full max-w-[340px] rounded-2xl border border-border bg-white p-4 sm:p-5"><img src={`data:image/png;base64,${qr.encodedImage}`} alt={`QR Code Pix da assinatura LiBen no valor de ${billingMoney(order.amountCents)}`} className="aspect-square h-auto w-full" /></div>
              <div className="min-w-0 space-y-4"><div><h2 className="font-display text-xl font-semibold">Pague pelo aplicativo do seu banco</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">No computador, escaneie o QR Code com o celular. Se estiver no celular, copie o código abaixo e use a opção Pix Copia e Cola no seu banco.</p></div><label className="block space-y-2 text-sm font-medium"><span>Pix Copia e Cola</span><textarea ref={codeRef} readOnly value={qr.payload} rows={3} className="w-full resize-none rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs font-normal leading-relaxed" onFocus={event => event.currentTarget.select()} /></label><Button className="min-h-11 w-full sm:w-auto" onClick={() => void copy()}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Código copiado" : "Copiar código Pix"}</Button><p className="text-xs text-muted-foreground">Código válido até {dateTime(qr.expirationDate)} (horário de Brasília). Confira o recebedor e o valor no banco antes de confirmar.</p></div>
            </div>
            : <div className="space-y-3 rounded-xl border p-6" role="alert"><h2 className="text-lg font-semibold">{expired ? "O código Pix expirou" : "Não foi possível carregar o Pix"}</h2><p className="text-sm text-muted-foreground">{expired ? "Atualize a situação ou consulte a fatura no Asaas antes de pagar." : query.error?.message ?? "Tente carregar novamente. A consulta utiliza a cobrança existente."}</p>{safeInvoice(order.invoiceUrl) ? <Button asChild variant="outline"><a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer">Abrir fatura no Asaas<ExternalLink className="size-4" /></a></Button> : null}</div>}
            <p className="text-center text-xs leading-relaxed text-muted-foreground">A situação acompanha as atualizações do Asaas enquanto Meu plano está aberto. Copiar o código ou fechar esta janela não confirma nem cancela o pagamento.</p>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6"><Button variant="outline" className="min-h-11" disabled={query.isFetching} onClick={() => { setCopied(false); void query.refetch(); }}><RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} />Atualizar situação</Button><div className="flex flex-wrap gap-2">{pending && onCancel ? <Button variant="outline" className="min-h-11" disabled={cancelDisabled} onClick={onCancel}>Cancelar contratação</Button> : null}<Dialog.Close asChild><Button variant="ghost" className="min-h-11">Fechar</Button></Dialog.Close></div></footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
