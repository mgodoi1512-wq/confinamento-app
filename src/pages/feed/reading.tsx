import "./reading-round.css";
import { locationName } from "@/lib/location-name";
import { ReadingOverview } from "./reading-overview";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Info, Play, Save } from "lucide-react";
import { toast } from "sonner";

import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TroughScoreSelector } from "@/components/app/trough-score-selector";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useDietItems } from "@/hooks/use-diets";
import { useFeedLogs } from "@/hooks/use-feed";
import { useWeighings } from "@/hooks/use-weighings";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useSaveTroughReading, useTroughReadings, useApplyReadings } from "@/hooks/use-trough";
import {
  TROUGH_ADJUSTMENT,
  computePenOccupancy,
  computeLotMetrics,
  dietTotalKg,
  type PenOccupancy,
} from "@/lib/domain";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";

const ReadingRound = () => {
  const { t } = useTranslation();
  const today = todayIso();
  const { user } = useAuth();

  const troughQuery = useTroughReadings();
  const pensQuery = usePens();
  const lotsQuery = useLots();
  const dietItemsQuery = useDietItems();
  const weighingsQuery = useWeighings();
  const feedQuery = useFeedLogs();

  const saveReading = useSaveTroughReading();
  const applyReadings = useApplyReadings();

  const readings = useMemo(() => troughQuery.data ?? [], [troughQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const dietItems = useMemo(() => dietItemsQuery.data ?? [], [dietItemsQuery.data]);
  const feedLogs = useMemo(() => feedQuery.data ?? [], [feedQuery.data]);

  const [activePen, setActivePen] = useState<PenOccupancy | null>(null);
  const [baseInput, setBaseInput] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [leftover, setLeftover] = useState("");
  const [adjustmentPct, setAdjustmentPct] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedPen, setLastSavedPen] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const occupancy = useMemo(() => computePenOccupancy(pens, lots), [pens, lots]);
  const pensWithLot = occupancy.filter((item) => item.lot).sort((a, b) =>
    locationName(a.pen).localeCompare(locationName(b.pen), "pt-BR", { numeric: true, sensitivity: "base" }),
  );
  const loading = [pensQuery, lotsQuery, troughQuery, feedQuery, dietItemsQuery, weighingsQuery].some(query => query.isLoading);

  const todayReadings = readings.filter((reading, index) => reading.date === today && readings.findIndex((other) => other.date === today && other.pen_id === reading.pen_id) === index);
  const readPenIds = new Set(todayReadings.map((reading) => reading.pen_id));
  const pending = pensWithLot.filter((item) => !readPenIds.has(item.pen.id));

  const basePerHead = (penId: string) => {
    const lastLog = feedLogs.find((log) => log.pen_id === penId && log.shift === "manha" && log.date < today);
    if (lastLog) return lastLog.kg_per_head;
    const lot = pensWithLot.find((item) => item.pen.id === penId)?.lot;
    const weight = lot && weighingsQuery.isSuccess ? computeLotMetrics(lot, weighingsQuery.data ?? [], today).currentAvgWeight : null;
    return dietTotalKg(dietItems.filter(item => item.diet_id === lot?.diet_id), weight);
  };

  const openPen = (item: PenOccupancy) => {
    setActivePen(item);
    const base = basePerHead(item.pen.id);
    setBaseInput(base === null ? "" : String(base).replace(".", ","));
    setScore(null);
    setLeftover("");
    setAdjustmentPct("");
    setNotes("");
  };

  const selectScore = (value: number) => {
    setScore(value);
    setAdjustmentPct(String(TROUGH_ADJUSTMENT[value] ?? 0).replace(".", ","));
  };

  const pct = parseNumberInput(adjustmentPct) ?? 0;
  const unitBase = parseNumberInput(baseInput) ?? 0;
  const adjustmentKg = (unitBase * pct) / 100;

  const nextPending = (currentPenId: string) =>
    pending.find((item) => item.pen.id !== currentPenId) ?? null;

  const save = async () => {
    if (!activePen || score === null) return;

    if (parseNumberInput(baseInput) === null || parseNumberInput(adjustmentPct) === null || unitBase < 0 || pct < -100 || (leftover.trim() && (parseNumberInput(leftover) === null || parseNumberInput(leftover) < 0))) { toast.error("Confira oferta base, sobras e ajuste."); return; }
    setSaving(true);

    try {
      await saveReading.mutateAsync({
        pen_id: activePen.pen.id,
        lot_id: activePen.lot?.id ?? null,
        date: today,
        score,
        leftover_kg: parseNumberInput(leftover),
        base_kg_per_head: unitBase,
        adjustment_pct: pct,
        adjustment_kg: Math.round(adjustmentKg * 1000) / 1000,
        notes: notes.trim() || null,
        recorded_by: user?.id ?? null,
      });

      setLastSavedPen(locationName(activePen.pen));
      setSaving(false);

      const following = nextPending(activePen.pen.id);
      if (following) {
        openPen(following);
        return;
      }

      setActivePen(null);
      toast.success(t("feed.reading.completed", { count: pending.length }));
    } catch (error) {
      setSaving(false);
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  const applyAdjustments = async () => {
    setApplying(true);
    try {
      const result = await applyReadings.mutateAsync(today);
      if (result.created > 0) {
        toast.success(t("feed.reading.applied", { count: result.created }));
      } else if (result.alreadyApplied > 0) {
        toast.info(t("feed.reading.alreadyApplied"));
      } else {
        toast.info(t("feed.reading.nothingToApply"));
      }
    }
    catch (error) { toast.error(error instanceof Error ? error.message : t("toast.error.generic")); }
    finally { setApplying(false); }
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
            disabled={loading || pending.length === 0}
          >
            <Play />
            {pensWithLot.length > 0 && pending.length === 0 && !loading ? "Ronda concluída" : t("action.startRound")}
          </Button>
        }
      />

      <ReadingOverview
        rows={pensWithLot.map(item => ({
          occupancy: item,
          base: basePerHead(item.pen.id),
          reading: todayReadings.find(entry => entry.pen_id === item.pen.id),
        }))}
        date={today}
        loading={loading}
        onOpen={openPen}
        lastSavedPen={lastSavedPen}
      />

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
                      {locationName(pens.find((pen) => pen.id === reading.pen_id), "—")}
                    </span>
                    <span className="num text-muted-foreground">
                      {formatNumber((reading.base_kg_per_head ?? 0), 2)} →{" "}
                      {formatNumber(
                        (reading.base_kg_per_head ?? 0) * (1 + reading.adjustment_pct / 100),
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
      <Sheet open={Boolean(activePen)} onOpenChange={(open) => (!open && !saving ? setActivePen(null) : undefined)}>
        <SheetContent side="bottom" className="reading-round-dialog" onInteractOutside={(event) => { if (saving) event.preventDefault(); }} onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }}>
          {activePen ? (
            <>
              <SheetHeader className="reading-round-header text-left">
                <SheetTitle className="pr-6 font-display text-xl">{locationName(activePen.pen)}</SheetTitle>
                <SheetDescription>
                  {activePen.lot?.code ?? "—"} · {activePen.lot?.head_count ?? 0} animais · Leitura de cocho
                </SheetDescription>
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">{pensWithLot.filter(item => readPenIds.has(item.pen.id)).length} de {pensWithLot.length} locais concluídos</p>
                  <div role="progressbar" aria-label="Progresso da ronda" aria-valuemin={0} aria-valuemax={pensWithLot.length} aria-valuenow={pensWithLot.filter(item => readPenIds.has(item.pen.id)).length} className="h-1.5 overflow-hidden rounded-full border border-border bg-black/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-400" style={{ width: `${pensWithLot.length ? pensWithLot.filter(item => readPenIds.has(item.pen.id)).length / pensWithLot.length * 100 : 0}%` }} />
                  </div>
                </div>
              </SheetHeader>

              <fieldset disabled={saving} className="reading-round-body min-w-0 space-y-4">
                <NumericField label="Oferta da manhã (kg/animal)" unit="kg" value={baseInput} onValueChange={setBaseInput} compact />
                <details className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground"><Info className="mr-1 inline size-3.5" />Como é calculada a oferta?</summary>
                  <p className="pt-2 leading-relaxed">Sem trato anterior da manhã, a referência vem da soma diária da dieta, com os percentuais calculados sobre o peso médio do lote. Sem peso válido, informe a oferta manualmente. Confira e informe apenas a parcela prevista para a manhã. Cada leitura gera o trato uma única vez.</p>
                </details>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Selecione a leitura do cocho</p>
                  <TroughScoreSelector value={score} onChange={selectScore} variant="cards" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <NumericField label="Sobra no cocho (total)" unit="kg" value={leftover} onValueChange={setLeftover} helper="Opcional · sobra total deste local." compact />
                  <NumericField label="Ajuste da oferta" unit="%" value={adjustmentPct} onValueChange={setAdjustmentPct} helper="Sugerido pela leitura; pode ser ajustado." compact />
                </div>

                <section aria-label="Resumo da oferta da manhã" aria-live="polite" className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oferta da manhã</h3>
                  {score === null ? <p className="mt-2 text-sm text-muted-foreground">Selecione uma leitura para visualizar o ajuste.</p> : parseNumberInput(baseInput) === null || unitBase < 0 || parseNumberInput(adjustmentPct) === null || pct < -100 ? <p className="mt-2 text-sm text-destructive">Confira a oferta base e o percentual de ajuste.</p> : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Por animal</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold num"><span className="text-muted-foreground">{formatNumber(unitBase, 2)}</span><ArrowRight className="size-4 text-muted-foreground" /><span>{formatNumber(unitBase + adjustmentKg, 2)} kg</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">Ajuste: {pct > 0 ? "+" : ""}{formatNumber(pct, 1)}% ({adjustmentKg > 0 ? "+" : ""}{formatNumber(adjustmentKg, 2)} kg)</p>
                      </div>
                      <div className="border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                        <p className="text-xs text-muted-foreground">Total do lote · {activePen.lot?.head_count ?? 0} animais</p>
                        <p className="mt-1 text-base font-semibold num">{formatNumber((unitBase + adjustmentKg) * (activePen.lot?.head_count ?? 0), 2)} kg</p>
                        <p className="mt-1 text-xs text-muted-foreground">Quantidade prevista para a manhã.</p>
                      </div>
                    </div>
                  )}
                </section>
                <TextField label="Observações (opcional)" value={notes} onChange={setNotes} />
              </fieldset>

              <div className="reading-round-footer">
                <Button className="h-11 w-full" onClick={() => void save()} disabled={score === null || saving || parseNumberInput(baseInput) === null || unitBase < 0 || parseNumberInput(adjustmentPct) === null || pct < -100}>
                  <Check />{saving ? "Salvando…" : nextPending(activePen.pen.id) ? t("action.saveAndNext") : "Salvar e concluir"}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {lastSavedPen && pending.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          {t("feed.reading.allDone")}
        </p>
      ) : null}
    </div>
  );
};

export default ReadingRound;
