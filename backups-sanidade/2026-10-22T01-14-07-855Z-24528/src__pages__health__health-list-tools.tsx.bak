import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Portal } from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { HealthEvent, Lot } from "@/lib/domain";
import { withdrawalDaysLeft } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { emptyHealthFilters, hasHealthFilters, type HealthFiltersValue } from "./health-list";

/** Filtros só da lista: os indicadores mantêm o escopo descrito em cada página. */
export const HealthListFilters = ({ value, onChange, lots, mode, count, total }: {
  value: HealthFiltersValue;
  onChange: (value: HealthFiltersValue) => void;
  lots: Lot[];
  mode: "treatments" | "occurrences";
  count: number;
  total: number;
}) => {
  const { t } = useTranslation();
  const update = (key: keyof HealthFiltersValue, next: string) => onChange({ ...value, [key]: next });
  const invalidPeriod = Boolean(value.from && value.to && value.from > value.to);
  const lotOptions = [...lots].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  return (
    <section aria-label={t("Filtrar registros")} className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1.5fr)_minmax(140px,1fr)_minmax(160px,1fr)_150px_150px] [&>div]:min-w-0 [&_label]:text-xs [&_input]:h-10">
        <TextField label={t("Buscar registros")} placeholder={t(mode === "treatments" ? "Brinco, lote ou produto" : "Brinco, lote ou descrição")} value={value.search} onChange={next => update("search", next)} />
        <SelectField label={t("field.lot")} value={value.lot} onChange={next => update("lot", next)} triggerClassName="h-10" options={[{ value: "all", labelKey: "Todos" }, ...lotOptions.map(lot => ({ value: lot.id, labelKey: lot.code }))]} />
        <SelectField label={t(mode === "treatments" ? "Carência do registro" : "Tipo de ocorrência")} value={value.situation} onChange={next => update("situation", next)} triggerClassName="h-10" options={mode === "treatments"
          ? [{ value: "all", labelKey: "Todas" }, { value: "active", labelKey: "Em carência" }, { value: "ended", labelKey: "Prazo encerrado" }, { value: "unknown", labelKey: "Sem prazo informado" }]
          : [{ value: "all", labelKey: "Todos" }, { value: "clinical", labelKey: "Caso clínico" }, { value: "death", labelKey: "Óbito" }]} />
        <TextField label={t("Data inicial")} type="date" value={value.from} onChange={next => update("from", next)} />
        <TextField label={t("Data final")} type="date" value={value.to} onChange={next => update("to", next)} />
      </div>
      {invalidPeriod && <p role="alert" className="text-xs text-destructive">{t("A data final deve ser igual ou posterior à data inicial.")}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{count} {t("de")} {total} {t("registros · filtros aplicados somente à lista")}</p>
        {hasHealthFilters(value) && <Button variant="ghost" size="sm" className="h-10" onClick={() => onChange(emptyHealthFilters())}>{t("Limpar filtros")}</Button>}
      </div>
    </section>
  );
};

/** O prazo é o do evento, sem declarar o animal apto nem ignorar outras aplicações. */
export const WithdrawalSummary = ({ event, today }: { event: HealthEvent; today: string }) => {
  const { t } = useTranslation();
  if (!event.withdrawal_until) return <span className="text-xs text-muted-foreground">{t("Sem prazo informado")}</span>;
  const remaining = withdrawalDaysLeft(event, today);
  return (
    <div className="space-y-1 py-2">
      <p className="text-xs">{t("Carência até")} <span className="num">{formatDate(event.withdrawal_until)}</span></p>
      <StatusBadge size="sm" tone={remaining > 0 ? "warning" : "muted"}
        label={remaining > 0 ? t(remaining === 1 ? "Falta 1 dia" : "Faltam {{count}} dias", { count: remaining }) : t("Prazo encerrado")} />
    </div>
  );
};

export const HealthMetricHelp = ({ label, children }: { label: string; children: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
        <TooltipTrigger asChild>
          <button type="button" aria-label={label} onClick={event => { event.preventDefault(); setOpen(true); }}
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:right-5 md:top-5">
            <Info className="size-4" />
          </button>
        </TooltipTrigger>
        <Portal>
          <TooltipContent side="top" align="end" sideOffset={8} collisionPadding={16} className="z-[100] max-w-[min(22rem,calc(100vw-2rem))] text-xs leading-relaxed">
            {children}
          </TooltipContent>
        </Portal>
      </Tooltip>
    </TooltipProvider>
  );
};
