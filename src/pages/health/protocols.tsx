import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, MoreHorizontal, Pencil, Plus, Save, ShieldPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageLoading } from "@/components/app/page-loading";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { NumericField } from "@/components/app/numeric-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteProtocol, useProtocolItems, useProtocols, useSaveProtocol } from "@/hooks/use-protocols";
import { PROTOCOL_ITEM_KIND_OPTIONS } from "@/lib/constants";
import type { Protocol } from "@/lib/domain";
import { parseNumberInput } from "@/lib/format";

type ItemDraft = { key: string; kind: string; product: string; dose: string; withdrawal: string };

const emptyItem = (): ItemDraft => ({
  key: crypto.randomUUID(),
  kind: "vacina",
  product: "",
  dose: "",
  withdrawal: "",
});

const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const WithdrawalHelp = () => {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}><TooltipTrigger asChild><button type="button" aria-label="Como preencher a carência?" onClick={()=>setOpen(value=>!value)} className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><Info className="size-4" /></button></TooltipTrigger><TooltipContent className="max-w-[min(20rem,calc(100vw-2rem))] text-xs leading-relaxed">Informe a carência em dias indicada na bula para a finalidade de uso. Preencha 0 somente quando a carência for zero. O sistema não define esse prazo automaticamente.</TooltipContent></Tooltip>;
};

const Protocols = () => {
  const { t } = useTranslation();
  const { isGestor } = useAuth();

  const protocolsQuery = useProtocols();
  const itemsQuery = useProtocolItems();
  const saveProtocol = useSaveProtocol();
  const deleteProtocol = useDeleteProtocol();

  const protocols = useMemo(() => protocolsQuery.data ?? [], [protocolsQuery.data]);
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleting, setDeleting] = useState<Protocol | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Protocol | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [drafts, setDrafts] = useState<ItemDraft[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(
    () =>
      protocols.map((protocol) => ({
        protocol,
        items: items.filter((item) => item.protocol_id === protocol.id),
      })),
    [protocols, items],
  );

  const filtered = grouped.filter(({ protocol, items: protocolItems }) =>
    (statusFilter === "all" || protocol.is_active === (statusFilter === "active")) && searchText([protocol.name, ...protocolItems.map(item=>item.product)].join(" ")).includes(searchText(search)),
  ).sort((a,b)=>a.protocol.name.localeCompare(b.protocol.name,"pt-BR",{numeric:true,sensitivity:"base"}));

  const openDialog = (protocol?: Protocol) => {
    setEditing(protocol ?? null);
    setName(protocol?.name ?? "");
    setDescription(protocol?.description ?? "");
    setIsActive(protocol?.is_active ?? true);
    setDrafts(
      protocol
        ? items
            .filter((item) => item.protocol_id === protocol.id)
            .map((item) => ({
              key: item.id,
              kind: item.kind,
              product: item.product,
              dose: item.dose ?? "",
              withdrawal: String(item.withdrawal_days),
            }))
        : [emptyItem()],
    );
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (saveProtocol.isPending) return;
    if (!name.trim()) {
      setError(t("toast.requiredFields"));
      return;
    }

    const filled = drafts.filter(draft=>draft.product.trim() || draft.dose.trim() || draft.withdrawal.trim());
    if (filled.some(draft=>!draft.product.trim() || !PROTOCOL_ITEM_KIND_OPTIONS.some(option=>option.value===draft.kind) || parseNumberInput(draft.withdrawal) === null || !Number.isInteger(parseNumberInput(draft.withdrawal)) || (parseNumberInput(draft.withdrawal) ?? -1) < 0)) {
      setError("Confira os produtos e informe a carência em dias inteiros, a partir de zero.");
      return;
    }
    try {
      await saveProtocol.mutateAsync({
        protocol: {
          id: editing?.id,
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        },
        items: filled.map((draft) => ({
          kind: draft.kind,
          product: draft.product.trim(),
          dose: draft.dose.trim() || null,
          withdrawal_days: parseNumberInput(draft.withdrawal) ?? 0,
        })),
      });
      toast.success(t("health.protocols.saved"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  const remove = async (protocol: Protocol) => {
    if (deleteProtocol.isPending) return;
    try {
      await deleteProtocol.mutateAsync(protocol.id);
      toast.success(t("health.protocols.deleted"));
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  if (!isGestor) {
    return (
      <EmptyState icon={ShieldPlus} titleKey="empty.permission.title" descriptionKey="empty.permission.description" />
    );
  }

  return (
    <TooltipProvider><div className="space-y-4">
      <PageHeader
        titleKey="health.protocols.title"
        subtitleKey="health.protocols.subtitle"
        actions={
          <Button className="h-10 w-40 max-w-full shrink-0 gap-1.5 px-2 py-1" onClick={() => openDialog()}>
            <Plus />
            <span className="min-w-0 whitespace-normal text-center leading-4">{t("health.protocols.new")}</span>
          </Button>
        }
      />

      <div className="grid items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <TextField label="Buscar protocolo ou produto" value={search} onChange={setSearch} placeholder="Digite o nome" className="[&_input]:h-10 [&_label]:text-xs" />
        <SelectField label="Situação" value={statusFilter} onChange={setStatusFilter} triggerClassName="h-10" className="[&_label]:text-xs" options={[{value:"all",labelKey:"Todos"},{value:"active",labelKey:"Ativos"},{value:"inactive",labelKey:"Inativos"}]} />
        <p role="status" className="pb-2 text-xs text-muted-foreground">{filtered.length} de {grouped.length} protocolos</p>
      </div>
      {protocolsQuery.isLoading || itemsQuery.isLoading ? <PageLoading /> : protocolsQuery.isError || itemsQuery.isError ? <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">Não foi possível carregar os protocolos. <Button variant="outline" onClick={()=>void Promise.all([protocolsQuery.refetch(),itemsQuery.refetch()])}>Tentar novamente</Button></div> : grouped.length === 0 ? (
        <EmptyState
          icon={ShieldPlus}
          titleKey="health.protocols.empty.title"
          descriptionKey="health.protocols.empty.description"
          action={
            <Button className="h-10 w-40 max-w-full shrink-0 gap-1.5 px-2 py-1" onClick={() => openDialog()}>
                <Plus />
              <span className="min-w-0 whitespace-normal text-center leading-4">{t("health.protocols.new")}</span>
            </Button>
          }
        />
      ) : filtered.length === 0 ? <div className="rounded-lg border border-border bg-card p-6 text-center"><p className="text-sm text-muted-foreground">Nenhum protocolo encontrado com esses filtros.</p><Button variant="ghost" className="mt-2" onClick={()=>{setSearch("");setStatusFilter("all");}}>Limpar filtros</Button></div> : (
        <div className="grid items-stretch gap-3 lg:grid-cols-2">
          {filtered.map(({ protocol, items: protocolItems }) => (
            <Card key={protocol.id} className="flex h-full flex-col">
              <CardHeader className="px-4 pb-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="break-words font-sans text-sm font-semibold">{protocol.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{protocolItems.length} {protocolItems.length===1 ? "produto cadastrado" : "produtos cadastrados"}</p>
                    {protocol.description?.trim() && <p className="mt-1 break-words text-xs text-muted-foreground">{protocol.description}</p>}
                  </div>
                  <StatusBadge
                    tone={protocol.is_active ? "success" : "muted"}
                    label={protocol.is_active ? t("config.diets.active") : t("config.diets.inactive")}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 px-4 pb-3">
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {protocolItems.map(item=><li key={item.id} className="space-y-1 px-3 py-2 text-sm"><p className="break-words font-medium">{item.product}</p><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><span>{t(`status.protocolItem.${item.kind}`)}</span><span>· Dose: {item.dose?.trim() || "não informada"}</span><span className={item.withdrawal_days>0 ? "rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : ""}>Carência: {item.withdrawal_days} {item.withdrawal_days===1 ? "dia" : "dias"}</span></div></li>)}
                  {protocolItems.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto cadastrado.</li>
                  ) : null}
                </ul>

                <div className="mt-auto flex items-center justify-end gap-1.5">
                  <Button variant="outline" size="sm" className="h-10 px-4" onClick={()=>openDialog(protocol)}><Pencil className="size-4" />{t("action.edit")}</Button>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-10" aria-label={`Mais opções de ${protocol.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive focus:text-destructive" disabled={deleteProtocol.isPending} onSelect={()=>setDeleting(protocol)}><Trash2 className="mr-2 size-4" />Excluir protocolo</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={value=>{if(!value&&!deleteProtocol.isPending)setDeleting(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir protocolo?</AlertDialogTitle><AlertDialogDescription>Deseja excluir o protocolo {deleting?.name}? Para manter o cadastro, cancele e desative o protocolo em Editar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteProtocol.isPending}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={deleteProtocol.isPending} onClick={()=>{if(deleting)void remove(deleting);}}>{deleteProtocol.isPending ? "Excluindo…" : "Excluir protocolo"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={open} onOpenChange={value=>{if(!saveProtocol.isPending)setOpen(value);}}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-[900px] flex-col gap-0 overflow-hidden p-0" onInteractOutside={event=>{if(saveProtocol.isPending)event.preventDefault();}} onEscapeKeyDown={event=>{if(saveProtocol.isPending)event.preventDefault();}}>
          <DialogHeader className="shrink-0 border-b border-border px-4 py-4 text-left sm:px-5"><DialogTitle className="pr-6">{editing ? t("health.protocols.edit") : t("health.protocols.new")}</DialogTitle><DialogDescription className="text-xs">Organize os produtos, doses e carências do protocolo.</DialogDescription></DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <fieldset disabled={saveProtocol.isPending} className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 [&_input]:h-10 [&_label]:text-xs [&_label]:text-muted-foreground">
                <TextField label={t("field.name")} value={name} onChange={value=>{setName(value);setError(null);}} required />
                <TextField label="Observações (opcional)" value={description} onChange={setDescription} />
              </div>
              <label className="flex w-fit items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={event=>setIsActive(event.target.checked)} className="size-4 rounded border-input accent-primary" />{t("config.diets.active")}</label>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{t("health.protocols.items")}</h3><WithdrawalHelp /></div>
                <p className="text-xs text-muted-foreground">Registre a dose com unidade e referência de aplicação, conforme o produto. Dose e carência não são preenchidas automaticamente.</p>
                {drafts.map((draft,index)=><div key={draft.key} className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">Item {index+1}</span><Button variant="ghost" size="icon" className="size-10 text-muted-foreground hover:text-destructive" aria-label={`Remover item ${index+1}`} onClick={()=>setDrafts(current=>current.filter(item=>item.key!==draft.key))}><Trash2 className="size-4" /></Button></div>
                  <div className="grid min-w-0 grid-cols-2 items-start gap-3 md:grid-cols-[110px_minmax(0,1fr)_140px_110px] [&>div]:min-w-0 [&_label]:text-xs [&_label]:text-muted-foreground [&_input]:h-10">
                    <SelectField className="col-span-2 md:col-span-1" label={t("field.kind")} triggerClassName="h-10" value={draft.kind} onChange={value=>setDrafts(current=>current.map(item=>item.key===draft.key?{...item,kind:value}:item))} options={PROTOCOL_ITEM_KIND_OPTIONS} />
                    <TextField className="col-span-2 md:col-span-1" label={t("field.product")} value={draft.product} onChange={value=>setDrafts(current=>current.map(item=>item.key===draft.key?{...item,product:value}:item))} placeholder="Nome do produto" />
                    <TextField label={t("field.dose")} value={draft.dose} onChange={value=>setDrafts(current=>current.map(item=>item.key===draft.key?{...item,dose:value}:item))} placeholder="Qtd. + unidade" />
                    <NumericField compact label={t("field.withdrawalDays")} inputMode="numeric" placeholder="Informe" value={draft.withdrawal} onValueChange={value=>setDrafts(current=>current.map(item=>item.key===draft.key?{...item,withdrawal:value}:item))} />
                  </div>
                </div>)}
                <Button variant="outline" className="h-10 w-full" onClick={()=>setDrafts(current=>[...current,emptyItem()])}><Plus />{t("health.protocols.addItem")}</Button>
                {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive">{error}</p>}
              </div>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-5">
            <p className="text-xs text-muted-foreground">{drafts.filter(item=>item.product.trim()).length} produto(s) informado(s)</p>
            <div className="grid grid-cols-2 gap-2 sm:flex"><Button variant="outline" className="mt-0 h-10 sm:w-28" disabled={saveProtocol.isPending} onClick={()=>setOpen(false)}>{t("action.cancel")}</Button><Button className="h-10 sm:w-28" onClick={()=>void submit()} disabled={saveProtocol.isPending}><Save />{saveProtocol.isPending ? "Salvando…" : t("action.save")}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div></TooltipProvider>
  );
};

export default Protocols;
