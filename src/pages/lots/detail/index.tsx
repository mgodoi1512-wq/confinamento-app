import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Beef, CheckCircle2, Scale, TrendingUp, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

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
import { useWeighings } from "@/hooks/use-weighings";
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
import { formatDate, formatInteger, formatNumber, todayIso } from "@/lib/format";
import { ExitDialog } from "./exit-dialog";
import { ProjectionCard } from "./projection-card";
import { TransferDialog } from "./transfer-dialog";

const LotDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();

  const [scenario, setScenario] = useState<WeightScenario>("realistic");

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const animalsQuery = useAnimals();
  const weighingsQuery = useWeighings();
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
    () => (animalsQuery.data ?? []).filter((item) => item.lot_id === id),
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
const pen = lot
  ? (pensQuery.data ?? []).find(
      (item) => item.id === lot.pen_id
    )
  : null;
  const metrics = computeLotMetrics(lot, weighings, today);
  const projection = computeProjection(metrics.currentAvgWeight, metrics.gmd, lot.target_weight_kg, {
    today,
    scenario,
  });

  const penCode = (pensQuery.data ?? []).find((item) => item.id === lot.pen_id)?.code ?? "—";

  const readyAnimals = animals.filter(
    (animal) =>
      animal.status === "ativo" &&
      (animal.current_weight_kg ?? 0) >= lot.target_weight_kg &&
      !isUnderWithdrawal(animal, today),
  );

  const ordered = [...weighings].sort((a, b) => (a.date < b.date ? -1 : 1));
  const chartPoints: WeightPoint[] = ordered.map((weighing) => ({
    date: weighing.date,
    weight: weighing.avg_weight_kg,
    projection: weighing.id === ordered[ordered.length - 1]?.id ? weighing.avg_weight_kg : null,
  }));

  if (projection && projection.days > 0) {
    chartPoints.push({
      date: projection.date,
      weight: null,
      projection: lot.target_weight_kg,
    });
  }

  const closeLot = async () => {
    try {
      await updateLot.mutateAsync({ id: lot.id, status: "encerrado" });
      toast.success(t("lots.detail.closed"));
    } catch {
      toast.error(t("toast.error.generic"));
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
    <div className="space-y-5">
      <PageHeader
        titleKey="lots.detail.title"
        actions={
          <>
            <Button variant="outline" className="h-10" onClick={() => navigate("/lotes")}>
              <ArrowLeft />
              {t("action.back")}
            </Button>
            <TransferDialog lot={lot} />
            <ExitDialog lot={lot} readyHead={readyAnimals.length || lot.head_count} />
            {lot.status === "ativo" ? (
              <Button variant="secondary" className="h-10" onClick={() => void closeLot()}>
                <CheckCircle2 />
                {t("lots.detail.close")}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-xl font-semibold">{lot.code}</span>
        <StatusBadge
          tone={lot.status === "ativo" ? "success" : "muted"}
          label={t(`status.lot.${lot.status}`)}
        />
        <span className="text-sm text-muted-foreground">
          {t("field.pen")} {penCode} · {lot.origin ?? t("common.noData")} ·{" "}
          {t("field.entryDate")} {formatDate(lot.entry_date)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          labelKey="field.animalCount"
          value={formatInteger(lot.head_count)}
          unitKey="common.unit.head"
          icon={Beef}
          note={`${animals.length} ${t("common.individualRecords")}`}
        />
        <StatCard
          labelKey="field.entryWeight"
          value={formatNumber(lot.entry_avg_weight_kg, 1)}
          unitKey="common.unit.kg"
          icon={Scale}
        />
        <StatCard
          labelKey="field.currentWeight"
          value={metrics.currentAvgWeight ? formatNumber(metrics.currentAvgWeight, 1) : "—"}
          unitKey="common.unit.kg"
          icon={Scale}
          variant="agro"
          note={
            metrics.arroba !== null
              ? `${formatNumber(metrics.arroba, 1)} ${t("common.unit.arroba")}`
              : undefined
          }
        />
        <StatCard
          labelKey="field.gmd"
          value={metrics.gmd !== null ? formatNumber(metrics.gmd, 2) : "—"}
          unitKey="common.unit.kgPerDay"
          icon={TrendingUp}
          note={
            metrics.totalGain !== null
              ? `${t("lots.detail.gainTotal")}: ${formatNumber(metrics.totalGain, 1)} kg`
              : undefined
          }
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProjectionCard
            targetWeight={lot.target_weight_kg}
            metrics={metrics}
            scenario={scenario}
            onScenarioChange={setScenario}
            saving={updateLot.isPending}
            onTargetChange={(weight) => {
              void updateLot.mutateAsync({ id: lot.id, target_weight_kg: weight });
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

      <Tabs defaultValue="animals">
        <TabsList>
          <TabsTrigger value="animals">{t("lots.detail.animals")}</TabsTrigger>
          <TabsTrigger value="weighings">{t("lots.detail.weighings")}</TabsTrigger>
          <TabsTrigger value="health">{t("animals.detail.health")}</TabsTrigger>
          <TabsTrigger value="feed">{t("lots.detail.feed")}</TabsTrigger>
        </TabsList>

        <TabsContent value="animals" className="pt-4">
          <DataTable
            rows={animals}
            columns={animalColumns}
            getRowKey={(row) => row.id}
            emptyState={
              <EmptyState icon={Beef} titleKey="lots.detail.noAnimals" />
            }
          />
        </TabsContent>

        <TabsContent value="weighings" className="pt-4">
          <DataTable
            rows={weighings}
            columns={weighingColumns}
            getRowKey={(row) => row.id}
            emptyState={<EmptyState icon={Scale} titleKey="weighings.empty.title" descriptionKey="weighings.empty.description" />}
          />
        </TabsContent>

        <TabsContent value="health" className="pt-4">
          <DataTable
            rows={healthEvents}
            columns={healthColumns}
            getRowKey={(row) => row.id}
            emptyState={<EmptyState titleKey="animals.detail.noEvents" />}
          />
        </TabsContent>

        <TabsContent value="feed" className="pt-4">
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
