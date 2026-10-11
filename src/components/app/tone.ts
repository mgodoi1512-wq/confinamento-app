import type { Tone } from "@/lib/domain";

/** Classes literais por tom — necessárias para o Tailwind gerar as variantes. */
export const toneClasses: Record<Tone, { tinted: string; solid: string }> = {
  success: {
    tinted: "bg-success/12 text-success",
    solid: "bg-success text-success-foreground",
  },
  warning: {
    tinted: "bg-warning/15 text-warning",
    solid: "bg-warning text-warning-foreground",
  },
  info: {
    tinted: "bg-info/12 text-info",
    solid: "bg-info text-info-foreground",
  },
  destructive: {
    tinted: "bg-destructive/12 text-destructive",
    solid: "bg-destructive text-destructive-foreground",
  },
  agro: {
    tinted: "bg-agro/12 text-agro",
    solid: "bg-agro text-agro-foreground",
  },
  primary: {
    tinted: "bg-primary/12 text-primary",
    solid: "bg-primary text-primary-foreground",
  },
  muted: {
    tinted: "bg-muted text-muted-foreground",
    solid: "bg-muted text-muted-foreground",
  },
};
