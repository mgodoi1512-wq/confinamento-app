import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  titleKey: string;
  subtitleKey?: string;
  actions?: ReactNode;
  className?: string;
};

export const PageHeader = ({ titleKey, subtitleKey, actions, className }: PageHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {t(titleKey)}
        </h1>
        {subtitleKey ? (
          <p className="text-sm text-muted-foreground">{t(subtitleKey)}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
};
