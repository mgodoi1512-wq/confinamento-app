import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { SelectField } from "@/components/form/select-field";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAnimals } from "@/hooks/use-animals";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useSaveWeighing } from "@/hooks/use-weighings";
import { WEIGHING_KIND_OPTIONS } from "@/lib/constants";
import { computeLotMetrics, findWeightOutliers } from "@/lib/domain";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";
import { useWeighings } from "@/hooks/use-weighings";
import { cn } from "@/lib/utils";

const NewWeighing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const animalsQuery = useAnimals();
  const weighingsQuery = useWeighings();
  const saveWeighing = useSaveWeighing();

  const activeLots = (lotsQuery.data ?? []).filter((lot) => lot.status === "ativo");
  const pens = pensQuery.data ?? [];
  const weighings = weighingsQuery.data ?? [];

  const [lotId, setLotId] = useState("");
  const [kind, setKind] = useState("amostral");
  const [date, setDate] = useState(todayIso());
  const [headCount, setHeadCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const lot = activeLots.find((item) => item.id === lotId) ?? null;
  const lotAnimals = useMemo(
    () => (animalsQuery.data ?? []).filter((animal) => animal.lot_id === lotId),
    [animalsQuery.data, lotId],
  );

  useEffect(() => {
    setWeights({});
    setAvgWeight("");
    setHeadCount("");
  }, [lotId]);

  useEffect(() => {
    if (kind === "amostral" && headCount === "" && lotAnimals.length > 0) {
      setHeadCount(String(lotAnimals.length));
    }
  }, [kind, lotAnimals.length, headCount]);

  const individualEntries = lotAnimals
    .map((animal) => ({ key: animal.id, weight: parseNumberInput(weights[animal.id] ?? "") }))
    .filter((entry): entry is { key: string; weight: number } => entry.weight !== null);

  const outlierKeys = findWeightOutliers(individualEntries);

  const computedAverage =
    individualEntries.length > 0
      ? individualEntries.reduce((sum, entry) => sum + entry.weight, 0) / individualEntries.length
      : null;

  const effectiveAverage =
    kind === "individual" && computedAverage !== null
      ? computedAverage
      : parseNumberInput(avgWeight);

  const metrics = lot ? computeLotMetrics(lot, weighings, todayIso()) : null;

  const submit = async () => {
    if (!lot) {
      setError(t("weighings.form.noLot"));
      return;
    }
    if (!effectiveAverage || effectiveAverage <= 0) {
      setError(t("toast.requiredFields"));
      return;
    }

    try {
      await saveWeighing.mutateAsync({
        weighing: {
          lot_id: lot.id,
          pen_id: lot.pen_id,
          date,
          kind,
          head_count_weighed: parseNumberInput(headCount) ?? individualEntries.length,
          avg_weight_kg: effectiveAverage,
        },
        records:
          kind === "individual"
            ? individualEntries.map((entry) => ({
                animal_id: entry.key,
                weight_kg: entry.weight,
              }))
            : [],
      });

      toast.success(
        t("weighings.saved", { weight: formatNumber(effectiveAverage, 1) }),
      );
      navigate("/pesagens");
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="weighings.new"
        subtitleKey="weighings.subtitle"
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link to="/pesagens">
              <ArrowLeft />
              {t("action.back")}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="max-w-2xl space-y-4 pt-6">
          <SelectField
            label={t("weighings.form.lot")}
            value={lotId}
            onChange={(value) => {
              setLotId(value);
              setError(null);
            }}
            placeholder={t("weighings.form.noLot")}
            options={activeLots.map((item) => ({
              value: item.id,
              labelKey: `${item.code} · ${pens.find((pen) => pen.id === item.pen_id)?.code ?? "—"}`,
            }))}
          />

          {lot ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("field.pen")}</span>
              <span className="font-display font-semibold">
                {pens.find((pen) => pen.id === lot.pen_id)?.code ?? "—"}
              </span>
              <span className="text-muted-foreground">
                · {t("field.currentWeight")}:
              </span>
              <span className="num font-medium">
                {metrics?.currentAvgWeight
                  ? `${formatNumber(metrics.currentAvgWeight, 1)} kg`
                  : "—"}
              </span>
              <span className="text-muted-foreground">· {t("field.daysOnFeed")}:</span>
              <span className="num font-medium">{metrics?.daysOnFeed ?? "—"}</span>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label={t("weighings.form.kind")}
              value={kind}
              onChange={setKind}
              options={WEIGHING_KIND_OPTIONS}
            />
            <div className="space-y-1.5">
              <label htmlFor="weighing-date" className="block text-sm font-medium">
                {t("field.date")}
              </label>
              <input
                id="weighing-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>
            <NumericField
              label={t("weighings.form.headCount")}
              unit="cab."
              inputMode="numeric"
              value={headCount}
              onValueChange={setHeadCount}
            />
          </div>

          {kind === "individual" ? (
            lotAnimals.length === 0 ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {t("lots.detail.noAnimals")}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("weighings.form.individual")}</p>
                <div className="space-y-2">
                  {lotAnimals.map((animal) => {
                    const isOutlier = outlierKeys.includes(animal.id);
                    return (
                      <div
                        key={animal.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-1",
                          isOutlier && "bg-warning/12",
                        )}
                      >
                        <span className="w-20 font-display text-sm font-semibold">
                          {animal.ear_tag}
                        </span>
                        <NumericField
                          className="flex-1"
                          compact
                          label={t("field.weight")}
                          unit="kg"
                          value={weights[animal.id] ?? ""}
                          onValueChange={(value) =>
                            setWeights((current) => ({ ...current, [animal.id]: value }))
                          }
                        />
                        {isOutlier ? (
                          <AlertTriangle className="size-4 shrink-0 text-warning" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{t("weighings.form.computedAvg")}</span>
                  <StatusBadge
                    tone="agro"
                    label={
                      computedAverage !== null
                        ? `${formatNumber(computedAverage, 1)} kg`
                        : t("common.noData")
                    }
                  />
                  {outlierKeys.length > 0 ? (
                    <span className="text-xs text-warning">{t("weighings.form.outlierHint")}</span>
                  ) : null}
                </div>
              </div>
            )
          ) : (
            <NumericField
              label={t("weighings.form.avgWeight")}
              unit="kg"
              value={avgWeight}
              onValueChange={setAvgWeight}
              error={error ?? undefined}
            />
          )}

          {error && kind === "individual" ? (
            <p className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" className="h-11" onClick={() => navigate("/pesagens")}>
              {t("action.cancel")}
            </Button>
            <Button
              className="h-11"
              onClick={() => void submit()}
              disabled={saveWeighing.isPending || !lot}
            >
              <Save />
              {t("action.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewWeighing;
