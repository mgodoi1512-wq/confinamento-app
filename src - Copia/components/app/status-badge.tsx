import type { LucideIcon } from "lucide-react";

import { toneClasses } from "@/components/app/tone";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/domain";

export type StatusBadgeProps = {
  tone: Tone;
  label: string;
  icon?: LucideIcon;
  size?: "sm" | "md";
  solid?: boolean;
  pulse?: boolean;
  className?: string;
};

export const StatusBadge = ({
  tone,
  label,
  icon: Icon,
  size = "md",
  solid = false,
  pulse = false,
  className,
}: StatusBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap",
      size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      solid ? toneClasses[tone].solid : toneClasses[tone].tinted,
      className,
    )}
  >
    {Icon ? (
      <Icon className={cn("shrink-0", size === "sm" ? "size-3" : "size-3.5")} />
    ) : (
      <span className={cn("size-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
    )}
    {label}
  </span>
);
