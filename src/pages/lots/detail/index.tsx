import { lotName } from "@/lib/lot-name";
import { locationName } from "@/lib/location-name";
import "./lot-detail.css";
import { weightHistory } from "@/lib/weight-history";
import { systemLabel } from "@/lib/production-systems";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { WeightKgIcon as Scale } from "@/components/app/weight-kg-icon";
import { LotSystemManager } from "@/components/lots/lot-system-manager";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRightLeft, LogOut, MoreHorizontal, Plus, Beef, CheckCircle2, TrendingUp, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { ExportButtons } from "@/components/app/export-buttons";
import { animalReport } from "@/lib/export-data";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PageLoading } from "@/components/app/page-loading";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { WeightChart, type WeightPoint } from "@/components/app/weight-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnimals } from "@/hooks/use-animals";
import { useFeedLogs } from "@/hooks/use-feed";
import { useHealthEvents } from "@/hooks/use-health";
import { useLots, useUpdateLot } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useWeighings, useWeightRecords } from "@/hooks/use-weighings";
import type { WeightScenario } from "@/lib/constants";
import {
  animalStatusTone,
  computeLotMetrics,
  computeProjection,
  healthEventTone,
  isUnderWithdrawal,
  liveWeightToArroba,
  type Animal,
  type HealthEvent,
  type Lot,
  type Weighing,
} from "@/lib/domain";
import { daysBetween, formatDate, formatInteger, formatNumber, todayIso } from "@/lib/format";
import { ExitDialog } from "./exit-dialog";
import { ProjectionCard } from "./projection-card";
import { TransferDialog } from "./transfer-dialog";

const LotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();

  const [activeTab, setActiveTab] = useState("animals");
  const [transferOpen, setTransferOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [scenario, setScenario] = useState<WeightScenario>("realistic");

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const animalsQuery = useAnimals();
  const weighingsQuery = useWeighings();
  const recordsQuery = useWeightRecords();
  const feedQuery = useFeedLogs();
  const healthQuery = useHealthEvents();
  const updateLot = useUpdateLot();

  const lot = useMemo(
    () => (lotsQuery.data ?? []).find((item) => item.id === id) ?? null,
    [lotsQuery.data, id],
  );

  const weighings = useMemo(
    () => (weighingsQuery.data ?? []).filter((item) => item.lot_id === id),
    [weighingsQuery.data, id],
  );

  const animals = useMemo(
    () => (animalsQuery.data ?? []).filter((item) => item.lot_id === id).sort((a,b) => a.ear_tag.localeCompare(b.ear_tag,"pt-BR",{numeric:true,sensitivity:"base"})),
    [animalsQuery.data, id],
  );

  const healthEvents = useMemo(
    () => (healthQuery.data ?? []).filter((item) => item.lot_id === id),
    [healthQuery.data, id],
  );

  const feedLogs = useMemo(
    () => (feedQuery.data ?? []).filter((item) => item.lot_id === id).slice(0, 8),
    [feedQuery.data, id],
  );

    if (lotsQuery.isLoading) return <PageLoading rows={6} />;

  if (!lot) {
    return (
      <EmptyState
        icon={Beef}
        titleKey="empty.title"
        descriptionKey="empty.description"
        action={
          <Button asChild className="h-10">
            <Link to="/lotes">{t("nav.lots")}</Link>
          </Button>
        }
      />
    );
  }
  const metrics = computeLotMetrics(lot, weighings, today);
  const projection = computeProjection(metrics.currentAvgWeight, metrics.gmd, lot.target_weight_kg, {
    today,
    scenario,
  });

  const penCode = locationName((pensQuery.data ?? []).find((item) => item.id === lot.pen_id));

  const readyAnimals = animals.filter(
    (animal) =>
      animal.status === "ativo" &&
      (animal.current_weight_kg ?? 0) >= lot.target_weight_kg &&
      !isUnderWithdrawal(animal, today),
  );

  const chartPoints: WeightPoint[] = weightHistory(lot, weighings, today);
  const lastPoint = chartPoints[chartPoints.length - 1];
  if (lastPoint) lastPoint.projection = lastPoint.weight;
  const gmdDays = metrics.latestWeighing ? daysBetween(lot.entry_date, metrics.latestWeighing.date) : 0;

  if (projection && projection.days > 0) {
    chartPoints.push({
      date: projection.date,
      weight: null,
      projection: lot.target_weight_kg,
    });
  }

  const closeLot = async () => {
    try {
      await updateLot.mutateAsync({ id: lot.id, status: "encerrado", requestId: crypto.randomUUID() });
      toast.success(t("lots.detail.closed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  const animalColumns: Column<Animal>[] = [
    { key: "tag", headerKey: "field.earTag", render: (row) => row.ear_tag },
    { key: "sisbov", headerKey: "field.sisbov", render: (row) => row.sisbov ?? "—" },
    {
      key: "entry",
      headerKey: "field.entryWeight",
      numeric: true,
      render: (row) => (row.entry_weight_kg ? `${formatNumber(row.entry_weight_kg, 1)} kg` : "—"),
    },
    {
      key: "current",
      headerKey: "field.currentWeight",
      numeric: true,
      render: (row) =>
        row.current_weight_kg ? `${formatNumber(row.current_weight_kg, 1)} kg` : "—",
    },
    {
      key: "arroba",
      headerKey: "field.arroba",
      numeric: true,
      render: (row) => {
        const arroba = liveWeightToArroba(row.current_weight_kg);
        return arroba !== null ? formatNumber(arroba, 1) : "—";
      },
    },
    {
      key: "status",
      headerKey: "field.status",
      render: (row) => (
        <StatusBadge
          tone={animalStatusTone(row.status)}
          label={t(`status.animal.${row.status}`)}
          size="sm"
        />
      ),
    },
  ];

  const weighingColumns: Column<Weighing>[] = [
    { key: "date", headerKey: "field.date", render: (row) => formatDate(row.date) },
    {
      key: "kind",
      headerKey: "field.kind",
      render: (row) => t(`weighings.kind.${row.kind}`),
    },
    {
      key: "head",
      headerKey: "field.headCountWeighed",
      numeric: true,
      render: (row) => formatInteger(row.head_count_weighed),
    },
    {
      key: "avg",
      headerKey: "field.avgWeight",
      numeric: true,
      render: (row) => `${formatNumber(row.avg_weight_kg, 1)} kg`,
    },
    {
      key: "arroba",
      headerKey: "field.arroba",
      numeric: true,
      render: (row) => formatNumber(liveWeightToArroba(row.avg_weight_kg) ?? 0, 1),
    },
  ];

  const healthColumns: Column<HealthEvent>[] = [
    { key: "date", headerKey: "field.eventDate", render: (row) => formatDate(row.event_date) },
    {
      key: "kind",
      headerKey: "field.kind",
      render: (row) => (
        <StatusBadge
          tone={healthEventTone(row.kind)}
          label={t(`status.event.${row.kind}`)}
          size="sm"
        />
      ),
    },
    { key: "product", headerKey: "field.product", render: (row) => row.product ?? "—" },
    { key: "diagnosis", headerKey: "field.diagnosis", render: (row) => row.diagnosis ?? "—" },
    {
      key: "withdrawal",
      headerKey: "field.withdrawalDays",
      numeric: true,
      render: (row) => (row.withdrawal_until ? formatDate(row.withdrawal_until) : "—"),
    },
  ];

  return (
    <div className="lot-detail space-y-4">
      <PageHeader
        titleKey={lotName(lot.code)}
        actions={
          <>
            <Button variant="outline" className="h-10" onClick={() => navigate("/lotes")}>
              <ArrowLeft />
              {t("action.back")}
            </Button>
            <Button asChild className="h-10"><Link to="/pesagens/nova"><Plus />Registrar pesagem</Link></Button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="h-10"><MoreHorizontal />Ações do lote</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setTransferOpen(true)}><ArrowRightLeft className="mr-2 size-4" />{t("action.transfer")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setExitOpen(true)}><LogOut className="mr-2 size-4" />{t("action.registerExit")}</DropdownMenuItem>
                {lot.status === "ativo" ? <><DropdownMenuSeparator /><DropdownMenuItem disabled={updateLot.isPending} onSelect={() => void closeLot()}><CheckCircle2 className="mr-2 size-4" />{t("lots.detail.close")}</DropdownMenuItem></> : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <TransferDialog lot={lot} open={transferOpen} onOpenChange={setTransferOpen} hideTrigger />
      <ExitDialog lot={lot} readyHead={readyAnimals.length} open={exitOpen} onOpenChange={setExitOpen} hideTrigger />
      <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          tone={lot.status === "ativo" ? "success" : "muted"}
          label={t(`status.lot.${lot.status}`)}
        />
        <span className="text-sm text-muted-foreground">
          {penCode} · Manejo: {systemLabel(lot.production_system)} · Entrada em {formatDate(lot.entry_date)}
          {lot.origin?.trim() ? ` · Origem: ${lot.origin}` : ""}
        </span>
      </div>

      <LotSystemManager lot={lot} compact />
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          className="lot-detail-metric"
          labelKey="field.animalCount"
          value={formatInteger(lot.head_count)}
          unitKey="common.unit.head"
          icon={Beef}
          note={`${animals.length} ${t("common.individualRecords")}`}
        />
        <StatCard
          className="lot-detail-metric"
          labelKey="field.entryWeight"
          value={formatNumber(lot.entry_avg_weight_kg, 1)}
          unitKey="common.unit.kg"
          icon={Scale}
        />
        <StatCard
          className="lot-detail-metric"
          labelKey="Último peso médio registrado"
          value={metrics.currentAvgWeight ? formatNumber(metrics.currentAvgWeight, 1) : "—"}
          unitKey="common.unit.kg"
          icon={Scale}
          note={metrics.latestWeighing ? `Pesagem de ${formatDate(metrics.latestWeighing.date)}` : `Peso de entrada · ${formatDate(lot.entry_date)}` }
        />
        <Tooltip><TooltipTrigger asChild><div tabIndex={0} className="h-full rounded-xl outline-offset-2 focus-visible:outline focus-visible:outline-ring">
        <StatCard
          className="lot-detail-metric"
          labelKey="GMD observado"
          value={metrics.gmd !== null ? formatNumber(metrics.gmd, 2) : "—"}
          unitKey="common.unit.kgPerDay"
          icon={TrendingUp}
          note={
            metrics.totalGain !== null
              ? `${t("lots.detail.gainTotal")}: ${formatNumber(metrics.totalGain, 1)} kg`
              : undefined
          }
        />
        </div></TooltipTrigger><TooltipContent className="max-w-xs">{gmdDays > 0 ? `GMD observado desde a entrada até a última pesagem, em ${gmdDays} dias.` : "Aguardando pesagem posterior à entrada para calcular."}</TooltipContent></Tooltip>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <ProjectionCard key={`${lot.id}:${lot.target_weight_kg}`}
            gmdDays={gmdDays}
            targetWeight={lot.target_weight_kg}
            metrics={metrics}
            scenario={scenario}
            onScenarioChange={setScenario}
            saving={updateLot.isPending}
            onTargetChange={(weight) => {
              void updateLot.mutateAsync({ id: lot.id, target_weight_kg: weight, requestId: crypto.randomUUID() }).catch((error) => toast.error(error instanceof Error ? error.message : t("toast.error.generic")));
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">
            {t("lots.detail.weightEvolution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WeightChart points={chartPoints} target={lot.target_weight_kg} />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <TabsList className="h-auto min-h-10 flex-wrap justify-start">
          <TabsTrigger value="animals">{t("lots.detail.animals")}</TabsTrigger>
          <TabsTrigger value="weighings">{t("lots.detail.weighings")}</TabsTrigger>
          <TabsTrigger value="health">{t("animals.detail.health")}</TabsTrigger>
          <TabsTrigger value="feed">{t("lots.detail.feed")}</TabsTrigger>
        </TabsList>
        {activeTab === "animals" ? (
            <ExportButtons
              disabled={[animalsQuery, lotsQuery, pensQuery, weighingsQuery, recordsQuery].some(query => query.isFetching || query.isPending || query.isError) || !animals.length}
              getReport={() => animalReport(animals, lotsQuery.data ?? [], pensQuery.data ?? [], weighingsQuery.data ?? [], recordsQuery.data ?? [], key => t(key), `Lote: ${lot.code} | Todos os animais vinculados`, today)}
            />
        ) : null}
        </div>

        <TabsContent value="animals" className="mt-2 space-y-2 pt-0">

          <DataTable
            rows={animals}
            columns={animalColumns.map(column => ({...column,className:"text-center"}))}
            getRowKey={(row) => row.id}
            emptyState={
              <EmptyState icon={Beef} titleKey="lots.detail.noAnimals" />
            }
          />
        </TabsContent>

        <TabsContent value="weighings" className="mt-2 pt-0">
          <DataTable
            rows={weighings}
            columns={weighingColumns.map(column => ({...column,className:"text-center"}))}
            getRowKey={(row) => row.id}
            emptyState={<EmptyState icon={Scale} titleKey="weighings.empty.title" descriptionKey="weighings.empty.description" />}
          />
        </TabsContent>

        <TabsContent value="health" className="mt-2 pt-0">
          <DataTable
            rows={healthEvents}
            columns={healthColumns.map(column => ({...column,className:"text-center"}))}
            getRowKey={(row) => row.id}
            emptyState={<EmptyState titleKey="animals.detail.noEvents" />}
          />
        </TabsContent>

        <TabsContent value="feed" className="mt-2 pt-0">
          {feedLogs.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              titleKey="feed.empty.title"
              descriptionKey="feed.empty.description"
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {feedLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="num">{formatDate(log.date)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`feed.shift.${log.shift}`)}
                    </span>
                  </span>
                  <span className="num text-muted-foreground">
                    {formatNumber(log.kg_per_head, 2)} kg/cab · {formatNumber(log.total_kg, 0)} kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LotDetail;
