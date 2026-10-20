import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WeightKgIcon } from "@/components/app/weight-kg-icon";
import { DashboardFinance } from "@/components/app/dashboard-finance";
import "./dashboard.css";
import "@/components/app/feed-shift.css";
import { useAuth } from "@/hooks/use-auth";
import { useFinancialWorkspace } from "@/hooks/use-financial-workspace";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  Plus,
  Play,
  ChartPie,
  Heart,
  createLucideIcon,
  Moon,
  Sun,
  Sunrise,
  Clock3,
  BarChart3,
  MapPin,
  Wheat,
  Beef,
  CalendarClock,
  ClipboardCheck,
  TrendingUp,
} from "lucide-react";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { OccupancyBar } from "@/components/app/occupancy-bar";
import { PageHeader } from "@/components/app/page-header";
import { PageLoading } from "@/components/app/page-loading";
import type { LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnimals } from "@/hooks/use-animals";
import { useFeedLogs } from "@/hooks/use-feed";
import { usePenFeeding } from "@/hooks/use-pen-feeding";
import { recentDashboardFeed, summarizeDashboardFeeding } from "@/lib/dashboard-feeding";
import { useHealthEvents } from "@/hooks/use-health";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useTroughReadings } from "@/hooks/use-trough";
import { useWeighings } from "@/hooks/use-weighings";
import {
  computeHerdSummary,
  computeLotMetrics,
  computePenOccupancy,
  computeProjection,
  lotsWithoutRecentWeighing,
  type Lot,
} from "@/lib/domain";
import { formatDate, formatInteger, formatNumber, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

const CattleIcon=createLucideIcon("Cattle",[
  ["path",{d:"M7 8C3 8 2 5 3 2c1 3 3 3 5 3M17 8c4 0 5-3 4-6-1 3-3 3-5 3",key:"horns"}],
  ["path",{d:"M7 8 3 7 2 10l5 2M17 8l4-1 1 3-5 2M7 7c2-3 8-3 10 0v8c0 4-2 7-5 7s-5-3-5-7Z",key:"head"}],
  ["ellipse",{cx:"12",cy:"18",rx:"4",ry:"3",key:"muzzle"}],
  ["path",{d:"M9 10h.01M15 10h.01M10.5 18h.01M13.5 18h.01",key:"eyes"}],
]);
type MetricProps={labelKey:string;value:string;unitKey?:string;icon?:LucideIcon;note?:string;variant?:"brand";largeIcon?:boolean};
const DashboardMetric=({labelKey,value,unitKey,icon:Icon,note,variant,largeIcon}:MetricProps)=>{const{t}=useTranslation();return <div className={cn("dashboard-metric",variant==="brand"&&"is-brand")}>
  {Icon&&<span className={cn("dashboard-icon",largeIcon&&"is-large")}><Icon aria-hidden="true"/></span>}
  <div className="dashboard-metric-copy"><p className="dashboard-metric-label">{t(labelKey)}</p><div className="dashboard-metric-number"><strong>{value}</strong>{unitKey&&<span>{t(unitKey)}</span>}</div>{note&&<p className="dashboard-metric-note">{note}</p>}</div>
</div>;};

const Dashboard = () => {
  const { t } = useTranslation();
  const today = todayIso();
  const {isGestor}=useAuth();
  const stock=useFinancialWorkspace();
  const lowStock=(stock.data?.items??[]).filter(item=>item.category==="ingrediente"&&item.quantity_kg<=item.minimum_kg);

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const animalsQuery = useAnimals();
  const weighingsQuery = useWeighings();
  const feedQuery = useFeedLogs();
  const troughQuery = useTroughReadings();
  const healthQuery = useHealthEvents();
  const feeding = usePenFeeding();

  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const animals = useMemo(() => animalsQuery.data ?? [], [animalsQuery.data]);
  const weighings = useMemo(() => weighingsQuery.data ?? [], [weighingsQuery.data]);
  const feedLogs = useMemo(() => feedQuery.data ?? [], [feedQuery.data]);
  const troughReadings = useMemo(() => troughQuery.data ?? [], [troughQuery.data]);
  const healthEvents = useMemo(() => healthQuery.data ?? [], [healthQuery.data]);

  const loading =
    lotsQuery.isLoading || pensQuery.isLoading || animalsQuery.isLoading || weighingsQuery.isLoading;

  const activeLots = useMemo(() => lots.filter((lot) => lot.status === "ativo"), [lots]);

  const summary = useMemo(
    () => computeHerdSummary(lots, animals, weighings, pens, healthEvents, today),
    [lots, animals, weighings, pens, healthEvents, today],
  );

  const occupancy = useMemo(() => computePenOccupancy(pens, lots), [pens, lots]);
  const [penPage, setPenPage] = useState(1);
  const penPageCount = Math.max(1, Math.ceil(occupancy.length / 5));
  const currentPenPage = Math.min(penPage, penPageCount);
  const visibleOccupancy = occupancy.slice((currentPenPage - 1) * 5, currentPenPage * 5);


  const lotRows = useMemo(
    () =>
      activeLots.map((lot) => {
        const metrics = computeLotMetrics(lot, weighings, today);
        return {
          lot,
          metrics,
          projection: computeProjection(
            metrics.currentAvgWeight,
            metrics.gmd,
            lot.target_weight_kg,
            { today },
          ),
        };
      }),
    [activeLots, weighings, today],
  );

  const pendencies = useMemo(() => {
    const pensWithLot = occupancy.filter((item) => item.lot);
    const readToday = new Set(
      troughReadings.filter((reading) => reading.date === today).map((reading) => reading.pen_id),
    );

    return {
      total: pensWithLot.length,
      read: pensWithLot.filter((item) => readToday.has(item.pen.id)).length,
      withoutWeighing: lotsWithoutRecentWeighing(activeLots, weighings, today).length,
      ready: summary.readyForSlaughter,
    };
  }, [occupancy, troughReadings, activeLots, weighings, today, summary.readyForSlaughter]);

  const feedStates = occupancy.map(item => feeding.forPen(item.pen.id)).filter(state => state !== null);
  const feedingSummary = summarizeDashboardFeeding(feedStates);
  const recentFeed = useMemo(
    () => recentDashboardFeed(feedLogs, today, 5),
    [feedLogs, today],
  );

  const missingMetric=(reason:string)=><Tooltip><TooltipTrigger asChild><button type="button" className="rounded px-2 py-1 text-muted-foreground underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={reason}>—</button></TooltipTrigger><TooltipContent className="max-w-72">{reason}</TooltipContent></Tooltip>;
  const noProjectionReason=(row:(typeof lotRows)[number])=>!row.metrics.currentAvgWeight||!row.lot.target_weight_kg?"Informe o peso médio e o peso-alvo para estimar o abate.":row.metrics.gmd===null?"Aguardando pesagens suficientes para calcular a previsão de abate.":row.metrics.gmd<=0?"O GMD precisa ser positivo para estimar quando o peso-alvo será atingido.":"Não foi possível calcular a previsão com os dados disponíveis.";
  const columns: Column<(typeof lotRows)[number]>[] = [
    {
      key: "lot",
      headerKey: "field.lot",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{row.lot.code}</p>
          <p className="truncate text-xs text-muted-foreground">
            {pens.find((pen) => pen.id === row.lot.pen_id)?.code ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "head",
      headerKey: "field.animalCount",
      numeric: true,
      render: (row) => formatInteger(row.lot.head_count),
    },
    {
      key: "weight",
      headerKey: "Último peso médio",
      numeric: true,
      render: (row) =>
        row.metrics.currentAvgWeight
          ? `${formatNumber(row.metrics.currentAvgWeight, 1)} kg`
          : "—",
    },
    {
      key: "gmd",
      headerKey: "field.gmd",
      numeric: true,
      render: (row) =>
        row.metrics.gmd !== null ? (
          <span className={cn(row.metrics.gmd > 0 ? "text-success" : "text-destructive")}>
            {formatNumber(row.metrics.gmd, 2)}
          </span>
        ) : (
          missingMetric("Aguardando pesagens suficientes para calcular")
        ),
    },
    {
      key: "days",
      headerKey: "field.daysOnFeed",
      numeric: true,
      render: (row) => formatInteger(row.metrics.daysOnFeed),
    },
    {
      key: "projection",
      headerKey: "Previsão de abate",
      render: (row) =>
        row.projection ? (
          <div className="flex items-center justify-center gap-2">
            <span className="num">{formatDate(row.projection.date)}</span>
            {row.projection.ready ? (
              <StatusBadge tone="primary" label={t("status.ready")} size="sm" />
            ) : null}
          </div>
        ) : (
          missingMetric(noProjectionReason(row))
        ),
    },
  ];

  if (loading) return <PageLoading rows={6} />;

  return (
    <div className="farm-dashboard space-y-5 md:space-y-6">
      <PageHeader
        titleKey="dashboard.title"
        subtitleKey="Seu rebanho e as prioridades de hoje"
        actions={
          <>
            <Button asChild variant="outline" className="h-10 w-40">
              <Link to="/lotes/novo">
                <Plus />
                {t("lots.new")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10">
              <Link to="/gestao/mercado">
                <TrendingUp />
                Acompanhar Mercado
              </Link>
            </Button>
            <Button asChild className="h-10">
              <Link to="/trato/leitura">
                <Play />
                {t("action.startRound")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="dashboard-primary grid grid-cols-2 gap-3 lg:grid-cols-4">
<DashboardMetric
          labelKey="Animais presentes"
          value={formatInteger(summary.confinedHead)}
          unitKey="cabeças"
          icon={CattleIcon}
          largeIcon
          variant="brand"
          note={t("dashboard.kpi.note.confined", { lots: summary.activeLots })}
        />
<DashboardMetric
          labelKey="Peso médio"
          value={summary.avgWeight !== null ? formatNumber(summary.avgWeight, 1) : "—"}
          unitKey="common.unit.kg"
          icon={WeightKgIcon}

        />
<DashboardMetric
          labelKey="dashboard.kpi.gmd"
          value={summary.avgGmd !== null ? formatNumber(summary.avgGmd, 2) : "—"}
          unitKey="common.unit.kgPerDay"
          icon={TrendingUp}
          note={summary.avgGmd===null?"Aguardando nova pesagem":t("dashboard.kpi.note.gmd")}
        />
<DashboardMetric
          labelKey="dashboard.kpi.activeLots"
          value={formatInteger(summary.activeLots)}
          icon={Beef}
          note={`${formatInteger(summary.totalLots)} lotes cadastrados`}
        />
</div>
<div className="dashboard-secondary grid grid-cols-2 gap-3 lg:grid-cols-4">
<DashboardMetric
          labelKey="Ocupação"
          value={formatNumber(summary.occupancyPercent, 0)}
          unitKey="common.unit.percent"
          icon={ChartPie}
          note={`${formatInteger(summary.confinedHead)} / ${formatInteger(summary.capacity)}`}
        />
<DashboardMetric
          labelKey="Tempo médio no lote"
          value={summary.avgDaysOnFeed !== null ? formatNumber(summary.avgDaysOnFeed, 0) : "—"}
          unitKey={summary.avgDaysOnFeed!==null&&Math.round(summary.avgDaysOnFeed)===1?"dia":"common.unit.days"}
          icon={CalendarClock}
          note={t("dashboard.kpi.note.daysOnFeed")}
        />
<DashboardMetric
          labelKey="Em tratamento"
          value={formatInteger(summary.inTreatment)}
          unitKey="common.unit.head"
          icon={Heart}
          note={summary.underWithdrawal?`${summary.underWithdrawal} em carência`:undefined}
        />
<DashboardMetric
          labelKey="Mortalidade"
          value={summary.mortalityRate !== null ? formatNumber(summary.mortalityRate, 2) : "—"}
          unitKey="common.unit.percent"
          icon={AlertTriangle}
          note={t("dashboard.kpi.note.mortality", { deaths: summary.deaths })}
        />
</div>

      {isGestor && <DashboardFinance data={stock.data} loading={stock.isLoading} error={stock.isError} retry={()=>void stock.refetch()} today={today}/>}

      <div className="dashboard-operations grid min-w-0 items-stretch gap-4 xl:grid-cols-3">
        {/* Ocupação */}
        <Card className="dashboard-panel dashboard-occupancy min-w-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="font-display text-lg">
              <MapPin className="size-6" aria-hidden="true"/>{t("dashboard.occupancy.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="dashboard-occupancy-content p-4 pt-0">
            {occupancy.length === 0 ? (
              <EmptyState titleKey="pens.empty.title" descriptionKey="pens.empty.description" />
            ) : (
              visibleOccupancy.map((item) => (
                <div key={item.pen.id} className="dashboard-occupancy-row">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-display font-semibold">{item.pen.code}</span>
                      {item.lot ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.lot.code}
                        </span>
                      ) : (
                        <span className="truncate text-xs text-muted-foreground">
                          {t("pens.noLot")}
                        </span>
                      )}
                      {item.overCapacity ? (
                        <StatusBadge tone="destructive" label={t("status.overCapacity")} size="sm" />
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs num text-muted-foreground">
                      {t("pens.occupancy", {
                        head: formatInteger(item.head),
                        capacity: formatInteger(item.capacity),
                      })}
                    </span>
                  </div>
                  <OccupancyBar className="h-3" percent={item.percent} overCapacity={item.overCapacity} />
                </div>
              ))
            )}
            {occupancy.length > 5 ? <nav aria-label="Paginação da ocupação por curral" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground" aria-live="polite">Mostrando {(currentPenPage - 1) * 5 + 1} a {Math.min(currentPenPage * 5, occupancy.length)} de {occupancy.length} currais</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={currentPenPage === 1} onClick={() => setPenPage(currentPenPage - 1)}>Anterior</Button>
                <span className="whitespace-nowrap text-xs">Página {currentPenPage} de {penPageCount}</span>
                <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={currentPenPage === penPageCount} onClick={() => setPenPage(currentPenPage + 1)}>Próxima</Button>
              </div>
            </nav> : null}
          </CardContent>
        </Card>


      {/* Trato de hoje */}
      <Card className="dashboard-panel min-w-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="font-display text-lg"><Wheat className="size-6" aria-hidden="true"/>Últimos tratos</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {recentFeed.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t("dashboard.recent.empty")}</p>
          ) : (
            <ul className="dashboard-feed-list">
              {recentFeed.map((log) => (
                <li key={log.id} className="dashboard-feed-row">
                  <strong className="truncate" title={pens.find(pen=>pen.id===log.pen_id)?.code}>{pens.find(pen=>pen.id===log.pen_id)?.code??"—"}</strong>
                  <span className={cn("dashboard-period",log.shift==="noite"?"is-night":log.shift==="manha"?"is-morning":"is-afternoon")}>{log.shift==="noite"?<Moon className="size-4" aria-hidden="true"/>:log.shift==="manha"?<Sunrise className="size-4" aria-hidden="true"/>:<Sun className="size-4" aria-hidden="true"/>}{t(`feed.shift.${log.shift}`)}</span>
                  <span className="dashboard-feed-quantity" title={`${formatNumber(log.kg_per_head,2)} kg por animal`}>{formatNumber(log.total_kg,2)} kg</span>
                  <time dateTime={log.created_at} className="dashboard-feed-time"><Clock3 className="size-4"/>Hoje, {new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"}).format(new Date(log.created_at))}</time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

        <Card className="dashboard-panel min-w-0"><CardHeader className="p-4 pb-3"><CardTitle className="font-display text-lg"><ClipboardCheck className="size-6" aria-hidden="true"/>Rotina de hoje</CardTitle></CardHeader><CardContent className="space-y-3 p-4 pt-0">
          {[
            {label:"Leitura de cocho",value:troughQuery.isSuccess?`${pendencies.read} de ${pendencies.total}`:"—",done:troughQuery.isSuccess&&pendencies.total>0&&pendencies.read===pendencies.total,to:"/trato/leitura"},
            {label:"Tratos concluídos",value:feeding.ready?`${feedingSummary.completed} de ${feedingSummary.total}`:"—",done:feeding.ready&&feedingSummary.total>0&&feedingSummary.completed===feedingSummary.total,to:"/trato"},
            ...(pendencies.withoutWeighing>0?[{label:"Lotes sem pesagem há 30 dias",value:String(pendencies.withoutWeighing),done:false,to:"/pesagens"}]:[]),
            {label:summary.inTreatment||summary.underWithdrawal?"Animais em atenção":"Sem alertas sanitários",value:summary.inTreatment||summary.underWithdrawal?`${summary.inTreatment} em tratamento · ${summary.underWithdrawal} em carência`:"",done:summary.inTreatment===0&&summary.underWithdrawal===0&&animalsQuery.isSuccess,to:"/sanidade/tratamentos"},
          ].map(item=><Link key={item.label} to={item.to} className={cn("dashboard-routine flex items-center gap-3 rounded-lg border p-3 text-sm",item.done?"is-done":"is-pending")}>
            {item.done?<Check className="size-5 shrink-0"/>:<AlertTriangle className="size-5 shrink-0"/>}<span className="min-w-0 flex-1">{item.label}</span><span className="text-right text-xs font-semibold tabular-nums">{item.value}</span>
          </Link>)}
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Como funciona a rotina?</summary><p className="mt-2">Trato iniciado: {feeding.ready?`${feedingSummary.started} de ${feedingSummary.total} locais`:"aguardando dados"}. Concluído: todos os períodos previstos registrados; não significa atingir o peso recomendado. Locais sem suplementação prevista não entram na contagem.</p></details>
          {(feeding.error||troughQuery.isError||animalsQuery.isError)&&<p role="alert" className="text-xs text-destructive">Não foi possível conferir todos os dados. Recarregue a página.</p>}
        </CardContent></Card>
      </div>

      {isGestor && ((stock.isSuccess && lowStock.length > 0) || stock.isError) && <div className="space-y-2">
        {isGestor&&stock.isSuccess&&lowStock.length>0&&<Link to="/gestao/financeiro/estoque?aba=insumos&categoria=ingrediente" className="dashboard-stock block rounded-xl border p-4"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5"/>Estoque em atenção</div><p className="mt-1 text-sm">{lowStock.length} ingrediente(s) no mínimo ou abaixo: {lowStock.slice(0,3).map(item=>item.name).join(", ")}{lowStock.length>3?"…":""}</p><p className="mt-2 text-sm font-semibold">Ver estoque →</p></Link>}
        {isGestor&&stock.isError&&<p role="alert" className="text-xs text-destructive">Não foi possível conferir os alertas de estoque.</p>}
      </div>}

      {/* Desempenho dos lotes */}
      <div className="dashboard-performance space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold"><BarChart3 className="size-6" aria-hidden="true"/>{t("dashboard.lots.title")}</h2>

        </div>
        <DataTable
          rows={lotRows}
          columns={columns.map(column => ({...column, className: "text-center"}))}
          getRowKey={(row) => row.lot.id}
          emptyState={
            <EmptyState
              icon={Beef}
              titleKey="lots.empty.title"
              descriptionKey="lots.empty.description"
              action={
                <Button asChild className="h-10">
                  <Link to="/lotes/novo">{t("lots.new")}</Link>
                </Button>
              }
            />
          }
        />
      </div>


    </div>
  );
};

export default Dashboard;
