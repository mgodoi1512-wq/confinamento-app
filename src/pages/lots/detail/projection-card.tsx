import { BovineSlaughterIcon } from "@/components/app/bovine-slaughter-icon";
import { LightbulbCogIcon } from "@/components/app/lightbulb-cog-icon";
import { useState } from "react";
import { CalendarClock, Beef, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { NumericField } from "@/components/app/numeric-field";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { WEIGHT_SCENARIOS, type WeightScenario } from "@/lib/constants";
import { computeProjection, type LotMetrics } from "@/lib/domain";
import { formatDate, formatNumber, parseNumberInput, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProjectionCardProps = {
  targetWeight: number;
  metrics: LotMetrics;
  scenario: WeightScenario;
  onScenarioChange: (scenario: WeightScenario) => void;
  onTargetChange: (weight: number) => void;
  saving?: boolean;
  gmdDays?: number;
};

/** Projeção de abate com cenários de GMD e peso alvo ajustável. */
export const ProjectionCard = ({
  targetWeight,
  metrics,
  scenario,
  onScenarioChange,
  onTargetChange,
  saving = false,
  gmdDays,
}: ProjectionCardProps) => {
  const { t } = useTranslation();
  const [targetDraft, setTargetDraft] = useState(String(targetWeight));

  const projection = computeProjection(metrics.currentAvgWeight, metrics.gmd, targetWeight, {
    today: todayIso(),
    scenario,
  });

  const draftValue = parseNumberInput(targetDraft);
  const isDirty = draftValue !== null && draftValue > 0 && draftValue !== targetWeight;
  const factor = WEIGHT_SCENARIOS.find(option => option.value === scenario)?.factor ?? 1;
  const projectedGmd = metrics.gmd === null ? null : metrics.gmd * factor;

  return (
    <div className="lot-projection space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-start gap-4">
        <h2 className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold leading-7">
          <BovineSlaughterIcon className="size-7 shrink-0 text-[#60381f] dark:text-[#c49c77]" aria-hidden="true" />
          {t("lots.detail.projection")}
        </h2>
      <div className="flex flex-wrap items-end gap-3">
        <NumericField
          className="w-36"
          compact
          label={t("field.targetWeight")}
          unit="kg"
          value={targetDraft}
          onValueChange={setTargetDraft}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10"
          disabled={!isDirty || saving}
          onClick={() => { if (draftValue !== null && draftValue > 0) onTargetChange(draftValue); }}
        >
          {t("action.save")}
        </Button>
      </div>
        </div>
        <div className="flex flex-wrap rounded-lg bg-muted p-1">
          {WEIGHT_SCENARIOS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onScenarioChange(option.value)}
              aria-pressed={scenario === option.value}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                scenario === option.value
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-[hsl(var(--muted-surface-foreground))]",
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {gmdDays !== undefined && gmdDays > 0 && gmdDays < 7 ? (
        <p className="text-xs text-muted-foreground">GMD calculado em apenas {gmdDays} dia(s). O intervalo curto pode tornar a previsão sensível às próximas pesagens.</p>
      ) : null}

      {projection ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            className="lot-detail-metric"
            labelKey="lots.detail.projectionDays"
            value={formatNumber(projection.days, 0)}
            unitKey="common.unit.days"
            icon={CalendarClock}
          />
          <StatCard
            className="lot-detail-metric"
            labelKey="Previsão de abate"
            value={formatDate(projection.date)}
            icon={Beef}
          />
          <StatCard
            className="lot-detail-metric"
            labelKey="lots.detail.projectionArroba"
            value={projection.arroba !== null ? formatNumber(projection.arroba, 1) : "—"}
            unitKey="common.unit.arroba"
            icon={LightbulbCogIcon}
          />
          <StatCard
            className="lot-detail-metric"
            labelKey="GMD usado na projeção"
            value={projectedGmd !== null ? formatNumber(projectedGmd, 2) : "—"}
            note={`${Math.round(factor * 100)}% do GMD observado`}
            unitKey="common.unit.kgPerDay"
            icon={TrendingUp}
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          {t("lots.detail.projectionNoGmd")}
        </p>
      )}


    </div>
  );
};
