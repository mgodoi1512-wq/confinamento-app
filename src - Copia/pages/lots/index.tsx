import "./lots.css";
import { selectLots } from "@/lib/lot-list";
import { TextField } from "@/components/form/text-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {systemLabel} from "@/lib/production-systems";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Beef, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { ExportButtons } from "@/components/app/export-buttons";
import { lotReport } from "@/lib/export-data";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { SelectField } from "@/components/form/select-field";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useWeighings } from "@/hooks/use-weighings";
import { SELECT_ALL } from "@/lib/constants";
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
  gmdReason: string;
  projectionReason: string;
};

const Lots = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();

  const [statusFilter, setStatusFilter] = useState("ativo");
  const [page, setPage] = useState(1);
  const [search,setSearch]=useState("");
  const [order,setOrder]=useState("name");

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const weighingsQuery = useWeighings();

  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const weighings = useMemo(() => weighingsQuery.data ?? [], [weighingsQuery.data]);

  const rows = useMemo<LotRow[]>(
    () =>
      selectLots(lots,statusFilter,search,order)
        .map((lot) => {
          const metrics = computeLotMetrics(lot, weighings, today);
          const projection = computeProjection(
            metrics.currentAvgWeight,
            metrics.gmd,
            lot.target_weight_kg,
            { today },
          );

          const gmdReason="Aguardando pesagens suficientes para calcular";
          const projectionReason=!metrics.currentAvgWeight||!lot.target_weight_kg?"Informe o peso médio e o peso-alvo para estimar o abate.":metrics.gmd===null?gmdReason:metrics.gmd<=0?"O GMD precisa ser positivo para estimar quando o peso-alvo será atingido.":"Previsão calculada pelo último peso médio, GMD e peso-alvo.";
          return {
            lot,
            gmdReason,
            projectionReason,
            penCode: pens.find((pen) => pen.id === lot.pen_id)?.code ?? "—",
            currentAvgWeight: metrics.currentAvgWeight,
            gmd: metrics.gmd,
            daysOnFeed: metrics.daysOnFeed,
            projectedDate: projection?.date ?? null,
            ready: projection?.ready ?? false,
          };
        }),
    [lots, weighings, pens, statusFilter, search, order, today],
  );

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const missingValue=(reason:string)=><Tooltip><TooltipTrigger asChild><button type="button" className="rounded px-2 py-1 text-muted-foreground underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={reason} onClick={event=>event.stopPropagation()}>—</button></TooltipTrigger><TooltipContent className="max-w-72">{reason}</TooltipContent></Tooltip>;
  const columns: Column<LotRow>[] = [
    {
      key: "code",
      headerKey: "field.lot",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-sans text-sm font-semibold">{row.lot.code}</p>
          {row.lot.origin?.trim()&&<p className="truncate text-xs text-muted-foreground">Origem: {row.lot.origin}</p>}
        </div>
      ),
    },
    { key: "pen", headerKey: "Local", render: (row) => row.penCode },
    {key:"production_system",headerKey:"Sistema de criação",render:row=>systemLabel(row.lot.production_system)},
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
      headerKey: "Último peso médio",
      numeric: true,
      render: (row) =>
        row.currentAvgWeight ? `${formatNumber(row.currentAvgWeight, 1)} kg` : "—",
    },
    {
      key: "gmd",
      headerKey: "field.gmd",
      numeric: true,
      render: (row) => (row.gmd !== null ? formatNumber(row.gmd, 2) : missingValue(row.gmdReason)),
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
        <div className="flex items-center justify-center gap-2">
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
      headerKey: "Previsão de abate",
      numeric: true,
      render: (row) => row.projectedDate?formatDate(row.projectedDate):missingValue(row.projectionReason),
    },
  ];

  return (
    <div className="lots-page space-y-5">
      <PageHeader
        titleKey="lots.title"
        subtitleKey="lots.subtitle"
        actions={
          <>
          <ExportButtons
            disabled={[lotsQuery, pensQuery, weighingsQuery].some(query => query.isFetching || query.isPending || query.isError) || !rows.length}
            getReport={() => lotReport(rows.map(row => row.lot), pens, weighings, key => key==="field.currentWeight"?"Último peso médio":key==="lots.detail.projectionDate"?"Previsão de abate":t(key), `Status: ${statusFilter === SELECT_ALL ? "Todos" : t(`status.lot.${statusFilter}`)}; busca: ${search.trim()||"Todas"}; ordem: ${order==="recent"?"Mais recentes":"Nome do lote"}`, today)}
          />
          <Button asChild className="h-10 w-40 max-w-full shrink-0">
            <Link to="/lotes/novo">
              <Plus />
              {t("lots.new")}
            </Link>
          </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          className="w-full"
          label={`Exibir lotes · ${rows.length} ${t("common.results")}`}
          value={statusFilter}
          onChange={(value) => { setStatusFilter(value); setPage(1); }}
          allowEmpty
          emptyLabel={t("common.all")}
          options={[
            { value: "ativo", labelKey: "status.lot.ativo" },
            { value: "encerrado", labelKey: "status.lot.encerrado" },
          ]}
        />
        <TextField label="Buscar lote" value={search} placeholder="Digite o nome do lote" onChange={value=>{setSearch(value);setPage(1);}}/>
        <SelectField label="Ordenar por" value={order} onChange={value=>{setOrder(value);setPage(1);}} options={[{value:"name",labelKey:"Nome do lote (A–Z / 0–9)"},{value:"recent",labelKey:"Mais recentes"}]}/>
      </div>

      <DataTable
        rows={visibleRows}
        columns={columns.map((column) => ({ ...column, className: `${column.className ?? ""} text-center` }))}
        getRowKey={(row) => row.lot.id}
        onRowClick={(row) => navigate(`/lotes/${row.lot.id}`)}
        loading={lotsQuery.isLoading}
        emptyState={
          <EmptyState
            icon={Beef}
            titleKey={search.trim()||statusFilter!==SELECT_ALL?"Nenhum lote para os filtros selecionados":"lots.empty.title"}
            descriptionKey={search.trim()||statusFilter!==SELECT_ALL?"Ajuste a busca ou a situação para consultar outros lotes.":"lots.empty.description"}
            action={
              <Button asChild className="h-10 w-40 max-w-full shrink-0">
                <Link to="/lotes/novo"><Plus />{t("lots.new")}</Link>
              </Button>
            }
          />
        }
        renderCard={(row) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-sans text-sm font-semibold">{row.lot.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Local: {row.penCode}{row.lot.origin?.trim()?` · Origem: ${row.lot.origin}`:""}
                </p>
              </div>
              <StatusBadge
                tone={row.lot.status === "ativo" ? "success" : "muted"}
                label={t(`status.lot.${row.lot.status}`)}
                size="sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-center text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("field.animalCount")}</p>
                <p className="num font-medium">{formatInteger(row.lot.head_count)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último peso médio</p>
                <p className="num font-medium">
                  {row.currentAvgWeight ? `${formatNumber(row.currentAvgWeight, 1)} kg` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.gmd")}</p>
                <p className="num font-medium">
                  {row.gmd !== null ? formatNumber(row.gmd, 2) : missingValue(row.gmdReason)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("field.daysOnFeed")}</p>
                <p className="num font-medium">{formatInteger(row.daysOnFeed)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">
                  Previsão de abate
                </p>
                <p className="num font-medium">{row.projectedDate?formatDate(row.projectedDate):missingValue(row.projectionReason)}</p>
              </div>
            </div>
          </div>
        )}
      />

      {!lotsQuery.isLoading && rows.length > 0 && (
        <nav aria-label="Paginação dos lotes" className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} de {rows.length} · Página {currentPage} de {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft className="size-4" />Voltar
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
              Avançar<ChevronRight className="size-4" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default Lots;
