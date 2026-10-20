import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Portal } from "@radix-ui/react-tooltip";

import { StatusBadge } from "@/components/app/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { troughScoreTone } from "@/lib/domain";

/** A legenda vem da mesma escala utilizada no formulário de leitura. */
export const TroughScoreTooltip = ({ score, children, open, onOpenChange }: {
  score: number;
  children: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { t } = useTranslation();
  return (
    <Tooltip delayDuration={150} open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <Portal>
        <TooltipContent side="top" sideOffset={8} className="z-[100] max-w-[min(18rem,calc(100vw-2rem))] space-y-1 px-3 py-2">
          <p className="font-semibold">{t("feed.reading.score")} {score} · {t(`trough.score.${score}`)}</p>
          <p className="text-xs">{score === 0 ? "Sem sobra (0%). " : ""}{t(`trough.score.${score}.hint`)}</p>
        </TooltipContent>
      </Portal>
    </Tooltip>
  );
};

/** Foco e mouse mostram a legenda; toque no selo também abre o balão. */
export const TroughScoreBadge = ({ score, label }: { score: number; label: string }) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <TroughScoreTooltip score={score} open={open} onOpenChange={setOpen}>
      <span tabIndex={0} className="inline-flex cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${label}. ${t(`trough.score.${score}`)}. ${t(`trough.score.${score}.hint`)}`}
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
        <StatusBadge tone={troughScoreTone(score)} label={label} size="sm" />
      </span>
    </TroughScoreTooltip>
  );
};
