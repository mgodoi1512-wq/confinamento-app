import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { billingAdmin, billingAdminKey, checkAsaasProduction, type BillingSettings } from "@/lib/billing";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export function ProductionBillingControls({ settings }: { settings: BillingSettings }) {
  const client = useQueryClient();
  const { refreshProfile } = useAuth();
  const [confirm, setConfirm] = useState<"manual" | "automatic" | null>(null);
  const verify = useMutation({ mutationFn: checkAsaasProduction,
    onSuccess: () => { toast.success("Conta e receptor de produção verificados. Nenhuma cobrança foi criada."); void client.invalidateQueries({ queryKey: billingAdminKey }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const mode = useMutation({ mutationFn: (value: "manual" | "automatic") => billingAdmin("set_mode", { mode: value, confirm: true, expectedUpdatedAt: settings.updatedAt }),
    onSuccess: data => { client.setQueryData(billingAdminKey, data); setConfirm(null); void refreshProfile(); toast.success("Modo de acesso atualizado."); }, onError: (error: Error) => toast.error(error.message),
  });
  return <>
    <div className="grid gap-4 md:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-lg">Liberação manual {settings.mode === "manual" ? "· Ativo" : ""}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Aprovação e suspensão pelo administrador. O pagamento não é exigido para acessar a fazenda.</p><Button variant="outline" disabled={settings.mode === "manual" || mode.isPending} onClick={() => setConfirm("manual")}>Usar liberação manual</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-lg">Acesso com cobrança {settings.mode === "automatic" ? "· Ativo" : ""}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Pagamento real confirmado libera o período. Renovações têm 3 dias de tolerância. Cortesias e liberações manuais são respeitadas.</p><Button disabled={settings.mode === "automatic" || !settings.activationReady || mode.isPending} onClick={() => setConfirm("automatic")}>Ativar cobrança automática</Button><p className="text-xs text-muted-foreground">Requer verificação de produção recente e confirmação de um pagamento real por webhook. Contas suspensas e recusadas permanecem bloqueadas.</p></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="text-lg">Preparação de produção</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Verifica a conta aprovada, a configuração do webhook e a autenticação do receptor. Este botão não cria pagamentos nem altera o modo.</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={verify.isPending} onClick={() => verify.mutate()}>{verify.isPending ? "Verificando…" : "Verificar produção"}</Button>{settings.integrationReady ? <Button asChild variant="outline"><Link to="/config/plano?ambiente=production">Contratação real controlada</Link></Button> : null}</div><p>Conexão: {settings.productionCheckedAt ? new Date(settings.productionCheckedAt).toLocaleString("pt-BR") : "Ainda não verificada"}.</p><p>Pagamento real por webhook: {settings.paymentVerified ? "Verificado" : "Aguardando confirmação"}.</p><p className="text-xs text-muted-foreground">A verificação da conexão vale por uma hora para ativar o modo. A contratação controlada é uma assinatura real, com o valor apresentado em Meu plano.</p>{verify.isError ? <p role="alert" className="text-destructive">{verify.error.message}</p> : null}</CardContent></Card>
    <Dialog open={!!confirm} onOpenChange={open => { if (!open && !mode.isPending) setConfirm(null); }}><DialogContent><DialogHeader><DialogTitle>{confirm === "automatic" ? "Ativar cobrança real e regra de acesso?" : "Voltar à liberação manual?"}</DialogTitle><DialogDescription>{confirm === "automatic" ? "Novas fazendas seguirão a contratação real. As liberações manuais existentes e as cortesias serão mantidas. Cadastros pendentes poderão ser liberados após pagamento confirmado; contas suspensas ou recusadas não serão reativadas." : "O acesso volta a depender da aprovação administrativa. As assinaturas e cobranças já autorizadas no Asaas continuam ativas até serem canceladas."}</DialogDescription></DialogHeader>{mode.isError ? <p role="alert">{mode.error.message}</p> : null}<DialogFooter><Button variant="outline" disabled={mode.isPending} onClick={() => setConfirm(null)}>Voltar</Button><Button disabled={mode.isPending || !confirm} onClick={() => { if (confirm) mode.mutate(confirm); }}>Confirmar mudança</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
