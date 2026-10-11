import { useTranslation } from "react-i18next";

import { toneClasses } from "@/components/app/tone";
import { troughScoreTone } from "@/lib/domain";
import { cn } from "@/lib/utils";

const SCORES = [0, 1, 2, 3, 4, 5];

export type TroughScoreSelectorProps = {
  value: number | null;
  onChange: (score: number) => void;
  className?: string;
};

/** Leitura de cocho 0-5 com ajuste implícito de oferta. */
export const TroughScoreSelector = ({ value, onChange, className }: TroughScoreSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1.5 md:grid-cols-6">
        {SCORES.map((score) => {
          const selected = value === score;
          const tone = troughScoreTone(score);

          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-pressed={selected}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-center transition-[background-color,transform,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] md:min-h-14",
                selected
                  ? toneClasses[tone].solid
                  : "text-muted-foreground hover:bg-background",
              )}
            >
              <span className="font-display text-lg font-semibold num">{score}</span>
              <span className="text-[10px] leading-tight">{t(`trough.score.${score}`)}</span>
            </button>
          );
        })}
      </div>
      {value !== null ? (
        <p className="text-xs text-muted-foreground">{t(`trough.score.${value}.hint`)}</p>
      ) : null}
    </div>
  );
};
