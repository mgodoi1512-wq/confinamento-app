import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Beef,
  CalendarClock,
  ClipboardCheck,
  Scale,
  Target,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { OccupancyBar } from "@/components/app/occupancy-bar";
import { PageHeader } from "@/components/app/page-header";
import { PageLoading } from "@/components/app/page-loading";
import { StatCard } from "@/components/app/stat-card";
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

const Dashboard = () => {
  const { t } = useTranslation();
  const today = todayIso();

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
  const penPageCount = Math.max(1, Math.ceil(occupancy.length / 10));
  const currentPenPage = Math.min(penPage, penPageCount);
  const visibleOccupancy = occupancy.slice((currentPenPage - 1) * 10, currentPenPage * 10);


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
  }, [occupancy, feedLogs, troughReadings, activeLots, weighings, today, summary.readyForSlaughter]);

  const feedStates = occupancy.map(item => feeding.forPen(item.pen.id)).filter(state => state !== null);
  const feedingSummary = summarizeDashboardFeeding(feedStates);
  const recentFeed = useMemo(
    () => recentDashboardFeed(feedLogs, today),
    [feedLogs, today],
  );

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
      headerKey: "field.currentWeight",
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
          "—"
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
      headerKey: "lots.detail.projectionDate",
      render: (row) =>
        row.projection ? (
          <div className="flex items-center gap-2">
            <span className="num">{formatDate(row.projection.date)}</span>
            {row.projection.ready ? (
              <StatusBadge tone="primary" label={t("status.ready")} size="sm" />
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  if (loading) return <PageLoading rows={6} />;

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        titleKey="dashboard.title"
        subtitleKey="dashboard.subtitle"
        actions={
          <>
            <Button asChild variant="outline" className="h-10">
              <Link to="/lotes/novo">
                <Beef />
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
                <ClipboardCheck />
                {t("action.startRound")}
              </Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          labelKey="dashboard.kpi.confined"
          value={formatInteger(summary.confinedHead)}
          unitKey="common.unit.head"
          icon={Beef}
          variant="brand"
          note={t("dashboard.kpi.note.confined", { lots: summary.activeLots })}
        />
        <StatCard
          labelKey="dashboard.kpi.gmd"
          value={summary.avgGmd !== null ? formatNumber(summary.avgGmd, 2) : "—"}
          unitKey="common.unit.kgPerDay"
          icon={TrendingUp}
          note={t("dashboard.kpi.note.gmd")}
        />
        <StatCard
          labelKey="dashboard.kpi.daysOnFeed"
          value={summary.avgDaysOnFeed !== null ? formatNumber(summary.avgDaysOnFeed, 0) : "—"}
          unitKey="common.unit.days"
          icon={CalendarClock}
          note={t("dashboard.kpi.note.daysOnFeed")}
        />
        <StatCard
          labelKey="dashboard.kpi.mortality"
          value={summary.mortalityRate !== null ? formatNumber(summary.mortalityRate, 2) : "—"}
          unitKey="common.unit.percent"
          icon={AlertTriangle}
          note={t("dashboard.kpi.note.mortality", { deaths: summary.deaths })}
        />
        <StatCard
          labelKey="dashboard.kpi.avgWeight"
          value={summary.avgWeight !== null ? formatNumber(summary.avgWeight, 1) : "—"}
          unitKey="common.unit.kg"
          icon={Scale}
          variant="agro"
          note={
            summary.avgArroba !== null
              ? t("dashboard.kpi.note.avgWeight", { arroba: formatNumber(summary.avgArroba, 2) })
              : undefined
          }
        />
        <StatCard
          labelKey="dashboard.kpi.occupancy"
          value={formatNumber(summary.occupancyPercent, 0)}
          unitKey="common.unit.percent"
          icon={Target}
          note={`${formatInteger(summary.confinedHead)} / ${formatInteger(summary.capacity)}`}
        />
        <StatCard
          labelKey="dashboard.kpi.activeLots"
          value={formatInteger(summary.activeLots)}
          icon={Beef}
          note={`${formatInteger(summary.totalLots)} ${t("common.allLots").toLowerCase()}`}
        />
        <StatCard
          labelKey="dashboard.today.health"
          value={formatInteger(summary.inTreatment)}
          unitKey="common.unit.head"
          icon={AlertTriangle}
          note={t("dashboard.readySlaughter") + ": " + formatInteger(summary.readyForSlaughter)}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        {/* Ocupação */}
        <Card className="min-w-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="font-display text-lg">
              {t("dashboard.occupancy.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {occupancy.length === 0 ? (
              <EmptyState titleKey="pens.empty.title" descriptionKey="pens.empty.description" />
            ) : (
              visibleOccupancy.map((item) => (
                <div key={item.pen.id} className="space-y-1.5">
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
                  <OccupancyBar percent={item.percent} overCapacity={item.overCapacity} />
                </div>
              ))
            )}
            {occupancy.length > 10 ? <nav aria-label="Paginação da ocupação por curral" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground" aria-live="polite">Mostrando {(currentPenPage - 1) * 10 + 1} a {Math.min(currentPenPage * 10, occupancy.length)} de {occupancy.length} currais</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={currentPenPage === 1} onClick={() => setPenPage(currentPenPage - 1)}>Anterior</Button>
                <span className="whitespace-nowrap text-xs">Página {currentPenPage} de {penPageCount}</span>
                <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={currentPenPage === penPageCount} onClick={() => setPenPage(currentPenPage + 1)}>Próxima</Button>
              </div>
            </nav> : null}
          </CardContent>
        </Card>

      {/* Trato de hoje */}
      <Card className="min-w-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="font-display text-lg">{t("dashboard.recent.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {recentFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.recent.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentFeed.map((log) => (
                <li key={log.id} className="space-y-1 py-2 text-sm">
                  <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="font-display font-semibold">
                      {pens.find((pen) => pen.id === log.pen_id)?.code ?? "—"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t(`feed.shift.${log.shift}`)}
                    </span>
                  </span>
                  <span className="block text-xs num text-muted-foreground">
                    {formatNumber(log.kg_per_head, 2)} kg/cab ·{" "}
                    {formatNumber(log.total_kg, 2)} kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

        {/* Pendências */}
        <Card className="min-w-0 bg-surface">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="font-display text-lg">{t("dashboard.today.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="size-4 text-muted-foreground" />
                {t("dashboard.today.reading")}
              </span>
              <span className="text-sm num font-semibold">
                {t("dashboard.today.readingValue", { done: pendencies.read, total: pendencies.total })}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <UtensilsCrossed className="size-4 text-muted-foreground" />
                Trato iniciado
              </span>
              <span className="text-sm num font-semibold">
                {feeding.ready ? `${feedingSummary.started} de ${feedingSummary.total} locais` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="size-4 text-muted-foreground" />Trato concluído
              </span>
              <span className="text-sm num font-semibold">{feeding.ready ? `${feedingSummary.completed} de ${feedingSummary.total} locais` : "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground">Iniciado: houve fornecimento. Concluído: todos os períodos previstos foram registrados. Locais sem suplementação prevista ficam fora desta contagem.</p>
            {feeding.error && <p role="alert" className="text-xs text-destructive">Não foi possível conferir os tratos. Recarregue a página.</p>}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Scale className="size-4 text-muted-foreground" />
                {t("dashboard.today.weighing")}
              </span>
              <span className="text-sm num font-semibold">
                {t("dashboard.today.weighingValue", { count: pendencies.withoutWeighing })}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-muted-foreground" />
                {t("dashboard.alerts.treatment", {
  count: summary.inTreatment,
})}
              </span>
              <span className="text-sm num font-semibold">
                {formatInteger(summary.inTreatment)}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {summary.underWithdrawal > 0 || summary.inTreatment > 0 ? (
                <>
                  {summary.underWithdrawal > 0 ? (
                    <p className="flex items-center gap-2 text-xs text-agro">
                      <span className="size-1.5 rounded-full bg-agro" />
                      {t("dashboard.alerts.carencia", { count: summary.underWithdrawal })}
                    </p>
                  ) : null}
                  {summary.inTreatment > 0 ? (
                    <p className="flex items-center gap-2 text-xs text-warning">
                      <span className="size-1.5 rounded-full bg-warning" />
                      {t("dashboard.alerts.treatment", { count: summary.inTreatment })}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t("dashboard.alerts.none")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desempenho dos lotes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("dashboard.lots.title")}</h2>
          
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
