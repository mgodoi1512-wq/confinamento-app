import { FeedSuggestionExport } from "@/components/app/feed-suggestion-export";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PenFeedingProgress, PenFeedingStatus } from "@/components/app/pen-feeding-status";
import { usePenFeeding } from "@/hooks/use-pen-feeding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteFeedLog, useFeedLogs } from "@/hooks/use-feed";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { computePenOccupancy, summarizeFeedLogs, type FeedLog } from "@/lib/domain";
import { formatDate, formatInteger, formatNumber, todayIso } from "@/lib/format";
import { FeedFormDialog } from "./feed-form-dialog";

const Feed = () => {
  const { t } = useTranslation();
  const today = todayIso();

  const feedQuery = useFeedLogs();
  const pensQuery = usePens();
  const lotsQuery = useLots();
  const feeding = usePenFeeding();
  const deleteFeedLog = useDeleteFeedLog();

  const feedLogs = useMemo(() => feedQuery.data ?? [], [feedQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);

  const occupancy = useMemo(() => computePenOccupancy(pens, lots), [pens, lots]);
  const pensWithLot = occupancy.filter((item) => item.lot);

  const todayLogs = feedLogs.filter((log) => log.date === today);
  const todayRows = pensWithLot.map(item => {
    const logs = todayLogs.filter(log => log.pen_id === item.pen.id);
    const summary = summarizeFeedLogs(logs);
    return {
      id: item.pen.id,
      penCode: item.pen.code,
      lotCode: lots.filter(lot=>lot.status==="ativo" && lot.pen_id===item.pen.id).map(lot=>lot.code).join(", ") || "—",
      feeding: feeding.forPen(item.pen.id),
      hasFeed: logs.length > 0,
      total: summary.totalKg,
      perHead: summary.averageKgPerHeadPerLog,
    };
  });
  const todayLoading = [pensQuery, lotsQuery, feedQuery].some(query => query.isLoading);
  const columns: Column<FeedLog>[] = [
    { key: "date", headerKey: "field.date", render: (log) => formatDate(log.date) },
    {
      key: "pen",
      headerKey: "feed.pen",
      render: (log) => (
        <span className="font-display text-sm font-semibold">
          {pens.find((pen) => pen.id === log.pen_id)?.code ?? "—"}
        </span>
      ),
    },
    { key: "shift", headerKey: "feed.shift", render: (log) => t(`feed.shift.${log.shift}`) },
    {
      key: "head",
      headerKey: "field.headCount",
      numeric: true,
      render: (log) => formatInteger(log.head_count),
    },
    {
      key: "perHead",
      headerKey: "feed.kgPerHead",
      numeric: true,
      render: (log) => `${formatNumber(log.kg_per_head, 2)} kg`,
    },
    {
      key: "total",
      headerKey: "feed.total",
      numeric: true,
      render: (log) => `${formatNumber(log.total_kg, 2)} kg`,
    },
  ];

  const remove = async (id: string) => {
    try {
      await deleteFeedLog.mutateAsync(id);
      toast.success(t("toast.saved"));
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="feed.title"
        subtitleKey="feed.subtitle"
        actions={
          <>
            <FeedSuggestionExport />
            <Button asChild variant="outline" className="h-10">
              <Link to="/trato/leitura">
                <ClipboardCheck />
                {t("nav.reading")}
              </Link>
            </Button>
            <FeedFormDialog
              trigger={
                <Button className="h-10">
                  <Plus />
                  {t("feed.new")}
                </Button>
              }
            />
          </>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="font-display text-lg">{t("feed.today")}</CardTitle>
            <span className="text-sm num text-muted-foreground">
              {todayLoading ? "—" : t("feed.todayProgress", {
                done: todayRows.filter(row => row.feeding?.shifts.every(shift => shift.complete || shift.total === 0)).length,
                total: pensWithLot.length,
              })}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">Tratos de hoje: verde = fornecido para todos os lotes; vermelho = pendente ou parcial. A barra compara a mistura fornecida (ração + volumoso) com a recomendação diária da dieta, pelo planejamento fixado no primeiro trato; antes disso, pela referência atual do lote. A média é por lançamento; os registros representam oferta, não ingestão medida.</p>
          <div className="overflow-x-auto"><div className="md:min-w-[900px]">
          <DataTable
            rows={todayRows}
            columns={[
              {
                key: "pen", headerKey: "feed.pen", 
                render: row => <span className="font-display font-semibold">{row.penCode}</span>,
              },
              { key: "lot", headerKey: "field.lot",  render: row => row.lotCode },
              {
                key: "status", headerKey: "field.status", className: "text-center",
                render: row => <div className="flex justify-center"><PenFeedingStatus summary={row.feeding} error={feeding.error} /></div>,
              },
              {
                key: "dailyProgress", headerKey: "Fornecimento da dieta", className: "text-center",
                render: row => <div className="flex justify-center"><PenFeedingProgress summary={row.feeding} error={feeding.error} /></div>,
              },
              {
                key: "perHead", headerKey: "Oferta média por lançamento", numeric: true, className: "text-center",
                render: row => row.perHead !== null ? `${formatNumber(row.perHead, 2)} kg/cab` : "—",
              },
              {
                key: "recommended", headerKey: "Total recomendado", numeric: true, className: "text-center",
                render: row => row.feeding?.recommendedKg != null ? `${formatNumber(row.feeding.recommendedKg,2)} kg` : "—",
              },
              {
                key: "total", headerKey: "feed.total", numeric: true, className: "text-center",
                render: row => row.hasFeed ? `${formatNumber(row.total, 2)} kg` : "—",
              },
            ]}
            getRowKey={row => row.id}
            loading={todayLoading}
            emptyState={
              <EmptyState icon={UtensilsCrossed} titleKey="feed.empty.title" descriptionKey="feed.empty.description" />
            }
            renderCard={row => (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-display text-base font-semibold">{row.penCode}</p>
                    <p className="break-words text-xs text-muted-foreground">{t("field.lot")}: {row.lotCode}</p>
                  </div>
                  <PenFeedingStatus summary={row.feeding} error={feeding.error} />
                </div>
                <div className="border-t pt-3"><PenFeedingProgress summary={row.feeding} error={feeding.error} /></div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Oferta média por lançamento</p>
                    <p className="num font-medium">{row.perHead !== null ? `${formatNumber(row.perHead, 2)} kg/cab` : "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total recomendado</p>
                    <p className="num font-medium">{row.feeding?.recommendedKg != null ? `${formatNumber(row.feeding.recommendedKg,2)} kg` : "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t("feed.total")}</p>
                    <p className="num font-medium">{row.hasFeed ? `${formatNumber(row.total, 2)} kg` : "—"}</p>
                  </div>
                </div>
              </div>
            )}
          />
          </div></div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("feed.history")}</h2>
        <DataTable
          rows={feedLogs.slice(0, 60)}
          columns={[
            ...columns,
            {
              key: "actions",
              headerKey: "common.actions",
              render: (log) => (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label={t("action.delete")}
                  onClick={(event) => {
                    event.stopPropagation();
                    void remove(log.id);
                  }}
                >
                  <Trash2 />
                </Button>
              ),
            },
          ]}
          getRowKey={(log) => log.id}
          loading={feedQuery.isLoading}
          emptyState={
            <EmptyState
              icon={UtensilsCrossed}
              titleKey="feed.empty.title"
              descriptionKey="feed.empty.description"
            />
          }
          renderCard={(log) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-base font-semibold">
                  {pens.find((pen) => pen.id === log.pen_id)?.code ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(log.date)} · {t(`feed.shift.${log.shift}`)}
                </span>
              </div>
              <p className="text-sm num text-muted-foreground">
                {formatNumber(log.kg_per_head, 2)} kg/cab · {formatNumber(log.total_kg, 0)} kg
              </p>
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default Feed;
