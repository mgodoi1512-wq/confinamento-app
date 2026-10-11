import { useState } from "react";
import { CalendarClock, Target, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { NumericField } from "@/components/app/numeric-field";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { WEIGHT_SCENARIOS, type WeightScenario } from "@/lib/constants";
import { computeProjection, type LotMetrics } from "@/lib/domain";
import { formatDate, formatNumber, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProjectionCardProps = {
  targetWeight: number;
  metrics: LotMetrics;
  scenario: WeightScenario;
  onScenarioChange: (scenario: WeightScenario) => void;
  onTargetChange: (weight: number) => void;
  saving?: boolean;
};

/** Projeção de abate com cenários de GMD e peso alvo ajustável. */
export const ProjectionCard = ({
  targetWeight,
  metrics,
  scenario,
  onScenarioChange,
  onTargetChange,
  saving = false,
}: ProjectionCardProps) => {
  const { t } = useTranslation();
  const [targetDraft, setTargetDraft] = useState(String(targetWeight));

  const projection = computeProjection(metrics.currentAvgWeight, metrics.gmd, targetWeight, {
    today: todayIso(),
    scenario,
  });

  const draftValue = Number(targetDraft.replace(",", "."));
  const isDirty = Number.isFinite(draftValue) && draftValue !== targetWeight;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold">{t("lots.detail.projection")}</h2>
          <p className="text-xs text-muted-foreground">{t("lots.detail.scenario")}</p>
        </div>
        <div className="flex rounded-lg bg-muted p-1">
          {WEIGHT_SCENARIOS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onScenarioChange(option.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                scenario === option.value
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {projection ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            labelKey="lots.detail.projectionDays"
            value={formatNumber(projection.days, 0)}
            unitKey="common.unit.days"
            icon={CalendarClock}
          />
          <StatCard
            labelKey="lots.detail.projectionDate"
            value={formatDate(projection.date)}
            icon={Target}
            variant={projection.ready ? "brand" : "default"}
          />
          <StatCard
            labelKey="lots.detail.projectionArroba"
            value={projection.arroba !== null ? formatNumber(projection.arroba, 1) : "—"}
            unitKey="common.unit.arroba"
            icon={TrendingUp}
            variant="agro"
          />
          <StatCard
            labelKey="field.gmd"
            value={metrics.gmd !== null ? formatNumber(metrics.gmd, 2) : "—"}
            unitKey="common.unit.kgPerDay"
            icon={TrendingUp}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          {t("lots.detail.projectionNoGmd")}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <NumericField
          className="w-40"
          label={t("field.targetWeight")}
          unit="kg"
          value={targetDraft}
          onValueChange={setTargetDraft}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-1 h-11"
          disabled={!isDirty || saving}
          onClick={() => onTargetChange(draftValue)}
        >
          {t("action.save")}
        </Button>
      </div>
    </div>
  );
};
