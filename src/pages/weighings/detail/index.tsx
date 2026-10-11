import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarClock, Scale, Trash2, TrendingUp } from "lucide-react";
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
import { useAnimals } from "@/hooks/use-animals";
import { useLots } from "@/hooks/use-lots";
import { useDeleteWeighing, useWeighings, useWeightRecords } from "@/hooks/use-weighings";
import {
  computeGmd,
  computeLotMetrics,
  computeProjection,
  liveWeightToArroba,
  type WeightRecord,
} from "@/lib/domain";
import { daysBetween, formatDate, formatNumber, todayIso } from "@/lib/format";

const WeighingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();
  const scenario = "realistic" as const;

  const weighingsQuery = useWeighings();
  const recordsQuery = useWeightRecords();
  const animalsQuery = useAnimals();
  const lotsQuery = useLots();
  const deleteWeighing = useDeleteWeighing();

  const weighings = useMemo(() => weighingsQuery.data ?? [], [weighingsQuery.data]);

  const weighing = useMemo(
    () => weighings.find((item) => item.id === id) ?? null,
    [weighings, id],
  );

  const lotWeighings = useMemo(
    () => weighings.filter((item) => item.lot_id === weighing?.lot_id),
    [weighings, weighing],
  );

  const previous = useMemo(
    () =>
      lotWeighings
        .filter((item) => item.date < (weighing?.date ?? ""))
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null,
    [lotWeighings, weighing],
  );

  if (weighingsQuery.isLoading) return <PageLoading rows={5} />;

  if (!weighing) {
    return (
      <EmptyState
        titleKey="empty.title"
        descriptionKey="empty.description"
        action={
          <Button asChild className="h-10">
            <Link to="/pesagens">{t("nav.weighings")}</Link>
          </Button>
        }
      />
    );
  }

  const lot = (lotsQuery.data ?? []).find((item) => item.id === weighing.lot_id) ?? null;
  const animals = animalsQuery.data ?? [];

  const gmd = previous
    ? computeGmd(
        previous.avg_weight_kg,
        weighing.avg_weight_kg,
        Math.max(daysBetween(previous.date, weighing.date), 1),
      )
    : null;

  const metrics = lot ? computeLotMetrics(lot, weighings, today) : null;
  const projection =
    lot && metrics
      ? computeProjection(metrics.currentAvgWeight, metrics.gmd, lot.target_weight_kg, {
          today,
          scenario,
        })
      : null;

  const records = (recordsQuery.data ?? []).filter(
    (record) => record.weighing_id === weighing.id,
  );

  const ordered = [...lotWeighings].sort((a, b) => (a.date < b.date ? -1 : 1));
  const chartPoints: WeightPoint[] = ordered.map((item) => ({
    date: item.date,
    weight: item.avg_weight_kg,
    projection: item.id === ordered[ordered.length - 1]?.id ? item.avg_weight_kg : null,
  }));

  if (lot && projection && projection.days > 0) {
    chartPoints.push({
      date: projection.date,
      weight: null,
      projection: lot.target_weight_kg,
    });
  }

  const recordColumns: Column<WeightRecord>[] = [
    {
      key: "animal",
      headerKey: "field.earTag",
      render: (record) => (
        <span className="font-display text-sm font-semibold">
          {animals.find((animal) => animal.id === record.animal_id)?.ear_tag ?? "—"}
        </span>
      ),
    },
    {
      key: "weight",
      headerKey: "field.weight",
      numeric: true,
      render: (record) => `${formatNumber(record.weight_kg, 1)} kg`,
    },
    {
      key: "arroba",
      headerKey: "field.arroba",
      numeric: true,
      render: (record) => formatNumber(liveWeightToArroba(record.weight_kg) ?? 0, 1),
    },
  ];

  const remove = async () => {
    try {
      await deleteWeighing.mutateAsync(weighing.id);
      toast.success(t("toast.saved"));
      navigate("/pesagens");
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="weighings.detail.title"
        subtitleKey="weighings.subtitle"
        actions={
          <>
            <Button variant="outline" className="h-10" onClick={() => navigate("/pesagens")}>
              <ArrowLeft />
              {t("action.back")}
            </Button>
            <Button
              variant="ghost"
              className="h-10 text-destructive"
              onClick={() => void remove()}
              disabled={deleteWeighing.isPending}
            >
              <Trash2 />
              {t("action.delete")}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          tone={weighing.kind === "individual" ? "info" : "muted"}
          label={t(`weighings.kind.${weighing.kind}`)}
        />
        {lot ? (
          <Link
            to={`/lotes/${lot.id}`}
            className="font-display text-sm font-semibold underline-offset-4 hover:underline"
          >
            {lot.code}
          </Link>
        ) : null}
        <span className="text-sm text-muted-foreground num">{formatDate(weighing.date)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          labelKey="weighings.detail.avg"
          value={formatNumber(weighing.avg_weight_kg, 1)}
          unitKey="common.unit.kg"
          icon={Scale}
          variant="agro"
          note={`${formatNumber(liveWeightToArroba(weighing.avg_weight_kg) ?? 0, 1)} @`}
        />
        <StatCard
          labelKey="weighings.detail.gmd"
          value={gmd !== null ? formatNumber(gmd, 2) : "—"}
          unitKey="common.unit.kgPerDay"
          icon={TrendingUp}
        />
        <StatCard
          labelKey="field.headCountWeighed"
          value={formatNumber(weighing.head_count_weighed, 0)}
          unitKey="common.unit.head"
          icon={Scale}
        />
        <StatCard
          labelKey="weighings.detail.projection"
          value={projection ? formatDate(projection.date) : "—"}
          icon={CalendarClock}
          variant={projection?.ready ? "brand" : "default"}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">
            {t("lots.detail.weightEvolution")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WeightChart points={chartPoints} target={lot?.target_weight_kg ?? null} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("weighings.detail.records")}</h2>
        <DataTable
          rows={records}
          columns={recordColumns}
          getRowKey={(record) => record.id}
          emptyState={<EmptyState titleKey="weighings.detail.noRecords" />}
        />
      </div>
    </div>
  );
};

export default WeighingDetail;
