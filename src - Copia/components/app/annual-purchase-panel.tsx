import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { billingMoney, type AnnualPurchase } from "@/lib/billing";
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "—";
const label: Record<string,string> = { creating:"Criação em conferência",PENDING:"Aguardando pagamento",OVERDUE:"Pagamento pendente",CONFIRMED:"Pagamento confirmado",RECEIVED:"Pagamento recebido",DELETED:"Contratação cancelada",REFUNDED:"Pagamento estornado",REFUND_REQUESTED:"Pagamento em conferência",REFUND_IN_PROGRESS:"Estorno em andamento",CHARGEBACK_REQUESTED:"Pagamento contestado",CHARGEBACK_DISPUTE:"Contestação em análise",AWAITING_RISK_ANALYSIS:"Confirmação do parcelamento em análise" };
export function AnnualPurchasePanel({ purchase, busy, onRefresh, onCancel }: { purchase: AnnualPurchase; busy: boolean; onRefresh: () => void; onCancel: () => void }) {
  return <div className="space-y-3 rounded-lg border bg-muted/30 p-4" aria-live="polite">
    <p className="font-semibold">Anual · {billingMoney(purchase.amountCents)} · {purchase.installmentCount === 1 ? "Cartão à vista" : `${purchase.installmentCount}x sem juros no cartão`}</p>
    <p className="text-sm">{purchase.cancelState === "canceling" ? "Cancelamento em conferência" : label[purchase.status] ?? "Em conferência"}</p>
    <p className="text-sm">Validade: <strong>{date(purchase.validFrom)} a {date(purchase.validUntil)}</strong></p>
    <p className="text-xs text-muted-foreground">Contratação de 12 meses, sem renovação automática. Parcelar não transforma o anual em mensalidade. A liberação depende da confirmação do parcelamento completo no cartão.</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={onRefresh}><RefreshCw className="size-4" />Consultar contratação</Button>
      {purchase.canCancel ? <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={busy}>{purchase.cancelState === "canceling" ? "Conferir cancelamento" : "Cancelar contratação"}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desistir da contratação anual?</AlertDialogTitle><AlertDialogDescription>A cobrança pendente será cancelada no Asaas. Se o pagamento já tiver sido confirmado, esta ação não solicita estorno. A desistência só será concluída após confirmação do Asaas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={onCancel}>Confirmar desistência</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}
    </div>
    {purchase.status === "creating" ? <p className="text-xs text-muted-foreground">Use Consultar contratação para recuperar uma criação em conferência antes de tentar cancelar. Não gere outra cobrança.</p> : null}
  </div>;
}
