import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Beef, Plus } from "lucide-react";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { SelectField } from "@/components/form/select-field";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useWeighings } from "@/hooks/use-weighings";
import { CATEGORY_OPTIONS, SELECT_ALL } from "@/lib/constants";
import { computeLotMetrics, computeProjection, type Lot } from "@/lib/domain";
import { formatDate, formatInteger, formatNumber, todayIso } from "@/lib/format";

type LotRow = {
  lot: Lot;
  penCode: string;
  currentAvgWeight: number | null;
  gmd: number | null;
  daysOnFeed: number;
  projectedDate: string | null;
  ready: boolean;
};

const Lots = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();

  const [statusFilter, setStatusFilter] = useState("ativo");

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const weighingsQuery = useWeighings();

  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const weighings = useMemo(() => weighingsQuery.data ?? [], [weighingsQuery.data]);

  const rows = useMemo<LotRow[]>(
    () =>
      lots
        .filter((lot) => statusFilter === SELECT_ALL || lot.status === statusFilter)
        .map((lot) => {
          const metrics = computeLotMetrics(lot, weighings, today);
          const projection = computeProjection(
            metrics.currentAvgWeight,
            metrics.gmd,
            lot.target_weight_kg,
            { today },
          );

          return {
            lot,
            penCode: pens.find((pen) => pen.id === lot.pen_id)?.code ?? "—",
            currentAvgWeight: metrics.currentAvgWeight,
            gmd: metrics.gmd,
            daysOnFeed: metrics.daysOnFeed,
            projectedDate: projection?.date ?? null,
            ready: projection?.ready ?? false,
          };
        }),
    [lots, weighings, pens, statusFilter, today],
  );

  const columns: Column<LotRow>[] = [
    {
      key: "code",
      headerKey: "field.lot",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{row.lot.code}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.lot.origin ?? t("common.noData")}
          </p>
        </div>
      ),
    },
    { key: "pen", headerKey: "field.pen", render: (row) => row.penCode },
    {
      key: "category",
      headerKey: "field.category",
      render: (row) =>
        row.lot.category ? t(`status.category.${row.lot.category}`) : t("common.noData"),
    },
    {
      key: "head",
      headerKey: "field.animalCount",
      numeric: true,
      render: (row) => formatInteger(row.lot.head_count),
    },
    {
      key: "entry",
      headerKey: "field.entryWeight",
      numeric: true,
      render: (row) => `${formatNumber(row.lot.entry_avg_weight_kg, 1)} kg`,
    },
    {
      key: "current",
      headerKey: "field.currentWeight",
      numeric: true,
      render: (row) =>
        row.currentAvgWeight ? `${formatNumber(row.currentAvgWeight, 1)} kg` : "—",
    },
    {
      key: "gmd",
      headerKey: "field.gmd",
      numeric: true,
      render: (row) => (row.gmd !== null ? formatNumber(row.gmd, 2) : "—"),
    },
    {
      key: "days",
      headerKey: "field.daysOnFeed",
      numeric: true,
      render: (row) => formatInteger(row.daysOnFeed),
    },
    {
      key: "status",
      headerKey: "field.status",
      render: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge
            tone={row.lot.status === "ativo" ? "success" : "muted"}
            label={t(`status.lot.${row.lot.status}`)}
            size="sm"
          />
          {row.ready ? (
            <StatusBadge tone="primary" label={t("status.ready")} size="sm" />
          ) : null}
        </div>
      ),
    },
    {
      key: "projection",
      headerKey: "lots.detail.projectionDate",
      numeric: true,
      render: (row) => formatDate(row.projectedDate),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="lots.title"
        subtitleKey="lots.subtitle"
        actions={
          <Button asChild className="h-10">
            <Link to="/lotes/novo">
              <Plus />
              {t("lots.new")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          className="w-full sm:w-48"
          value={statusFilter}
          onChange={setStatusFilter}
          allowEmpty
          emptyLabel={t("common.all")}
          options={[
            { value: "ativo", labelKey: "status.lot.ativo" },
            { value: "encerrado", labelKey: "status.lot.encerrado" },
          ]}
        />
        <p className="pb-3 text-sm text-muted-foreground">
          {rows.length} {t("common.results")}
        </p>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.lot.id}
        onRowClick={(row) => navigate(`/lotes/${row.lot.id}`)}
        loading={lotsQuery.isLoading}
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
        renderCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">{row.lot.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("field.pen")} {row.penCode} · {row.lot.origin ?? t("common.noData")}
                </p>
              </div>
              <StatusBadge
                tone={row.lot.status === "ativo" ? "success" : "muted"}
                label={t(`status.lot.${row.lot.status}`)}
                size="sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("field.animalCount")}</p>
                <p className="num font-medium">{formatInteger(row.lot.head_count)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.currentWeight")}</p>
                <p className="num font-medium">
                  {row.currentAvgWeight ? `${formatNumber(row.currentAvgWeight, 1)} kg` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.gmd")}</p>
                <p className="num font-medium">
                  {row.gmd !== null ? formatNumber(row.gmd, 2) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.daysOnFeed")}</p>
                <p className="num font-medium">{formatInteger(row.daysOnFeed)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">
                  {t("lots.detail.projectionDate")}
                </p>
                <p className="num font-medium">{formatDate(row.projectedDate)}</p>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default Lots;
