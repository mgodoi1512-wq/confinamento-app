import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Hand, LockKeyhole, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { billingAdmin, billingAdminKey, billingMoney, type BillingSettings, type FarmBillingControl } from "@/lib/billing";
import { useAuth } from "@/hooks/use-auth";
import { NumericField } from "@/components/app/numeric-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatNumber, todayIso } from "@/lib/format";

const accountLabels = { pending: "Aguardando aprovação", approved: "Aprovada", rejected: "Recusada", suspended: "Suspensa" };
const priceCents = (raw: string) => {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim())) return null;
  const value = Math.round(Number(raw.trim().replace(",", ".")) * 100);
  return Number.isInteger(value) && value >= 100 && value <= 100000000 ? value : null;
};

const SettingsEditor = ({ settings }: { settings: BillingSettings }) => {
  const client = useQueryClient();
  const [monthly, setMonthly] = useState((settings.monthlyCents / 100).toFixed(2).replace(".", ","));
  const [annual, setAnnual] = useState((settings.annualCents / 100).toFixed(2).replace(".", ","));
  const monthlyCents = priceCents(monthly);
  const annualCents = priceCents(annual);
  const valid = monthlyCents !== null && annualCents !== null;
  const dirty = monthlyCents !== settings.monthlyCents || annualCents !== settings.annualCents;
  const saving = useMutation({
    mutationFn: () => billingAdmin("save_settings", { mode: "manual", monthlyCents, annualCents, expectedUpdatedAt: settings.updatedAt }),
    onSuccess: data => { client.setQueryData(billingAdminKey, data); toast.success("Preços de lançamento salvos. Nenhuma cobrança foi criada."); },
    onError: error => toast.error(error.message),
  });
  const savings = valid ? monthlyCents * 12 - annualCents : null;
  return <Card>
    <CardHeader><CardTitle className="text-lg">Promoção de lançamento</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumericField label="Mensalidade" unit="R$" value={monthly} onValueChange={setMonthly} disabled={saving.isPending} error={monthlyCents === null ? "Informe um preço positivo com até duas casas decimais." : undefined} />
        <NumericField label="Anuidade" unit="R$" value={annual} onValueChange={setAnnual} disabled={saving.isPending} error={annualCents === null ? "Informe um preço positivo com até duas casas decimais." : undefined} />
      </div>
      {valid && <p className="text-sm text-muted-foreground">Anual equivalente a {billingMoney(annualCents / 12)}/mês.{savings !== null && savings > 0 ? ` Economia de ${billingMoney(savings)} (${formatNumber(savings / (monthlyCents * 12) * 100, 1)}%) em relação a 12 mensalidades.` : ""}</p>}
      <p className="text-sm text-muted-foreground">Valores por fazenda preparados para a integração. Salvar aqui não cria planos, cobranças ou assinaturas no Asaas.</p>
      <Button disabled={!valid || !dirty || saving.isPending} onClick={() => saving.mutate()}><Save className="size-4" />{saving.isPending ? "Salvando..." : "Salvar preços"}</Button>
      {saving.isError && <p role="alert" className="text-sm text-destructive">{saving.error.message}</p>}
    </CardContent>
  </Card>;
};

const CourtesyEditor = ({ farm, onClose }: { farm: FarmBillingControl; onClose: () => void }) => {
  const client = useQueryClient();
  const [enabled, setEnabled] = useState(farm.courtesyEnabled);
  const [expiresOn, setExpiresOn] = useState(farm.courtesyExpiresOn ?? "");
  const invalidDate = enabled && Boolean(expiresOn) && expiresOn < todayIso();
  const save = useMutation({
    mutationFn: () => billingAdmin("set_courtesy", { farmId: farm.farmId, enabled, expiresOn: enabled && expiresOn ? expiresOn : null, expectedUpdatedAt: farm.updatedAt }),
    onSuccess: data => { client.setQueryData(billingAdminKey, data); onClose(); toast.success("Cortesia atualizada. A aprovação da conta permanece como está."); },
    onError: error => toast.error(error.message),
  });
  return <>
    <DialogHeader><DialogTitle>Cortesia da fazenda</DialogTitle><DialogDescription>{farm.farmName} · {farm.ownerEmail}</DialogDescription></DialogHeader>
    <div className="space-y-4 py-2">
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={enabled} disabled={save.isPending} onChange={event => setEnabled(event.target.checked)} className="size-4 accent-primary" />Conceder cortesia, sem cobrança</label>
      {enabled && <div className="space-y-2"><label htmlFor="courtesy-date" className="text-sm font-medium">Último dia da cortesia (opcional)</label><Input id="courtesy-date" type="date" value={expiresOn} min={todayIso()} onChange={event => setExpiresOn(event.target.value)} disabled={save.isPending} /><p className="text-xs text-muted-foreground">Sem data, a cortesia fica cadastrada por prazo indeterminado. Com data, vale até o final do dia informado, no horário usado pela plataforma.</p></div>}
      {invalidDate && <p role="alert" className="text-sm text-destructive">Escolha hoje ou uma data futura.</p>}
      <p className="rounded-lg bg-muted p-3 text-sm">Nesta etapa, a cortesia fica preparada para a futura cobrança. Ela não aprova cadastros, não reativa contas suspensas e não cancela assinaturas no Asaas.</p>
      {farm.manualAccessPreserved && <p className="text-sm text-muted-foreground">Esta fazenda tem acesso manual preservado. Encerrar a cortesia não remove essa condição.</p>}
      {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
    </div>
    <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button disabled={save.isPending || invalidDate} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar cortesia"}</Button></DialogFooter>
  </>;
};

export const BillingAdmin = () => {
  const { tenant } = useAuth();
  const [selected, setSelected] = useState<FarmBillingControl | null>(null);
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: billingAdminKey, queryFn: () => billingAdmin("overview"), enabled: tenant?.isAdmin === true });
  if (!tenant?.isAdmin) return null;
  if (query.isPending) return <p role="status">Carregando controles de cobrança...</p>;
  if (query.isError) return <div role="alert" className="space-y-3 rounded-xl border border-destructive p-5"><p>Não foi possível carregar os controles de cobrança.</p><p className="text-sm">{query.error.message}</p><p className="text-sm text-muted-foreground">Confira se o SQL da etapa 1 foi aplicado no Supabase. A aprovação manual de clientes continua na aba Cadastros.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>;
  const { settings, farms } = query.data;
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = farms.filter(farm => `${farm.farmName} ${farm.ownerName} ${farm.ownerEmail}`.toLocaleLowerCase("pt-BR").includes(term));
  return <section className="space-y-5" aria-label="Controles de cobrança">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Cobrança e acesso</h2><p className="text-sm text-muted-foreground">Etapa 1: configuração administrativa, sem cobranças reais.</p></div><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="size-4" />Atualizar</Button></div>
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-primary"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Hand className="size-5" />Acesso manual <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Ativo</span></CardTitle></CardHeader><CardContent className="text-sm leading-relaxed">Você aprova os clientes como hoje. Não há exigência de pagamento nesta etapa. Contas pendentes, recusadas e suspensas seguem os controles atuais.</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="size-5" />Com cobrança</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Cartão recorrente e Pix comum, com confirmação automática do pagamento e validade por fazenda.</p><Button disabled variant="outline"><LockKeyhole className="size-4" />Ativar após integrar o Asaas</Button><p className="text-xs text-muted-foreground">A ativação também é bloqueada no servidor. Primeiro serão testados pagamentos, renovações, falhas e cancelamentos.</p></CardContent></Card>
    </div>
    <SettingsEditor key={settings.updatedAt} settings={settings} />
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm leading-relaxed">As fazendas existentes na primeira instalação têm acesso manual preservado. A futura cobrança não deve migrá-las automaticamente. Desligar a exigência de pagamento no LiBen não cancela cobranças já autorizadas no provedor.</div>
    <div className="space-y-3"><h3 className="text-lg font-semibold">Fazendas e cortesias</h3><Input aria-label="Buscar fazenda ou proprietário" placeholder="Buscar fazenda, proprietário ou e-mail" value={search} onChange={event => setSearch(event.target.value)} /><p className="text-xs text-muted-foreground">{filtered.length} fazenda(s). Contas sem fazenda cadastrada aparecem somente em Cadastros.</p>
      <div className="grid gap-4 md:grid-cols-2">{filtered.map(farm => <article key={farm.farmId} className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground"><div><h4 className="font-semibold">{farm.farmName}</h4><p className="text-sm">{farm.ownerName}</p><p className="break-all text-xs text-muted-foreground">{farm.ownerEmail}</p></div><p className="text-sm">Conta: {accountLabels[farm.accountStatus]}</p><p className="text-sm text-muted-foreground">{farm.manualAccessPreserved ? "Acesso manual preservado" : "Seguirá o modo geral quando a integração estiver pronta"}</p><p className="text-sm">{farm.courtesyEnabled ? `${farm.courtesyActive ? "Cortesia cadastrada" : "Cortesia vencida"}${farm.courtesyExpiresOn ? ` · até ${formatDate(farm.courtesyExpiresOn)}` : " · sem prazo"}` : "Sem cortesia cadastrada"}</p><Button variant="outline" onClick={() => setSelected(farm)}>Gerenciar cortesia</Button></article>)}</div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fazenda encontrada.</p>}
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto">{selected && <CourtesyEditor key={selected.farmId + (selected.updatedAt ?? "")} farm={selected} onClose={() => setSelected(null)} />}</DialogContent></Dialog>
  </section>;
};
