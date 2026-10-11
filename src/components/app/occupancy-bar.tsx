import { cn } from "@/lib/utils";

export type OccupancyBarProps = {
  percent: number;
  overCapacity?: boolean;
  className?: string;
};

/** Barra de ocupação com faixa de atenção e superlotação. */
export const OccupancyBar = ({ percent, overCapacity, className }: OccupancyBarProps) => {
  const tone = overCapacity
    ? "bg-destructive"
    : percent > 85
      ? "bg-warning"
      : percent > 0
        ? "bg-primary"
        : "bg-muted-foreground/40";

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", tone)}
        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
      />
    </div>
  );
};
