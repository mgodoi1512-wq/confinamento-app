import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const pad = (value: number) => String(value).padStart(2, "0");
const toIso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
const parse = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) - 1, day: Number(value.slice(8, 10)) }
  : null;
const show = (value: string) => { const parsed = parse(value); return parsed ? `${pad(parsed.day)}/${pad(parsed.month + 1)}/${parsed.year}` : "Selecionar data"; };

/**
 * Campo de data com calendário sempre em português (o seletor nativo do navegador/celular
 * segue o idioma do aparelho). Recebe e devolve datas no formato AAAA-MM-DD.
 */
export function DateField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const today = toIso(now.getFullYear(), now.getMonth(), now.getDate());
  const openChange = (next: boolean) => {
    if (next) { const parsed = parse(value); setView({ year: parsed?.year ?? now.getFullYear(), month: parsed?.month ?? now.getMonth() }); }
    setOpen(next);
  };
  const move = (delta: number) => setView(current => { const total = current.year * 12 + current.month + delta; return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }; });
  const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const pick = (day: number) => { onChange(toIso(view.year, view.month, day)); setOpen(false); };

  return (
    <div className="min-w-0 space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <Popover open={open} onOpenChange={openChange}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} aria-label={`${label}: ${show(value)}`} className="w-full justify-between font-normal">
            {show(value)}<CalendarDays className="size-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Mês anterior" onClick={() => move(-1)}><ChevronLeft className="size-4" /></Button>
            <span className="text-sm font-medium capitalize">{MONTHS[view.month]} de {view.year}</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Próximo mês" onClick={() => move(1)}><ChevronRight className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">{WEEKDAYS.map(weekday => <span key={weekday} className="py-1">{weekday}</span>)}</div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, index) => day === null
              ? <span key={`vazio-${index}`} />
              : (
                <button
                  key={day} type="button" onClick={() => pick(day)}
                  className={cn(
                    "h-9 rounded-md text-sm hover:bg-accent",
                    toIso(view.year, view.month, day) === today && "border border-primary/50",
                    toIso(view.year, view.month, day) === value && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >{day}</button>
              ))}
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(today); setOpen(false); }}>Hoje</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
