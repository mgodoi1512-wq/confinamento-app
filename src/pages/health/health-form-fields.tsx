import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Portal } from "@radix-ui/react-tooltip";
import { Check, ChevronsUpDown, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Animal, Lot, Pen } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { locationName } from "@/lib/location-name";
import { parseWithdrawalDays } from "./health-form";

/** Busca local por brinco, lote ou local, com seleção por teclado e toque. */
export const HealthAnimalField = ({ animals, lots, pens, value, onChange, error }: {
  animals: Animal[]; lots: Lot[]; pens: Pen[]; value: string; onChange: (id: string) => void; error?: string;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const id = useId();
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const options = useMemo(() => animals.filter(animal => animal.status === "ativo" || animal.status === "tratamento")
    .sort((a, b) => a.ear_tag.localeCompare(b.ear_tag, "pt-BR", { numeric: true })), [animals]);
  const context = (animal: Animal) => [
    lots.find(lot => lot.id === animal.lot_id)?.code ?? "—",
    locationName(pens.find(pen => pen.id === animal.pen_id), "—"),
  ].join(" · ");
  const selected = options.find(animal => animal.id === value);
  const matches = options.filter(animal => normalize(animal.ear_tag + " " + context(animal)).includes(normalize(search)));
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{t("Animal")} <span className="text-destructive">*</span></label>
      <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-controls={id + "-options"} aria-required="true" aria-invalid={Boolean(error)} aria-describedby={error ? id + "-error" : selected ? id + "-context" : undefined}
            className="h-11 w-full min-w-0 justify-between gap-2 px-3 text-left font-normal">
            <span className="min-w-0 truncate">{selected?.ear_tag ?? t("Selecione pelo brinco")}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent id={id + "-options"} align="start" collisionPadding={12} className="z-[110] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
          <Command label={t("Buscar animal por brinco")} shouldFilter={false}>
            <CommandInput aria-label={t("Buscar animal por brinco")} placeholder={t("Brinco, lote ou local")} value={search} onValueChange={setSearch} />
            <CommandList className="max-h-[min(260px,var(--radix-popover-content-available-height))]">
              <CommandEmpty>{t("Nenhum animal disponível para essa busca.")}</CommandEmpty>
              {matches.slice(0, 100).map(animal => (
                <CommandItem key={animal.id} value={animal.id} onSelect={() => { onChange(animal.id); setOpen(false); setSearch(""); }} className="min-h-12 gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><span className="block font-medium">{animal.ear_tag}</span><span className="block text-xs text-muted-foreground">{context(animal)}</span></span>
                  {value === animal.id && <Check className="size-4 shrink-0" />}
                </CommandItem>
              ))}
            </CommandList>
            {matches.length > 100 && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{t("Mostrando os primeiros 100. Digite para refinar a busca.")}</p>}
          </Command>
        </PopoverContent>
      </Popover>
      {selected && <p id={id + "-context"} className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{context(selected)}</p>}
      {error && <p id={id + "-error"} role="alert" className="text-xs text-destructive">{t(error)}</p>}
    </div>
  );
};

/** Ajuda fora do recorte do modal e prazo explícito, inclusive quando é zero. */
export const WithdrawalDaysField = ({ value, onChange, until, error }: {
  value: string; onChange: (value: string) => void; until: string | null; error?: string;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">{t("Carência (dias)")} <span className="text-destructive">*</span></label>
        <TooltipProvider>
          <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
            <TooltipTrigger asChild><button type="button" aria-label={t("Como preencher a carência?")} onClick={event => { event.preventDefault(); setOpen(true); }} className="relative inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground outline-none before:absolute before:-inset-2 focus-visible:ring-2 focus-visible:ring-ring"><Info className="size-3.5" /></button></TooltipTrigger>
            <Portal><TooltipContent side="top" align="end" sideOffset={8} collisionPadding={16} className="z-[120] max-w-[min(22rem,calc(100vw-2rem))] text-xs leading-relaxed">{t("Informe o prazo indicado na bula para a finalidade de uso. Preencha 0 somente quando a carência for zero. O sistema não define esse prazo automaticamente.")}</TooltipContent></Portal>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input id={id} value={value} onChange={event => onChange(event.target.value)} type="text" inputMode="numeric" autoComplete="off" placeholder={t("Informe os dias")} aria-required="true" aria-invalid={Boolean(error)} aria-describedby={id + "-hint"} />
      <p id={id + "-hint"} role={error ? "alert" : "status"} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {error ? t(error) : parseWithdrawalDays(value) === 0 ? t("Carência informada: 0 dias.") : until ? t("Carência até {{date}}", { date: formatDate(until) }) : t("Informe o prazo; vazio não significa zero.")}
      </p>
    </div>
  );
};
