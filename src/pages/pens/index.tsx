import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Beef, ClipboardCheck, Plus, UtensilsCrossed } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { OccupancyBar } from "@/components/app/occupancy-bar";
import { PageHeader } from "@/components/app/page-header";
import { PageLoading } from "@/components/app/page-loading";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useDiets } from "@/hooks/use-diets";
import { useFeedLogs } from "@/hooks/use-feed";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useTroughReadings } from "@/hooks/use-trough";
import { computePenOccupancy, penStatusTone, troughScoreTone, type PenOccupancy } from "@/lib/domain";
import { formatDate, formatInteger, formatNumber } from "@/lib/format";

const Pens = () => {
  const { t } = useTranslation();
  const { isGestor } = useAuth();

  const pensQuery = usePens();
  const lotsQuery = useLots();
  const dietsQuery = useDiets();
  const troughQuery = useTroughReadings();
  const feedQuery = useFeedLogs();

  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const diets = useMemo(() => dietsQuery.data ?? [], [dietsQuery.data]);
  const readings = useMemo(() => troughQuery.data ?? [], [troughQuery.data]);
  const feedLogs = useMemo(() => feedQuery.data ?? [], [feedQuery.data]);

  const [detailPen, setDetailPen] = useState<PenOccupancy | null>(null);

  const occupancy = useMemo(() => computePenOccupancy(pens, lots), [pens, lots]);

  if (pensQuery.isLoading) return <PageLoading rows={4} />;

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="pens.title"
        subtitleKey="pens.subtitle"
        actions={
          isGestor ? (
            <Button asChild className="h-10">
              <Link to="/config/currais">
                <Plus />
                {t("pens.new")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {occupancy.length === 0 ? (
        <EmptyState
          icon={Beef}
          titleKey="pens.empty.title"
          descriptionKey="pens.empty.description"
          action={
            isGestor ? (
              <Button asChild className="h-10">
                <Link to="/config/currais">{t("pens.new")}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {occupancy.map((item) => {
            const lastReading = readings.find((reading) => reading.pen_id === item.pen.id);
            const lastFeed = feedLogs.find((log) => log.pen_id === item.pen.id);
            const diet = diets.find((item2) => item2.id === item.lot?.diet_id);

            return (
              <Card key={item.pen.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-4 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-xl font-semibold">{item.pen.code}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.lot ? item.lot.code : t("pens.noLot")}
                        {diet ? ` · ${diet.name}` : ""}
                      </p>
                    </div>
                    <StatusBadge
                      tone={penStatusTone(item.pen.status)}
                      label={t(`status.pen.${item.pen.status}`)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("field.occupancy")}</span>
                      <span className="num font-medium">
                        {t("pens.occupancy", {
                          head: formatInteger(item.head),
                          capacity: formatInteger(item.capacity),
                        })}
                      </span>
                    </div>
                    <OccupancyBar percent={item.percent} overCapacity={item.overCapacity} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {item.free > 0
                          ? t("dashboard.occupancy.free", { head: formatInteger(item.free) })
                          : t("dashboard.occupancy.full")}
                      </span>
                      <span className="num">{formatNumber(item.percent, 0)}%</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {lastReading ? (
                      <StatusBadge
                        tone={troughScoreTone(lastReading.score)}
                        label={`${t("feed.reading.score")} ${lastReading.score} · ${formatDate(lastReading.date)}`}
                        size="sm"
                      />
                    ) : (
                      <span className="text-muted-foreground">{t("pens.noReading")}</span>
                    )}
                    {lastFeed ? (
                      <span className="text-muted-foreground num">
                        {formatNumber(lastFeed.kg_per_head, 2)} kg/cab
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <Dialog
                      open={detailPen?.pen.id === item.pen.id}
                      onOpenChange={(open) => setDetailPen(open ? item : null)}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-10 flex-1">
                          {t("common.details")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>
                            {item.pen.code} · {t("pens.lastReading")}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                              <ClipboardCheck className="size-4 text-muted-foreground" />
                              {t("feed.reading")}
                            </p>
                            {readings.filter((reading) => reading.pen_id === item.pen.id).length ===
                            0 ? (
                              <p className="text-sm text-muted-foreground">{t("pens.noReading")}</p>
                            ) : (
                              <ul className="divide-y divide-border rounded-lg border border-border">
                                {readings
                                  .filter((reading) => reading.pen_id === item.pen.id)
                                  .slice(0, 5)
                                  .map((reading) => (
                                    <li
                                      key={reading.id}
                                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                                    >
                                      <span className="num">{formatDate(reading.date)}</span>
                                      <StatusBadge
                                        tone={troughScoreTone(reading.score)}
                                        label={`${reading.score} · ${t(`trough.score.${reading.score}`)}`}
                                        size="sm"
                                      />
                                      <span className="num text-muted-foreground">
                                        {formatNumber(reading.adjustment_pct, 1)}%
                                      </span>
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                              <UtensilsCrossed className="size-4 text-muted-foreground" />
                              {t("feed.today")}
                            </p>
                            {feedLogs.filter((log) => log.pen_id === item.pen.id).length === 0 ? (
                              <p className="text-sm text-muted-foreground">{t("feed.empty.title")}</p>
                            ) : (
                              <ul className="divide-y divide-border rounded-lg border border-border">
                                {feedLogs
                                  .filter((log) => log.pen_id === item.pen.id)
                                  .slice(0, 5)
                                  .map((log) => (
                                    <li
                                      key={log.id}
                                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                                    >
                                      <span className="num">{formatDate(log.date)}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {t(`feed.shift.${log.shift}`)}
                                      </span>
                                      <span className="num">
                                        {formatNumber(log.total_kg, 0)} kg
                                      </span>
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button asChild size="sm" className="h-10 flex-1">
                      <Link to="/trato/leitura">{t("nav.reading")}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Pens;
