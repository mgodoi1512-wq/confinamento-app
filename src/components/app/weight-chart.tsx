import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/app/empty-state";
import { formatNumber, parseIsoDate } from "@/lib/format";
import { LineChart as LineChartIcon } from "lucide-react";

export type WeightPoint = {
  date: string;
  weight: number | null;
  projection?: number | null;
};

export type WeightChartProps = {
  points: WeightPoint[];
  target?: number | null;
  height?: number;
  emptyTitleKey?: string;
  emptyDescriptionKey?: string;
};

const formatTick = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(parseIsoDate(iso));

/** Evolução de peso do lote com peso alvo e projeção pontilhada. */
export const WeightChart = ({
  points,
  target,
  height = 240,
  emptyTitleKey = "weighings.empty.title",
  emptyDescriptionKey = "weighings.empty.description",
}: WeightChartProps) => {
  const { t } = useTranslation();

  const measured = points.filter((point) => point.weight !== null);

  if (measured.length < 2) {
    return (
      <EmptyState
        icon={LineChartIcon}
        titleKey={emptyTitleKey}
        descriptionKey={emptyDescriptionKey}
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="hsl(var(--muted-foreground))"
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={48}
            stroke="hsl(var(--muted-foreground))"
            domain={["dataMin - 20", "dataMax + 20"]}
            tickFormatter={(value: number) => formatNumber(value, 0)}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: 13,
            }}
            labelFormatter={(label: string) => formatTick(label)}
            formatter={(value: number, name: string) => [
              `${formatNumber(value, 1)} kg`,
              name === "projection" ? t("lots.detail.projection") : t("field.avgWeight"),
            ]}
          />
          {target ? (
            <ReferenceLine
              y={target}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{
                value: `${t("field.targetWeight")} ${formatNumber(target, 0)} kg`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="weight"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#weightFill)"
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            animationDuration={400}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="projection"
            stroke="hsl(var(--agro))"
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="transparent"
            dot={false}
            animationDuration={400}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          {t("field.avgWeight")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-agro" />
          {t("lots.detail.projection")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-muted-foreground" />
          {t("field.targetWeight")}
        </span>
      </div>
    </div>
  );
};
