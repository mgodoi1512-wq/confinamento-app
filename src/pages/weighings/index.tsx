import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";

import { WeightKgIcon } from "@/components/app/weight-kg-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { weighingGmd } from "@/lib/weighing-gmd";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { useLots } from "@/hooks/use-lots";
import { useWeighings } from "@/hooks/use-weighings";
import { liveWeightToArroba } from "@/lib/domain";
import { formatDate, formatInteger, formatNumber } from "@/lib/format";

const Weighings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const weighingsQuery = useWeighings();
  const lotsQuery = useLots();

  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const weighings = useMemo(() => weighingsQuery.data ?? [], [weighingsQuery.data]);

  const rows = useMemo(() => weighings.map(weighing => ({
    weighing,
    ...weighingGmd(weighing, lots.find(lot => lot.id === weighing.lot_id) ?? null, weighings),
  })), [weighings, lots]);
  const gmdCell = (row: (typeof rows)[number]) => (
    <Tooltip><TooltipTrigger asChild>
      <button type="button" onClick={event => event.stopPropagation()}
        className={`cursor-help border-b border-dotted border-current/40 ${row.gmd === null || row.gmd === 0 ? "text-muted-foreground" : row.gmd > 0 ? "text-success" : "text-destructive"}`}>
        {row.gmd === null ? "—" : formatNumber(row.gmd, 2)}
      </button>
    </TooltipTrigger><TooltipContent className="max-w-xs">{row.reason}</TooltipContent></Tooltip>
  );

  const columns: Column<(typeof rows)[number]>[] = [
    { key: "date", headerKey: "field.date", render: (row) => formatDate(row.weighing.date) },
    {
      key: "lot",
      headerKey: "field.lot",
      render: (row) => (
        <span className="font-sans text-sm font-semibold">
          {lots.find((lot) => lot.id === row.weighing.lot_id)?.code ?? "—"}
        </span>
      ),
    },
    {
      key: "kind",
      headerKey: "field.kind",
      render: (row) => (
        <StatusBadge
          tone={row.weighing.kind === "individual" ? "info" : "muted"}
          label={t(`weighings.kind.${row.weighing.kind}`)}
          size="sm"
        />
      ),
    },
    {
      key: "head",
      headerKey: "field.headCountWeighed",
      numeric: true,
      render: (row) => formatInteger(row.weighing.head_count_weighed),
    },
    {
      key: "avg",
      headerKey: "field.avgWeight",
      numeric: true,
      render: (row) => `${formatNumber(row.weighing.avg_weight_kg, 1)} kg`,
    },
    {
      key: "gmd",
      headerKey: "field.gmd",
      numeric: true,
      render: gmdCell,
    },
    {
      key: "arroba",
      headerKey: "field.arroba",
      numeric: true,
      render: (row) => formatNumber(liveWeightToArroba(row.weighing.avg_weight_kg) ?? 0, 1),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="weighings.title"
        subtitleKey="weighings.subtitle"
        actions={
          <Button asChild className="h-10 w-40 max-w-full shrink-0">
            <Link to="/pesagens/nova">
              <Plus />
              {t("weighings.new")}
            </Link>
          </Button>
        }
      />

      <DataTable
        rows={rows}
        columns={columns.map(column => ({ ...column, className: "text-center" }))}
        getRowKey={(row) => row.weighing.id}
        onRowClick={(row) => navigate(`/pesagens/${row.weighing.id}`)}
        loading={weighingsQuery.isLoading || lotsQuery.isLoading}
        emptyState={
          <EmptyState
            icon={WeightKgIcon}
            iconContainerClassName="bg-transparent text-primary dark:text-foreground"
            iconClassName="size-10"
            titleKey="weighings.empty.title"
            descriptionKey="weighings.empty.description"
            action={
              <Button asChild className="h-10 w-40 max-w-full shrink-0">
                <Link to="/pesagens/nova"><Plus />{t("weighings.new")}</Link>
              </Button>
            }
          />
        }
        renderCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">
                  {lots.find((lot) => lot.id === row.weighing.lot_id)?.code ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.weighing.date)} · {t(`weighings.kind.${row.weighing.kind}`)}
                </p>
              </div>
              <span className="text-sm">{gmdCell(row)} <span className="text-xs text-muted-foreground">kg/dia</span></span>
            </div>
            <div className="grid grid-cols-3 gap-x-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("field.avgWeight")}</p>
                <p className="num font-medium">
                  {formatNumber(row.weighing.avg_weight_kg, 1)} kg
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.headCountWeighed")}</p>
                <p className="num font-medium">{formatInteger(row.weighing.head_count_weighed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.arroba")}</p>
                <p className="num font-medium">
                  {formatNumber(liveWeightToArroba(row.weighing.avg_weight_kg) ?? 0, 1)}
                </p>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default Weighings;
