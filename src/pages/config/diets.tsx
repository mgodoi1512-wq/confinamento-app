import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart3, Info, MoreHorizontal, Package, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageLoading } from "@/components/app/page-loading";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
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
import { useDeleteDiet, useDietItems, useDiets, useSaveDiet } from "@/hooks/use-diets";
import { useFeedStock } from "@/hooks/use-feed-stock";
import { stockItemFor } from "@/lib/feed-stock";
import { normalizeDietName, type Diet } from "@/lib/domain";
import { formatNumber, parseNumberInput } from "@/lib/format";

type ItemDraft = { stockId: string; key: string; ingredient: string; kg: string; unit: "kg" | "percent_bw" };

const emptyItem = (): ItemDraft => ({ stockId: "", key: crypto.randomUUID(), ingredient: "", kg: "", unit: "percent_bw" });

const compactNumber = (value: number, decimals = 4) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(value);
const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const HelpHint = ({ label, children, badge = false }: { label: string; children: string; badge?: boolean }) => {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}><TooltipTrigger asChild><button type="button" onClick={()=>setOpen(current=>!current)} aria-label={label} className={badge ? "mt-1 inline-flex min-h-7 items-center gap-1 rounded-md border border-amber-600/30 bg-amber-50 px-2 text-[11px] text-amber-900 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-amber-950/30 dark:text-amber-200" : "inline-flex min-h-7 min-w-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"}>{badge ? <>Sem vínculo com estoque<Info className="size-3" /></> : <Info className="size-3.5" />}</button></TooltipTrigger><TooltipContent side="top" className="max-w-[min(19rem,calc(100vw-2rem))] text-xs leading-relaxed">{children}</TooltipContent></Tooltip>;
};

const quantitySummary = (items: { kg_per_head_day: number; body_weight_pct?: number | null }[]) => {
  const percentages = items.filter(item => item.body_weight_pct != null);
  const fixed = items.filter(item => item.body_weight_pct == null);
  const parts: string[] = [];
  if (percentages.length) parts.push(`${compactNumber(percentages.reduce((sum, item) => sum + (item.body_weight_pct ?? 0), 0), 4)}% PV`);
  if (fixed.length) parts.push(`${compactNumber(fixed.reduce((sum, item) => sum + item.kg_per_head_day, 0), 3)} kg/cab/dia`);
  return parts.join(" + ") || "0% PV";
};

const SettingsDiets = () => {
  const { t } = useTranslation();
  const { isGestor } = useAuth();

  const dietsQuery = useDiets();
  const itemsQuery = useDietItems();
  const stockQuery = useFeedStock();
  const catalog = stockQuery.data ?? {items:[],links:[]};
  const saveDiet = useSaveDiet();
  const deleteDiet = useDeleteDiet();

  const diets = useMemo(() => dietsQuery.data ?? [], [dietsQuery.data]);
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleting, setDeleting] = useState<Diet | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Diet | null>(null);
  const [name, setName] = useState("");
  const [dryMatter, setDryMatter] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [drafts, setDrafts] = useState<ItemDraft[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(
    () =>
      diets.map((diet) => ({
        diet,
        items: items.filter((item) => item.diet_id === diet.id),
      })),
    [diets, items],
  );

  const filtered = grouped.filter(({ diet, items: dietItems }) =>
    (statusFilter === "all" || diet.is_active === (statusFilter === "active")) &&
    searchText([diet.name, ...dietItems.map(item => stockItemFor(catalog, diet.id, item.ingredient)?.name ?? item.ingredient)].join(" ")).includes(searchText(search)),
  );

  const openDialog = (diet?: Diet) => {
    setEditing(diet ?? null);
    setName(diet?.name ?? "");
    setDryMatter(diet?.dry_matter_pct ? String(diet.dry_matter_pct).replace(".", ",") : "");
    setNotes(diet?.notes ?? "");
    setIsActive(diet?.is_active ?? true);
    setDrafts(
      diet
        ? items
            .filter((item) => item.diet_id === diet.id)
            .map((item) => ({
              key: item.id,
              stockId: stockItemFor(catalog,diet.id,item.ingredient)?.id ?? "",
              ingredient: item.ingredient,
              kg: String(item.body_weight_pct ?? item.kg_per_head_day).replace(".", ","),
              unit: item.body_weight_pct != null ? "percent_bw" : "kg",
            }))
        : [emptyItem()],
    );
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (saveDiet.isPending) return;
    if (!name.trim()) {
      setError(t("toast.requiredFields"));
      return;
    }

    if (diets.some(diet => diet.id !== editing?.id && normalizeDietName(diet.name) === normalizeDietName(name))) {
      setError("Já existe uma dieta com esse nome, ativa ou inativa. Use outro nome ou edite a dieta existente.");
      return;
    }
    const filled = drafts.filter(draft => draft.ingredient.trim() || draft.kg.trim());
    if (!filled.length || filled.some(draft => !draft.ingredient.trim() || parseNumberInput(draft.kg) === null || (parseNumberInput(draft.kg) ?? -1) < 0 || (draft.unit === "percent_bw" && (parseNumberInput(draft.kg) ?? 101) > 100))) {
      setError("Preencha os ingredientes e quantidades. O percentual do peso vivo deve estar entre 0 e 100.");
      return;
    }
    if (!stockQuery.isSuccess || filled.some(draft => !catalog.items.some(item => item.id === draft.stockId))) {setError("Selecione um item do estoque para cada componente da dieta.");return;}
    try {
      await saveDiet.mutateAsync({
        stockLinked: true,
        diet: {
          id: editing?.id,
          name: name.trim().replace(/\s+/g, " "),
          dry_matter_pct: parseNumberInput(dryMatter),
          notes: notes.trim() || null,
          is_active: isActive,
        },
        items: filled.map((draft) => ({
          ingredient: draft.ingredient.trim(),
          stock_item_id: draft.stockId,
          kg_per_head_day: draft.unit === "kg" ? parseNumberInput(draft.kg) ?? 0 : 0,
          body_weight_pct: draft.unit === "percent_bw" ? parseNumberInput(draft.kg) : null,
        })),
      });
      toast.success(t("config.diets.saved"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  const remove = async (diet: Diet) => {
    if (deleteDiet.isPending) return;
    try {
      await deleteDiet.mutateAsync(diet.id);
      toast.success(t("config.diets.deleted"));
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  if (!isGestor) {
    return (
      <EmptyState
        icon={BarChart3}
        titleKey="empty.permission.title"
        descriptionKey="empty.permission.description"
      />
    );
  }

  return (
    <TooltipProvider><div className="space-y-4">
      <PageHeader
        titleKey="config.diets.title"
        subtitleKey="config.diets.subtitle"
        actions={
          <>
            <Button variant="outline" className="h-10" asChild>
              <Link to="/gestao/financeiro/estoque?aba=insumos&categoria=ingrediente">
                <Package />
                Estoque de insumos
              </Link>
            </Button>
            <Button className="h-10 w-40 max-w-full shrink-0" onClick={() => openDialog()}>
              <Plus />
              {t("config.diets.new")}
            </Button>
          </>
        }
      />

      <div className="grid items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <TextField label="Buscar dieta ou ingrediente" value={search} onChange={setSearch} placeholder="Digite o nome" className="[&_input]:h-10 [&_label]:text-xs" />
        <SelectField label="Situação" value={statusFilter} onChange={setStatusFilter} triggerClassName="h-10" className="[&_label]:text-xs" options={[{value:"all",labelKey:"Todas"},{value:"active",labelKey:"Ativas"},{value:"inactive",labelKey:"Inativas"}]} />
        <p role="status" className="pb-2 text-xs text-muted-foreground">{filtered.length} de {grouped.length} dietas</p>
      </div>

      {dietsQuery.isLoading || itemsQuery.isLoading ? <PageLoading /> : dietsQuery.isError || itemsQuery.isError ? <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">Não foi possível carregar as dietas. <Button variant="outline" onClick={()=>void Promise.all([dietsQuery.refetch(),itemsQuery.refetch()])}>Tentar novamente</Button></div> : grouped.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          titleKey="config.diets.empty.title"
          descriptionKey="config.diets.empty.description"
          action={
            <Button className="h-10 w-40 max-w-full shrink-0" onClick={() => openDialog()}>
              {t("config.diets.new")}
            </Button>
          }
        />
      ) : filtered.length === 0 ? <div className="rounded-lg border border-border bg-card p-6 text-center"><p className="text-sm text-muted-foreground">Nenhuma dieta encontrada com esses filtros.</p><Button variant="ghost" className="mt-2" onClick={()=>{setSearch("");setStatusFilter("all");}}>Limpar filtros</Button></div> : (
        <div className="grid items-stretch gap-3 lg:grid-cols-2">
          {filtered.map(({ diet, items: dietItems }) => (
            <Card key={diet.id} className="flex h-full flex-col">
              <CardHeader className="px-4 pb-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="break-words font-sans text-sm font-semibold">{diet.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      {t("config.diets.totalOffered")}:{" "}
                      <span className="num font-medium">
                        {quantitySummary(dietItems)}
                      </span>
                      {diet.dry_matter_pct
                        ? ` · ${t("field.dryMatter")} ${compactNumber(diet.dry_matter_pct, 1)}%`
                        : ""}
                      <HelpHint label="O que significa % PV?">PV significa peso vivo. Os percentuais indicam a quantidade diária de cada componente em relação ao peso vivo do animal; no trato, o cálculo usa o peso médio do lote.</HelpHint>
                    </div>
                  </div>
                  <StatusBadge
                    tone={diet.is_active ? "success" : "muted"}
                    label={diet.is_active ? t("config.diets.active") : t("config.diets.inactive")}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 px-4 pb-3">
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {dietItems.map((item) => {
                    const stock = stockItemFor(catalog, diet.id, item.ingredient);
                    return <li key={item.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="block break-words font-medium">{stock?.name ?? item.ingredient}</span>
                        {stockQuery.isError ? <span className="block text-xs text-muted-foreground">Estoque indisponível</span> : stockQuery.isPending ? <span className="block text-xs text-muted-foreground">Carregando saldo…</span> : stock ? <span className={`block text-xs ${stock.quantity_kg <= 0 ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`}>{compactNumber(stock.quantity_kg, 3)} kg disponíveis{stock.quantity_kg <= 0 ? " · Estoque esgotado" : ""}</span> : <HelpHint badge label={`Sem vínculo com estoque: ${item.ingredient}`}>Edite a dieta e selecione o item de estoque correspondente a este componente. O vínculo permite consultar o saldo e descontar a quantidade no registro do trato.</HelpHint>}
                      </div>
                      <span className="num shrink-0 pt-0.5 text-xs font-medium text-foreground">{item.body_weight_pct != null ? `${compactNumber(item.body_weight_pct)}% PV` : `${compactNumber(item.kg_per_head_day, 3)} kg/cab/dia`}</span>
                    </li>;
                  })}
                  {dietItems.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-muted-foreground">{t("common.noData")}</li>
                  ) : null}
                </ul>

                <div className="mt-auto flex items-center justify-end gap-1.5">
                  <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => openDialog(diet)}><Pencil className="size-4" />{t("action.edit")}</Button>
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-10" aria-label={`Mais opções de ${diet.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive focus:text-destructive" disabled={deleteDiet.isPending} onSelect={()=>setDeleting(diet)}><Trash2 className="mr-2 size-4" />Excluir dieta</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={value=>{if(!value && !deleteDiet.isPending)setDeleting(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir dieta?</AlertDialogTitle><AlertDialogDescription>Deseja excluir a dieta {deleting?.name}? Para manter a formulação disponível no cadastro, você pode cancelar e desativá-la em Editar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteDiet.isPending}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={deleteDiet.isPending} onClick={()=>{if(deleting)void remove(deleting);}}>{deleteDiet.isPending ? "Excluindo…" : "Excluir dieta"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <Dialog open={open} onOpenChange={value=>{if(!saveDiet.isPending)setOpen(value);}}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-[860px] flex-col gap-0 overflow-hidden p-0" onInteractOutside={event=>{if(saveDiet.isPending)event.preventDefault();}} onEscapeKeyDown={event=>{if(saveDiet.isPending)event.preventDefault();}}>
          <DialogHeader className="shrink-0 border-b border-border px-4 py-4 text-left sm:px-5">
            <DialogTitle className="pr-6">{editing ? t("config.diets.edit") : t("config.diets.new")}</DialogTitle>
            <DialogDescription className="text-xs">Defina a composição e vincule cada componente ao estoque.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <fieldset disabled={saveDiet.isPending} className="min-w-0 space-y-4">
              <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <TextField className="[&_input]:h-10 [&_label]:text-xs [&_label]:text-muted-foreground" label={t("field.name")} value={name} onChange={value=>{setName(value);setError(null);}} error={error ?? undefined} required />
                <NumericField compact label={t("field.dryMatter")} unit="%" value={dryMatter} onValueChange={setDryMatter} />
                <TextField className="sm:col-span-2 [&_input]:h-10 [&_label]:text-xs [&_label]:text-muted-foreground" label="Observações (opcional)" value={notes} onChange={setNotes} />
              </div>
              <label className="flex w-fit items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={event=>setIsActive(event.target.checked)} className="size-4 rounded border-input accent-primary" />{t("config.diets.active")}</label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Ingredientes</h3><HelpHint label="Como informar a quantidade diária?">Em % PV, informe o percentual diário sobre o peso vivo. No trato, a quantidade em kg é calculada pelo peso médio do lote. Em kg/animal/dia, a quantidade é fixa por animal, por dia.</HelpHint></div>
                <p className="text-xs text-muted-foreground">Use % do peso vivo ou kg fixos por animal/dia. A divisão por refeição é feita no trato.</p>

                {stockQuery.isError ? <div role="alert" className="rounded-lg border border-destructive/40 bg-card p-3 text-xs"><p>Não foi possível consultar o estoque.</p><Button variant="outline" size="sm" className="mt-2 h-10" onClick={()=>void stockQuery.refetch()}><RefreshCw className="size-4" />Tentar novamente</Button></div> : stockQuery.isSuccess && !catalog.items.length ? <div role="status" className="space-y-2 rounded-lg border border-amber-600/30 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-medium">Cadastre os itens do estoque para vincular os ingredientes.</p>
                  <p>Os componentes atuais e suas quantidades permanecem no formulário. Selecione os itens correspondentes antes de salvar.</p>
                  <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="h-10" asChild><Link to="/gestao/financeiro/estoque?aba=insumos&categoria=ingrediente" target="_blank" rel="noopener noreferrer" title="Abrir o estoque em outra aba"><Package className="size-4" />Cadastrar insumos</Link></Button><Button variant="ghost" size="sm" className="h-10" disabled={stockQuery.isFetching} onClick={()=>void stockQuery.refetch()}><RefreshCw className="size-4" />Atualizar estoque</Button></div>
                </div> : null}

                {drafts.map((draft,index) => {
                  const stock = catalog.items.find(item=>item.id===draft.stockId);
                  return <div key={draft.key} className="space-y-2 rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs"><span className="min-w-0 break-words font-semibold">{draft.ingredient || `Ingrediente ${index+1}`}</span>{!draft.stockId && draft.ingredient ? <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Sem vínculo com estoque</span> : null}</div>
                    <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)_40px] items-start gap-2 md:grid-cols-[minmax(0,1fr)_110px_144px_40px] [&>div]:min-w-0">
                      <SelectField className="col-span-3 [&_label]:text-xs [&_label]:text-muted-foreground md:col-span-1" label="Ingrediente do estoque" triggerClassName="h-10" value={draft.stockId} disabled={!stockQuery.isSuccess || !catalog.items.length || saveDiet.isPending} placeholder="Selecione um item" options={catalog.items.map(item=>({value:item.id,labelKey:`${item.name} · ${formatNumber(item.quantity_kg,3)} kg disponíveis`}))} onChange={value=>setDrafts(current=>current.map(item=>item.key===draft.key?{...item,stockId:value,ingredient:item.ingredient||catalog.items.find(stock=>stock.id===value)?.name||""}:item))} />
                      <SelectField className="[&_label]:text-xs [&_label]:text-muted-foreground" triggerClassName="h-10 px-2" label="Unidade" value={draft.unit} onChange={value=>setDrafts(current=>current.map(item=>item.key===draft.key?{...item,unit:value as ItemDraft["unit"],kg:""}:item))} options={[{value:"percent_bw",labelKey:"% PV"},{value:"kg",labelKey:"kg/animal"}]} />
                      <NumericField compact className="[&_label]:whitespace-nowrap [&_input+span]:shrink-0 [&_input+span]:whitespace-nowrap [&_input]:min-w-0 [&_input]:px-2" label="Quantidade diária" unit={draft.unit === "percent_bw" ? "% PV" : "kg"} value={draft.kg} onValueChange={value=>setDrafts(current=>current.map(item=>item.key===draft.key?{...item,kg:value}:item))} />
                      <Button variant="ghost" size="icon" className="mt-[22px] size-10 text-muted-foreground hover:text-destructive" aria-label={`Remover ingrediente ${index+1}`} onClick={()=>setDrafts(current=>current.filter(item=>item.key!==draft.key))}><Trash2 className="size-4" /></Button>
                    </div>
                    {stock ? <p className={`text-xs ${stock.quantity_kg<=0 ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`}>{compactNumber(stock.quantity_kg,3)} kg disponíveis{stock.quantity_kg<=0 ? " · Estoque esgotado" : ""}</p> : null}
                  </div>;
                })}
                <Button variant="outline" className="h-10 w-full" onClick={()=>setDrafts(current=>[...current,emptyItem()])}><Plus />{t("field.ingredient")}</Button>
                <p className="rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">Estoque zerado permite salvar a formulação com os ingredientes vinculados. A disponibilidade é conferida ao registrar o trato; o fornecimento é bloqueado se faltar saldo.</p>
              </div>
            </fieldset>
          </div>

          <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-5">
            <p className="text-sm text-muted-foreground">{t("config.diets.totalOffered")}: <span className="num font-semibold text-foreground">{quantitySummary(drafts.filter(draft=>draft.kg.trim()).map(draft=>({kg_per_head_day:draft.unit==="kg"?parseNumberInput(draft.kg)??0:0,body_weight_pct:draft.unit==="percent_bw"?parseNumberInput(draft.kg)??0:null})))}</span></p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" className="mt-0 h-10 sm:w-28" disabled={saveDiet.isPending} onClick={()=>setOpen(false)}>{t("action.cancel")}</Button>
              <Button className="h-10 sm:w-28" onClick={()=>void submit()} disabled={saveDiet.isPending||!stockQuery.isSuccess}><Save />{saveDiet.isPending ? "Salvando…" : t("action.save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div></TooltipProvider>
  );
};

export default SettingsDiets;
