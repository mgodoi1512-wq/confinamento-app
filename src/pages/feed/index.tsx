import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { OccupancyBar } from "@/components/app/occupancy-bar";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteFeedLog, useFeedLogs } from "@/hooks/use-feed";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { computePenOccupancy, type FeedLog } from "@/lib/domain";
import { formatDate, formatInteger, formatNumber, todayIso } from "@/lib/format";
import { FeedFormDialog } from "./feed-form-dialog";

const Feed = () => {
  const { t } = useTranslation();
  const today = todayIso();

  const feedQuery = useFeedLogs();
  const pensQuery = usePens();
  const lotsQuery = useLots();
  const deleteFeedLog = useDeleteFeedLog();

  const feedLogs = useMemo(() => feedQuery.data ?? [], [feedQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);

  const occupancy = useMemo(() => computePenOccupancy(pens, lots), [pens, lots]);
  const pensWithLot = occupancy.filter((item) => item.lot);

  const todayLogs = feedLogs.filter((log) => log.date === today);

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
      render: (log) => `${formatNumber(log.total_kg, 0)} kg`,
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
              {t("feed.todayProgress", {
                done: new Set(todayLogs.map((log) => log.pen_id)).size,
                total: pensWithLot.length,
              })}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pensWithLot.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              titleKey="feed.empty.title"
              descriptionKey="feed.empty.description"
            />
          ) : (
            pensWithLot.map((item) => {
              const logs = todayLogs.filter((log) => log.pen_id === item.pen.id);
              const total = logs.reduce((sum, log) => sum + log.total_kg, 0);
              const perHead =
                logs.length > 0
                  ? logs.reduce((sum, log) => sum + log.kg_per_head, 0) / logs.length
                  : null;

              return (
                <div key={item.pen.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-display font-semibold">{item.pen.code}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.lot?.code}
                      </span>
                      {logs.length > 0 ? (
                        <StatusBadge tone="success" label={t("feed.today")} size="sm" />
                      ) : (
                        <StatusBadge tone="muted" label={t("feed.empty.title")} size="sm" />
                      )}
                    </div>
                    <span className="num text-xs text-muted-foreground">
                      {perHead !== null
                        ? `${formatNumber(perHead, 2)} kg/cab · ${formatNumber(total, 0)} kg`
                        : "—"}
                    </span>
                  </div>
                  <OccupancyBar
                    percent={item.percent}
                    overCapacity={item.overCapacity}
                    className="h-1"
                  />
                </div>
              );
            })
          )}
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
