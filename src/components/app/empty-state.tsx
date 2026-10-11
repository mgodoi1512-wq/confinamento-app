import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon?: LucideIcon;
  titleKey: string;
  descriptionKey?: string;
  action?: ReactNode;
  className?: string;
};

export const EmptyState = ({
  icon: Icon = Inbox,
  titleKey,
  descriptionKey,
  action,
  className,
}: EmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/50 p-8 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="font-display text-lg font-semibold">{t(titleKey)}</p>
      {descriptionKey ? (
        <p className="max-w-sm text-sm text-muted-foreground">{t(descriptionKey)}</p>
      ) : null}
      {action}
    </div>
  );
};
