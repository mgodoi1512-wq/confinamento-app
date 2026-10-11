import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ClipboardCheck, Save, Wheat } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { NumericField } from "@/components/app/numeric-field";
import { OccupancyBar } from "@/components/app/occupancy-bar";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TroughScoreSelector } from "@/components/app/trough-score-selector";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useDiets } from "@/hooks/use-diets";
import { useFeedLogs, useSaveFeedLog } from "@/hooks/use-feed";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useSaveTroughReading, useTroughReadings } from "@/hooks/use-trough";
import {
  TROUGH_ADJUSTMENT,
  computePenOccupancy,
  troughScoreTone,
  type PenOccupancy,
} from "@/lib/domain";
import { formatDate, formatNumber, parseNumberInput, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

const ReadingRound = () => {
  const { t } = useTranslation();
  const today = todayIso();
  const { user } = useAuth();

  const troughQuery = useTroughReadings();
  const pensQuery = usePens();
  const lotsQuery = useLots();
  const dietsQuery = useDiets();
  const feedQuery = useFeedLogs();

  const saveReading = useSaveTroughReading();
  const saveFeedLog = useSaveFeedLog();

  const readings = useMemo(() => troughQuery.data ?? [], [troughQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const diets = useMemo(() => dietsQuery.data ?? [], [dietsQuery.data]);
  const feedLogs = useMemo(() => feedQuery.data ?? [], [feedQuery.data]);

  const [activePen, setActivePen] = useState<PenOccupancy | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [leftover, setLeftover] = useState("");
  const [adjustmentPct, setAdjustmentPct] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedPen, setLastSavedPen] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const occupancy = useMemo(() => computePenOccupancy(pens, lots), [pens, lots]);
  const pensWithLot = occupancy.filter((item) => item.lot);

  const todayReadings = readings.filter((reading) => reading.date === today);
  const readPenIds = new Set(todayReadings.map((reading) => reading.pen_id));
  const pending = pensWithLot.filter((item) => !readPenIds.has(item.pen.id));

  const basePerHead = (penId: string) => {
    const lastLog = feedLogs.find((log) => log.pen_id === penId);
    if (lastLog) return lastLog.kg_per_head;
    const lot = pensWithLot.find((item) => item.pen.id === penId)?.lot;
    const dietTotal = diets
      .filter((diet) => diet.id === lot?.diet_id)
      .reduce((sum, diet) => sum + diet.kg_per_head_day, 0);
    return dietTotal;
  };

  const openPen = (item: PenOccupancy) => {
    setActivePen(item);
    setScore(null);
    setLeftover("");
    setAdjustmentPct("");
    setNotes("");
  };

  const selectScore = (value: number) => {
    setScore(value);
    setAdjustmentPct(String(TROUGH_ADJUSTMENT[value] ?? 0));
  };

  const pct = parseNumberInput(adjustmentPct) ?? 0;
  const unitBase = activePen ? basePerHead(activePen.pen.id) : 0;
  const adjustmentKg = (unitBase * pct) / 100;

  const nextPending = (currentPenId: string) =>
    pending.find((item) => item.pen.id !== currentPenId) ?? null;

  const save = async () => {
    if (!activePen || score === null) return;

    setSaving(true);

    try {
      console.log({
  pen_id: activePen.pen.id,
  lot_id: activePen.lot?.id ?? null,
  date: today,
  score,
  leftover_kg: parseNumberInput(leftover),
  adjustment_pct: pct,
  adjustment_kg: Math.round(adjustmentKg * 1000) / 1000,
  notes: notes.trim() || null,
  recorded_by: user?.id ?? null,
});
      await saveReading.mutateAsync({
        pen_id: activePen.pen.id,
        lot_id: activePen.lot?.id ?? null,
        date: today,
        score,
        leftover_kg: parseNumberInput(leftover),
        adjustment_pct: pct,
        adjustment_kg: Math.round(adjustmentKg * 1000) / 1000,
        notes: notes.trim() || null,
        recorded_by: user?.id ?? null,
      });

      setLastSavedPen(activePen.pen.code);
      setSaving(false);

      const following = nextPending(activePen.pen.id);
      if (following) {
        openPen(following);
        return;
      }

      setActivePen(null);
      toast.success(t("feed.reading.completed", { count: pending.length }));
    } catch {
      setSaving(false);
      toast.error(t("toast.error.generic"));
    }
  };

  const applyAdjustments = async () => {
    const adjustments = todayReadings.filter((reading) => reading.adjustment_pct !== 0);
    if (adjustments.length === 0) return;

    setApplying(true);

    try {
      for (const reading of adjustments) {
        const base = basePerHead(reading.pen_id);
        const adjusted = Math.round(base * (1 + reading.adjustment_pct / 100) * 1000) / 1000;
        const lot = lots.find((item) => item.pen_id === reading.pen_id && item.status === "ativo");
        await saveFeedLog.mutateAsync({
          pen_id: reading.pen_id,
          lot_id: lot?.id ?? null,
          date: today,
          shift: "manha",
          diet_id: lot?.diet_id ?? null,
          head_count: lot?.head_count ?? 0,
          kg_per_head: adjusted,
          total_kg: Math.round(adjusted * (lot?.head_count ?? 0) * 100) / 100,
          notes: t("feed.reading.adjustment"),
        });
      }
      toast.success(t("feed.saved"));
    } catch (error) {
  setSaving(false);

  console.error("TROUGH ERROR:", error);

  toast.error(
    error instanceof Error
      ? error.message
      : JSON.stringify(error)
  );
} finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="feed.reading"
        subtitleKey="feed.reading.subtitle"
        actions={
          <Button
            className="h-10"
            onClick={() => {
              const first = pending[0];
              if (first) openPen(first);
            }}
            disabled={pending.length === 0}
          >
            <ClipboardCheck />
            {pending.length > 0 ? t("action.startRound") : t("common.noData")}
          </Button>
        }
      />

      <Card className="bg-surface">
        <CardContent className="pt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("feed.reading")}
              </p>
              <p className="font-display text-3xl leading-none num">
                {todayReadings.length}
                <span className="text-lg text-muted-foreground">/{pensWithLot.length}</span>
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              {t("feed.reading.roundProgress", {
                done: todayReadings.length,
                total: pensWithLot.length,
              })}
            </span>
          </div>
          <OccupancyBar
            className="mt-4"
            percent={pensWithLot.length ? (todayReadings.length / pensWithLot.length) * 100 : 0}
          />
        </CardContent>
      </Card>

      {pensWithLot.length === 0 ? (
        <EmptyState
          icon={Wheat}
          titleKey="pens.empty.title"
          descriptionKey="pens.empty.description"
        />
      ) : (
        <div className="space-y-2">
          {pensWithLot.map((item) => {
            const reading = todayReadings.find((entry) => entry.pen_id === item.pen.id);
            const isPending = !reading;

            return (
              <button
                key={item.pen.id}
                type="button"
                onClick={() => openPen(item)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-xs transition-colors active:bg-muted/50",
                  lastSavedPen === item.pen.code && "ring-2 ring-success/40",
                )}
              >
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{item.pen.code}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.lot?.code} · {formatNumber(basePerHead(item.pen.id), 2)} kg/cab
                  </p>
                </div>
                {reading ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      tone={troughScoreTone(reading.score)}
                      label={`${t("feed.reading.score")} ${reading.score}`}
                      size="sm"
                    />
                    <Check className="size-4 text-success" />
                  </div>
                ) : (
                  <StatusBadge
                    tone={isPending ? "muted" : "success"}
                    label={t("common.noData")}
                    size="sm"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Resumo e aplicação do ajuste */}
      {todayReadings.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">{t("feed.reading.adjustment")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="divide-y divide-border rounded-lg border border-border">
              {todayReadings
                .filter((reading) => reading.adjustment_pct !== 0)
                .map((reading) => (
                  <li
                    key={reading.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="font-display font-semibold">
                      {pens.find((pen) => pen.id === reading.pen_id)?.code ?? "—"}
                    </span>
                    <span className="num text-muted-foreground">
                      {formatNumber(basePerHead(reading.pen_id), 2)} →{" "}
                      {formatNumber(
                        basePerHead(reading.pen_id) * (1 + reading.adjustment_pct / 100),
                        2,
                      )}{" "}
                      kg/cab
                    </span>
                    <StatusBadge
                      tone={reading.adjustment_pct > 0 ? "success" : "warning"}
                      label={`${reading.adjustment_pct > 0 ? "+" : ""}${formatNumber(reading.adjustment_pct, 1)}%`}
                      size="sm"
                    />
                  </li>
                ))}
            </ul>

            <Button
              className="h-11 w-full"
              onClick={() => void applyAdjustments()}
              disabled={applying}
            >
              <Save />
              {t("action.applyAdjustment")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Leitura do curral */}
      <Sheet open={Boolean(activePen)} onOpenChange={(open) => (!open ? setActivePen(null) : undefined)}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl">
          {activePen ? (
            <div className="mx-auto w-full max-w-xl space-y-5 pb-6">
              <SheetHeader className="text-left">
                <SheetTitle className="font-display text-xl">
                  {activePen.pen.code}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {t("feed.reading.penContext", {
                    lot: activePen.lot?.code ?? "—",
                    kg: formatNumber(basePerHead(activePen.pen.id), 2),
                  })}
                </p>
              </SheetHeader>

              <TroughScoreSelector value={score} onChange={selectScore} />

              <NumericField
                label={t("feed.reading.leftover")}
                unit="kg"
                value={leftover}
                onValueChange={setLeftover}
              />

              <div className="space-y-2">
                <NumericField
                  label={t("feed.reading.adjustment")}
                  unit="%"
                  value={adjustmentPct}
                  onValueChange={setAdjustmentPct}
                />
                <p className="text-xs text-muted-foreground">
                  {t("feed.kgPerHead")}: {formatNumber(unitBase, 2)} →{" "}
                  <span className="font-semibold text-foreground">
                    {formatNumber(unitBase + adjustmentKg, 2)} kg
                  </span>{" "}
                  ({adjustmentKg >= 0 ? "+" : ""}
                  {formatNumber(adjustmentKg, 2)} kg)
                </p>
              </div>

              <TextField label={t("field.notes")} value={notes} onChange={setNotes} />

              {pending.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  {t("feed.reading.pending", { count: pending.length - 1 })}
                </p>
              ) : null}

              <Button
                className="h-12 w-full"
                onClick={() => void save()}
                disabled={score === null || saving}
              >
                <Check />
                {t("action.saveAndNext")}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {t("feed.reading.roundProgress", {
                  done: todayReadings.length,
                  total: pensWithLot.length,
                })}
              </p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {lastSavedPen && pending.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          {t("feed.reading.allDone")}
        </p>
      ) : null}

      {todayReadings.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {t("pens.lastReading")}: {formatDate(today)}
        </p>
      ) : null}
    </div>
  );
};

export default ReadingRound;
