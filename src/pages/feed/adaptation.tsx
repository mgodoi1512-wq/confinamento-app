import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCostSheet } from "@/hooks/use-finance";
import { computeFinance } from "@/lib/finance";
import { Calculator, FileDown, Info, Loader2, LockKeyhole, Pencil, RefreshCw, Save, Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/app/data-table";
import { ExportButtons } from "@/components/app/export-buttons";
import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { PageLoading } from "@/components/app/page-loading";
import { StatCard } from "@/components/app/stat-card";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useAdaptationPlans, useSaveAdaptation, useDeleteAdaptation, type AdaptationPlan } from "@/hooks/use-adaptation";
import { useLots } from "@/hooks/use-lots";
import { useWeighings } from "@/hooks/use-weighings";
import { computeAdaptation, defaultAdaptationPhases, validateAdaptation, type AdaptationInput } from "@/lib/adaptation";
import { computeLotMetrics, type Lot } from "@/lib/domain";
import type { ExportReport } from "@/lib/export-data";
import { formatDate, formatDateTime, formatNumber, parseNumberInput, todayIso } from "@/lib/format";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
type Draft = { startDate: string; headCount: string; averageWeightKg: string; feedPriceKg: string; roughagePriceKg: string; totalDays: string; postFeedPct: string; postRoughagePct: string; phases: { feedPct: string; roughagePct: string }[] };
type DraftState = Omit<Draft,"feedPriceKg"|"roughagePriceKg"> & {feedPriceKg:string|null;roughagePriceKg:string|null};
const decimalInput = (value: number) => String(value).replace(".", ",");
const priceInput = (value: number) => {
  const raw = decimalInput(value);
  return raw.includes(",") ? raw.padEnd(raw.indexOf(",") + 3, "0") : `${raw},00`;
};
const draftFromInput = (input: AdaptationInput): Draft => ({
  startDate: input.startDate, headCount: decimalInput(input.headCount), averageWeightKg: decimalInput(input.averageWeightKg), feedPriceKg: priceInput(input.feedPriceKg), roughagePriceKg: priceInput(input.roughagePriceKg), totalDays: decimalInput(input.totalDays), postFeedPct: decimalInput(input.postFeedPct), postRoughagePct: decimalInput(input.postRoughagePct),
  phases: input.phases.map(phase => ({ feedPct: decimalInput(phase.feedPct), roughagePct: decimalInput(phase.roughagePct) })),
});
const initialDraft = (): DraftState => ({ ...draftFromInput({ startDate: todayIso(), headCount: 0, averageWeightKg: 0, feedPriceKg: 0, roughagePriceKg: 0, totalDays: 90, postFeedPct: 2.5, postRoughagePct: 0.8, phases: defaultAdaptationPhases() }), headCount: "", averageWeightKg: "", feedPriceKg:null, roughagePriceKg:null });
const inputFromDraft = (draft: Draft): AdaptationInput => {
  const number = (value: string) => parseNumberInput(value) ?? NaN;
  return validateAdaptation({ ...draft, headCount: number(draft.headCount), averageWeightKg: number(draft.averageWeightKg), feedPriceKg: number(draft.feedPriceKg), roughagePriceKg: number(draft.roughagePriceKg), totalDays: number(draft.totalDays), postFeedPct: number(draft.postFeedPct), postRoughagePct: number(draft.postRoughagePct), phases: draft.phases.map(phase => ({ days: 3, feedPct: number(phase.feedPct), roughagePct: number(phase.roughagePct) })) });
};
type Result = ReturnType<typeof computeAdaptation>;
type SavedRow = { plan: AdaptationPlan; lot: Lot | undefined; result: Result | null };

const PlanningValue = ({ label, value, unit }: { label: string; value: string; unit: string }) => <div className="space-y-1.5">
  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><LockKeyhole className="size-3.5" />{label}</p>
  <output aria-label={label} className="flex h-10 items-center justify-end gap-2 rounded-md border border-dashed border-border bg-black/5 px-3 text-sm font-medium text-muted-foreground dark:bg-white/5"><span className="num">{value}</span><span className="text-xs">{unit}</span></output>
</div>;

const Adaptation = () => {
  const { isGestor } = useAuth();
  const costsQuery=useCostSheet();
  const costDefaults=useMemo(()=>{
    if(!costsQuery.data)return null;
    try{const costs=computeFinance(costsQuery.data.parameters);return{feedPriceKg:priceInput(Number(costs.rationPerKg.toPrecision(12))),roughagePriceKg:costs.silage?priceInput(Number(costs.silage.pricePerKg.toPrecision(12))):null};}
    catch{return null;}
  },[costsQuery.data]);
  const lotsQuery = useLots();
  const weighingsQuery = useWeighings();
  const plansQuery = useAdaptationPlans();
  const savePlan = useSaveAdaptation();
  const deletePlan = useDeleteAdaptation();
  const [exportingPlanId, setExportingPlanId] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<AdaptationPlan | null>(null);
  const busy = savePlan.isPending || deletePlan.isPending;
  const [lotId, setLotId] = useState("");
  const [mode, setMode] = useState<"registered" | "manual">("registered");
  const [registeredDraft, setRegisteredDraft] = useState<DraftState>(initialDraft);
  const [manualDraft, setManualDraft] = useState<DraftState>(initialDraft);
  const [simulationName, setSimulationName] = useState("");
  const rawDraft = mode === "manual" ? manualDraft : registeredDraft;
  const draft=useMemo<Draft>(()=>({...rawDraft,feedPriceKg:rawDraft.feedPriceKg??costDefaults?.feedPriceKg??"",roughagePriceKg:rawDraft.roughagePriceKg??costDefaults?.roughagePriceKg??""}),[rawDraft,costDefaults]);
  const setDraft = mode === "manual" ? setManualDraft : setRegisteredDraft;
  const canCalculate = mode === "manual" || Boolean(lotId);
  const [loadedVersion, setLoadedVersion] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const lots = lotsQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const lot = lots.find(item => item.id === lotId);
  const canLoad = [lotsQuery, weighingsQuery, plansQuery].every(query => query.isSuccess);
  const calculation = useMemo(() => {
    try { const input = inputFromDraft(draft); return { input, result: computeAdaptation(input), error: null }; }
    catch (error) { return { input: null, result: null, error: error instanceof Error ? error.message : "Confira os parâmetros." }; }
  }, [draft]);
  const { result, input } = calculation;
  const dirty = mode === "registered" && Boolean(lotId) && savedDraft !== JSON.stringify(draft);
  const field = (name: Exclude<keyof Draft, "phases">, value: string) => setDraft(current => ({ ...current, [name]: value }));

  const selectLot = (id: string) => {
    if (busy) return;
    const chosen = lots.find(item => item.id === id);
    if (!chosen) return;
    const saved = plans.find(item => item.lot_id === id);
    try {
      const next = saved ? draftFromInput(validateAdaptation(saved.parameters)) : {
        ...initialDraft(), startDate: chosen.system_started_on??chosen.entry_date, headCount: String(chosen.head_count),
        averageWeightKg: String(computeLotMetrics(chosen, weighingsQuery.data ?? []).currentAvgWeight ?? "").replace(".", ","),
      };
      setMode("registered"); setLotId(id); setRegisteredDraft(next); setLoadedVersion(saved?.updated_at ?? null); setSavedDraft(saved ? JSON.stringify(next) : null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abrir o plano."); }
  };
  const refreshLot = async () => {
    if (mode !== "registered" || !lotId || busy) return;
    const [updatedLots, updatedWeighings] = await Promise.all([lotsQuery.refetch(), weighingsQuery.refetch()]);
    if (updatedLots.isError || updatedWeighings.isError) { toast.error("Não foi possível atualizar os dados do lote."); return; }
    const updated = updatedLots.data?.find(item => item.id === lotId);
    if (updated) {
      setDraft(current => ({ ...current, headCount: String(updated.head_count), averageWeightKg: String(computeLotMetrics(updated, updatedWeighings.data ?? []).currentAvgWeight ?? "").replace(".", ",") }));
      toast.success("Peso e quantidade de animais atualizados no planejamento.");
    }
  };
  const save = async () => {
    if (mode !== "registered" || !input || !lotId || !isGestor || busy) return;
    try {
      const saved = await savePlan.mutateAsync({ lotId, parameters: input, expectedUpdatedAt: loadedVersion });
      setRegisteredDraft(draft); setLoadedVersion(saved.updated_at); setSavedDraft(JSON.stringify(draft)); toast.success("Plano de adaptação salvo.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o plano."); }
  };
  const edit = (plan: AdaptationPlan) => {
    if (busy) return;
    selectLot(plan.lot_id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async () => {
    if (!deletingPlan || busy) return;
    try {
      await deletePlan.mutateAsync({ id: deletingPlan.id, expectedUpdatedAt: deletingPlan.updated_at });
      if (lotId === deletingPlan.lot_id) { setLoadedVersion(null); setSavedDraft(null); }
      setDeletingPlan(null);
      toast.success("Plano excluído.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir o plano."); }
  };
  const downloadSavedPlan = async (row: SavedRow) => {
    if (exportingPlanId || !row.result) return;
    setExportingPlanId(row.plan.id);
    try {
      const savedReport = report(row.plan.parameters, row.lot?.code ?? "Lote indisponível");
      savedReport.filename = `adaptacao-${(row.lot?.code ?? row.plan.lot_id).replace(/[^a-zA-Z0-9-]/g, "-")}`;
      const { exportPdf } = await import("@/lib/export-files");
      await exportPdf(savedReport);
      toast.success("PDF do plano salvo gerado.");
    } catch {
      toast.error("Não foi possível gerar o PDF deste plano. Confira os parâmetros e tente novamente.");
    } finally { setExportingPlanId(null); }
  };
  const planActions = (row: SavedRow) => <div className="flex flex-wrap items-center justify-center gap-2">
    <Button variant="outline" size="sm" aria-label={`Baixar PDF da adaptação — ${row.lot?.code ?? "Lote indisponível"}`} disabled={exportingPlanId !== null || !row.result} onClick={()=>void downloadSavedPlan(row)}>{exportingPlanId===row.plan.id ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}Baixar PDF</Button>
    <Button variant="outline" size="sm" disabled={busy || !row.lot} onClick={()=>edit(row.plan)}><Pencil className="size-4" />{isGestor ? "Editar" : "Consultar"}</Button>
    {isGestor && <Button variant="outline" size="sm" className="text-destructive" disabled={busy} onClick={()=>setDeletingPlan(row.plan)}><Trash2 className="size-4" />Excluir</Button>}
  </div>;
  const report = (parameters: unknown = input, lotName = lot?.code ?? "Lote"): ExportReport => {
    if (!parameters) throw new Error("Confira os parâmetros do plano.");
    const input = validateAdaptation(parameters);
    const result = computeAdaptation(input);
    return {
      adaptation: { input, lotName },
      title: `Adaptação — ${lotName}`, filename: "adaptacao", filters: `Lote: ${lotName} | Animais: ${input.headCount} | Peso médio: ${formatNumber(input.averageWeightKg, 2)} kg | Peso total: ${formatNumber(result.totalLiveWeight, 2)} kg`,
      note: `Peso fixo na simulação. Ração: ${money(input.feedPriceKg)}/kg; volumoso: ${money(input.roughagePriceKg)}/kg. Quantidades e custos da tabela correspondem ao lote inteiro. Confinamento: ${input.totalDays} dias, incluindo os 15 dias de adaptação.`,
      columns: [{title:"Etapa"},{title:"De"},{title:"Até"},{title:"Dias",decimals:0},{title:"Ração (% PV)",decimals:2},{title:"Volumoso (% PV)",decimals:2},{title:"Ração kg/dia (lote)",decimals:2},{title:"Volumoso kg/dia (lote)",decimals:2},{title:"Ração período (kg)",decimals:2},{title:"Volumoso período (kg)",decimals:2},{title:"Custo período (R$)",decimals:2}],
      rows: [
        ...result.phases.map(phase => [`Dias ${phase.startDay} a ${phase.endDay}`,formatDate(phase.startDate),formatDate(phase.endDate),phase.days,phase.feedPct,phase.roughagePct,phase.feedDailyKg,phase.roughageDailyKg,phase.feedPeriodKg,phase.roughagePeriodKg,phase.cost]),
        ["Total adaptação",formatDate(input.startDate),formatDate(result.phases[4].endDate),15,null,null,null,null,result.adaptationFeedKg,result.adaptationRoughageKg,result.adaptationCost],
        ...(result.postDays > 0 ? [["Após adaptação",formatDate(result.postStartDate),formatDate(result.endDate),result.postDays,input.postFeedPct,input.postRoughagePct,result.postFeedDailyKg,result.postRoughageDailyKg,result.postFeedDailyKg*result.postDays,result.postRoughageDailyKg*result.postDays,result.postDailyCost*result.postDays]] : []),
        ["Total confinamento",formatDate(input.startDate),formatDate(result.endDate),input.totalDays,null,null,null,null,result.totalFeedKg,result.totalRoughageKg,result.totalCost],
      ],
    };
  };
  const savedRows: SavedRow[] = plans.map(plan => {
    let savedResult: Result | null = null;
    try { savedResult = computeAdaptation(plan.parameters); } catch { /* A linha permanece visível para revisão. */ }
    return { plan, lot: lots.find(item => item.id === plan.lot_id), result: savedResult };
  });
  const savedColumns: Column<SavedRow>[] = [
    { key:"lot",headerKey:"field.lot",render:row=>row.lot?.code ?? "Lote indisponível" },
    { key:"adaptation",headerKey:"Custo da adaptação",numeric:true,render:row=>row.result ? money(row.result.adaptationCost) : "Parâmetros inválidos" },
    { key:"total",headerKey:"Custo do confinamento",numeric:true,render:row=>row.result ? money(row.result.totalCost) : "—" },
    { key:"head",headerKey:"Custo por animal",numeric:true,render:row=>row.result ? money(row.result.totalCostPerHead) : "—" },
    { key:"updated",headerKey:"Atualizado em",render:row=>formatDateTime(row.plan.updated_at) },
    { key:"actions",headerKey:"Ações",render:planActions },
  ];
  const phaseColumns: Column<Result["phases"][number]>[] = [
    {className:"text-center",key:"period",headerKey:"Período",render:row=><div><p className="font-semibold">Dias {row.startDay} a {row.endDay}</p><p className="text-xs text-muted-foreground">{formatDate(row.startDate)} a {formatDate(row.endDate)}</p></div>},
    {className:"text-center",key:"ration",headerKey:"Ração kg/dia (lote)",numeric:true,render:row=>formatNumber(row.feedDailyKg,2)},
    {className:"text-center",key:"roughage",headerKey:"Volumoso kg/dia (lote)",numeric:true,render:row=>formatNumber(row.roughageDailyKg,2)},
    {className:"text-center",key:"rationPeriod",headerKey:"Ração no período (kg)",numeric:true,render:row=>formatNumber(row.feedPeriodKg,2)},
    {className:"text-center",key:"roughagePeriod",headerKey:"Volumoso no período (kg)",numeric:true,render:row=>formatNumber(row.roughagePeriodKg,2)},
    {className:"text-center",key:"cost",headerKey:"Custo do período",numeric:true,render:row=>money(row.cost)},
  ];

  return <div className="space-y-4"><p className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" /><span>Planejamento de adaptação ao confinamento. Para suplementação a pasto ou semiconfinamento, utilize Dietas e Trato.</span></p>
    <PageHeader titleKey="nav.adaptation" subtitleKey="Planeje ração, volumoso e custos por lote durante e após a adaptação." actions={<>
      <ExportButtons getReport={()=>report(input, mode === "manual" ? simulationName.trim() || "Simulação avulsa" : lot?.code ?? "Lote")} disabled={!canCalculate || !result} />
      {isGestor && mode === "registered" && <Button className="h-10 w-40 max-w-full shrink-0 gap-1.5 px-2" onClick={()=>void save()} disabled={!canLoad || !input || !lotId || lot?.status!=="ativo" || busy || !dirty}><Save />{loadedVersion ? "Salvar alterações" : "Salvar plano"}</Button>}
    </>} />
    <div role="group" aria-label="Tipo de planejamento" className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
      <Button variant={mode === "registered" ? "default" : "ghost"} className="h-9 text-xs sm:text-sm" aria-pressed={mode === "registered"} disabled={busy} onClick={()=>setMode("registered")}>Lote cadastrado</Button>
      <Button variant={mode === "manual" ? "default" : "ghost"} className="h-9 text-xs sm:text-sm" aria-pressed={mode === "manual"} disabled={busy} onClick={()=>setMode("manual")}><Calculator className="size-4" />Simulação avulsa</Button>
    </div>
    {mode === "registered" && [lotsQuery,weighingsQuery,plansQuery].some(query=>query.isError) && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">Não foi possível carregar os dados do planejamento. <Button variant="outline" onClick={()=>void Promise.all([lotsQuery.refetch(),weighingsQuery.refetch(),plansQuery.refetch()])}>Tentar novamente</Button></div>}
    {mode === "registered" && [lotsQuery,weighingsQuery,plansQuery].some(query=>query.isLoading) ? <PageLoading /> : <>
      <Card><CardHeader className="px-4 pb-3 pt-4 sm:px-5"><CardTitle className="text-lg">Dados do planejamento</CardTitle></CardHeader><CardContent className="space-y-3 px-4 pb-4 sm:px-5">
        {mode === "manual" && <p className="text-xs text-muted-foreground">Informe os dados livremente, sem cadastrar animais ou lotes. A simulação pode ser exportada em PDF ou Excel; ela não é salva na lista de planos.</p>}
        <fieldset disabled={busy} className="grid min-w-0 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>div]:min-w-0 [&_label]:text-xs [&_input]:h-10 [&_button[role=combobox]]:h-10">
          {mode === "registered" ? <SelectField label="Lote" value={lotId} onChange={selectLot} disabled={!canLoad || busy} placeholder="Selecione um lote" options={lots.filter(item=>item.status==="ativo" || plans.some(plan=>plan.lot_id===item.id)).slice().sort((a,b)=>a.code.localeCompare(b.code,"pt-BR",{numeric:true})).map(item=>({value:item.id,labelKey:`${item.code}${item.status!=="ativo" ? " (encerrado)" : ""}`}))} /> : <TextField label="Nome da simulação (opcional)" value={simulationName} onChange={setSimulationName} placeholder="Ex.: Compra de animais" />}
          <TextField label="Início da adaptação" type="date" value={draft.startDate} onChange={value=>field("startDate",value)} />
          {mode === "registered" ? <>
            <PlanningValue label="Animais" value={lotId ? formatNumber(parseNumberInput(draft.headCount), 0) : "—"} unit="cab." />
            <PlanningValue label="Peso médio por animal" value={lotId ? formatNumber(parseNumberInput(draft.averageWeightKg), 2) : "—"} unit="kg" />
          </> : <>
            <NumericField compact label="Animais" unit="cab." inputMode="numeric" value={draft.headCount} onValueChange={value=>field("headCount",value)} placeholder="Quantidade" />
            <NumericField compact label="Peso médio por animal" unit="kg" value={draft.averageWeightKg} onValueChange={value=>field("averageWeightKg",value)} placeholder="Peso médio" />
          </>}
          <NumericField compact label="Custo da ração por kg" unit="R$/kg" value={draft.feedPriceKg} onValueChange={value=>field("feedPriceKg",value)} />
          <NumericField compact label="Custo do volumoso por kg" unit="R$/kg" value={draft.roughagePriceKg} onValueChange={value=>field("roughagePriceKg",value)} />
          <NumericField compact label="Dias totais de confinamento" unit="dias" value={draft.totalDays} onValueChange={value=>field("totalDays",value)} />
          {mode === "registered" && <div className="space-y-1.5"><span className="block text-xs font-medium text-muted-foreground">Dados atuais do lote</span><Button variant="outline" className="h-10 w-full whitespace-normal text-xs" disabled={busy || !lotId || lotsQuery.isFetching || weighingsQuery.isFetching} onClick={()=>void refreshLot()}><RefreshCw className="size-4" />Atualizar dados do lote</Button></div>}
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <p className="min-w-0 flex-1">{costsQuery.isLoading?"Carregando custos salvos da calculadora…":costsQuery.isError||costsQuery.data&&!costDefaults?"Não foi possível usar os custos salvos. Informe os valores nos campos ou revise a calculadora.":costDefaults?`Novos planejamentos usam os custos salvos da calculadora, incluindo frete.${costDefaults.roughagePriceKg===null?" O volumoso ainda não tem custo salvo; informe seu preço por kg.":" Você pode ajustar os valores nesta simulação."}`:"Sem custos salvos na calculadora. Informe os preços por kg ou cadastre os custos da fazenda."}</p>
          {costDefaults&&<Button type="button" variant="outline" className="h-9 text-xs" disabled={busy} onClick={()=>setDraft(current=>({...current,feedPriceKg:costDefaults.feedPriceKg,roughagePriceKg:costDefaults.roughagePriceKg??current.roughagePriceKg}))}><RefreshCw className="size-3.5"/>Usar custos salvos</Button>}
          {isGestor&&<Button variant="link" asChild className="h-9 px-1 text-xs"><Link to="/gestao/financeiro/alimentacao">Calculadora de ração</Link></Button>}
        </div>
        <p className="text-xs text-muted-foreground">Os dias totais de confinamento incluem os 15 dias de adaptação.</p>
        <details className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Como funciona</summary><p className="pt-2 leading-relaxed">Novos planejamentos, com lote ou avulsos, usam os preços por kg salvos na calculadora da fazenda. Sem custo cadastrado, preencha o campo; zero é permitido. Planos salvos conservam seus preços. Use “Usar custos salvos” para atualizar o planejamento aberto; salve as alterações para atualizar o plano. O peso é fixo nesta simulação. Novas pesagens não alteram planos salvos automaticamente. No modo Lote cadastrado, use Atualizar dados do lote para trazer peso e quantidade atuais. Os percentuais são aplicados ao peso vivo, sem projeção de ganho de peso.</p></details>
        {mode === "registered" && <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
          {dirty ? (loadedVersion ? "Alterações ainda não salvas." : "Novo planejamento ainda não salvo.") : (loadedVersion ? "Plano salvo. Nenhuma alteração pendente." : "Selecione um lote para iniciar o planejamento.")}
        </p>}
        {mode === "registered" && lot?.status!=="ativo" && lotId && <p className="text-xs text-muted-foreground">Lote encerrado: consulta e simulação disponíveis; o plano salvo permanece no histórico.</p>}
        {!isGestor && mode === "registered" && <p className="text-xs text-muted-foreground">Você pode consultar e simular. O salvamento é feito por um gestor.</p>}
      </CardContent></Card>

      <Card><CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-lg">Adaptação: 15 dias</CardTitle><Button variant="outline" size="sm" onClick={()=>setDraft(current=>({...current,phases:defaultAdaptationPhases().map(phase=>({feedPct:decimalInput(phase.feedPct),roughagePct:decimalInput(phase.roughagePct)})),postFeedPct:"2,5",postRoughagePct:"0,8"}))}>Restaurar percentuais padrão</Button></div></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{draft.phases.map((phase,index)=><div key={index} className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-semibold">Dias {index*3+1} a {index*3+3}</h3>
          <NumericField compact label="Ração (% PV)" unit="%" value={phase.feedPct} onValueChange={value=>setDraft(current=>({...current,phases:current.phases.map((item,i)=>i===index?{...item,feedPct:value}:item)}))} />
          <NumericField compact label="Volumoso (% PV)" unit="%" value={phase.roughagePct} onValueChange={value=>setDraft(current=>({...current,phases:current.phases.map((item,i)=>i===index?{...item,roughagePct:value}:item)}))} />
          <div className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            <p className="font-medium">kg/animal/dia</p>
            <p>Ração: <span className="font-semibold text-foreground num">{canCalculate && result && input ? formatNumber(result.phases[index].feedDailyKg / input.headCount, 2) : "—"} kg</span></p>
            <p>Volumoso: <span className="font-semibold text-foreground num">{canCalculate && result && input ? formatNumber(result.phases[index].roughageDailyKg / input.headCount, 2) : "—"} kg</span></p>
          </div>
        </div>)}</div>
        <section aria-labelledby="post-adaptation-title" className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1"><h3 id="post-adaptation-title" className="text-sm font-semibold">Após a adaptação</h3><p className="text-xs text-muted-foreground">Percentuais a partir do dia 16 até o fim do planejamento.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 [&_label]:text-xs"><NumericField compact className="[&_span]:shrink-0 [&_span]:whitespace-nowrap" label="Ração após adaptação" unit="% PV" value={draft.postFeedPct} onValueChange={value=>field("postFeedPct",value)} /><NumericField compact className="[&_span]:shrink-0 [&_span]:whitespace-nowrap" label="Volumoso após adaptação" unit="% PV" value={draft.postRoughagePct} onValueChange={value=>field("postRoughagePct",value)} /></div>
        </section>
        <p className="text-xs text-muted-foreground">Os percentuais são aplicados ao peso vivo total: peso médio por animal × quantidade de animais. Não há projeção de ganho de peso dentro deste cálculo.</p>
        {canCalculate && calculation.error && <p role="status" className="rounded-md border border-warning p-3 text-sm">{calculation.error}</p>}
        {!canCalculate && <p className="flex items-center gap-2 rounded-md bg-muted/20 px-3 py-2 text-xs text-muted-foreground"><Sprout className="size-4 shrink-0" />Selecione um lote para calcular o planejamento.</p>}
        {canCalculate && result && <>
          <div className="overflow-x-auto"><DataTable rows={result.phases} columns={phaseColumns} getRowKey={row=>String(row.index)} renderCard={row=><div className="space-y-2 text-sm"><p className="font-semibold">Dias {row.startDay} a {row.endDay} · {formatDate(row.startDate)} a {formatDate(row.endDate)}</p><p>Ração: {formatNumber(row.feedDailyKg,2)} kg/dia · {formatNumber(row.feedPeriodKg,2)} kg no período</p><p>Volumoso: {formatNumber(row.roughageDailyKg,2)} kg/dia · {formatNumber(row.roughagePeriodKg,2)} kg no período</p><p className="font-semibold">{money(row.cost)} no período</p></div>} /></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Ração na adaptação" value={formatNumber(result.adaptationFeedKg,2)} unitKey="kg" />
            <StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Volumoso na adaptação" value={formatNumber(result.adaptationRoughageKg,2)} unitKey="kg" />
            <StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Custo da adaptação (lote)" value={money(result.adaptationCost)} />
            <StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Adaptação por animal" value={money(result.adaptationCostPerHead)} />
          </div>
        </>}
        {canCalculate && result && <section aria-labelledby="post-adaptation-results" className="space-y-3 border-t border-border pt-4"><h3 id="post-adaptation-results" className="text-sm font-semibold">Resultados após a adaptação</h3><p className="text-sm text-muted-foreground">{result.postDays} dias após a adaptação{result.postDays>0?` · ${formatDate(result.postStartDate)} a ${formatDate(result.endDate)}`:""}.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Ração diária do lote" value={formatNumber(result.postFeedDailyKg,2)} unitKey="kg/dia" /><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Volumoso diário do lote" value={formatNumber(result.postRoughageDailyKg,2)} unitKey="kg/dia" /><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Custo diário do lote" value={money(result.postDailyCost)} /><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Custo diário por animal" value={money(result.postDailyCostPerHead)} /></div>
        </section>}
      </CardContent></Card>

      {canCalculate && result && <Card><CardHeader><CardTitle>Simulação do confinamento completo</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{draft.totalDays} dias, de {formatDate(draft.startDate)} a {formatDate(result.endDate)}. Peso vivo total utilizado: {formatNumber(result.totalLiveWeight,2)} kg.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Ração total" value={formatNumber(result.totalFeedKg,2)} unitKey="kg" /><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Volumoso total" value={formatNumber(result.totalRoughageKg,2)} unitKey="kg" /><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Custo total do lote" value={money(result.totalCost)} /><StatCard className="min-w-0 [&_.font-display]:break-all [&_.font-display]:text-2xl" labelKey="Custo total por animal" value={money(result.totalCostPerHead)} /></div>
        <p className="text-xs text-muted-foreground">Planejamento de quantidades e custos. Salvar o plano não registra tratos nem altera a dieta do lote.</p>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Planos salvos por lote</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto"><DataTable rows={savedRows} columns={savedColumns.map(column=>({...column,className:"text-center"}))} getRowKey={row=>row.plan.id} renderCard={row=><div className="space-y-3 text-center"><p className="font-semibold">{row.lot?.code ?? "Lote indisponível"}</p><dl className="grid grid-cols-2 gap-2 text-sm">{savedColumns.filter(column=>column.key!=="lot" && column.key!=="actions").map(column=><div key={column.key} className="min-w-0"><dt className="text-xs text-muted-foreground">{column.headerKey}</dt><dd className="break-words">{column.render(row)}</dd></div>)}</dl>{planActions(row)}</div>} emptyState={<p className="py-6 text-center text-sm text-muted-foreground">Nenhum plano salvo. Escolha um lote, confira os parâmetros e salve o planejamento.</p>} /></div>
      </CardContent></Card>
    </>}
    <AlertDialog open={Boolean(deletingPlan)} onOpenChange={open=>{if (!open && !deletePlan.isPending) setDeletingPlan(null);}}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir plano de adaptação?</AlertDialogTitle><AlertDialogDescription>O plano do lote {lots.find(item=>item.id===deletingPlan?.lot_id)?.code ?? "selecionado"} será excluído. Os animais, dietas e tratos permanecem cadastrados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deletePlan.isPending}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={()=>void remove()}>{deletePlan.isPending ? "Excluindo..." : "Excluir plano"}</Button></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
};
export default Adaptation;
