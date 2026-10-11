import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { toneClasses } from "@/components/app/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/domain";

export type StatCardProps = {
  labelKey: string;
  value: string;
  unitKey?: string;
  icon?: LucideIcon;
  note?: string;
  trend?: { label: string; tone: Tone };
  variant?: "default" | "brand" | "agro";
  className?: string;
  loading?: boolean;
};

export const StatCard = ({
  labelKey,
  value,
  unitKey,
  icon: Icon,
  note,
  trend,
  variant = "default",
  className,
  loading = false,
}: StatCardProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-4 shadow-xs md:p-6", className)}>
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-8 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const isHighlighted = variant !== "default";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-xs transition-shadow duration-150 hover:shadow-md md:p-6",
        variant === "brand" && "border-transparent bg-brand text-primary-foreground",
        variant === "agro" && "border-transparent bg-agro text-agro-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-wide text-muted-foreground",
            isHighlighted && "text-current/80",
          )}
        >
          {t(labelKey)}
        </p>
        {Icon ? (
          <Icon
            className={cn("size-4 text-muted-foreground", isHighlighted && "text-current/80")}
          />
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-3xl leading-none tracking-tight num xl:text-4xl">
          {value}
        </span>
        {unitKey ? (
          <span
            className={cn(
              "text-sm font-medium text-muted-foreground",
              isHighlighted && "text-current/80",
            )}
          >
            {t(unitKey)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold num",
              toneClasses[trend.tone].tinted,
            )}
          >
            {trend.label}
          </span>
        ) : null}
        {note ? (
          <span
            className={cn(
              "text-xs text-muted-foreground",
              isHighlighted && "text-current/80",
            )}
          >
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
};
