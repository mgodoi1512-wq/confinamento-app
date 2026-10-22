import { useState } from "react";
import { CalendarDays, Check, ChevronRight, Clock3, Wheat } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/app/empty-state";
import { PageLoading } from "@/components/app/page-loading";
import { StatusBadge } from "@/components/app/status-badge";
import { TroughScoreBadge } from "@/components/app/trough-score-info";
import { Button } from "@/components/ui/button";
import type { PenOccupancy, TroughReading } from "@/lib/domain";
import { formatDate, formatNumber } from "@/lib/format";
import { locationName } from "@/lib/location-name";
import { cn } from "@/lib/utils";

export type ReadingOverviewRow = {
  occupancy: PenOccupancy;
  base: number | null;
  reading?: TroughReading;
};

/** Apresentação da ronda; filtros não alteram a sequência de registro nem os ajustes. */
export const ReadingOverview = ({ rows, date, loading, onOpen, lastSavedPen }: {
  rows: ReadingOverviewRow[];
  date: string;
  loading: boolean;
  onOpen: (item: PenOccupancy) => void;
  lastSavedPen: string | null;
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<"all" | "pending" | "read">("all");
  const done = rows.filter(row => row.reading).length;
  const total = rows.length;
  const pending = total - done;
  const visible = rows.filter(row => filter === "all" || (filter === "read" ? Boolean(row.reading) : !row.reading));
  const filters = [
    { value: "all" as const, label: "Todos", count: total },
    { value: "pending" as const, label: "Pendentes", count: pending },
    { value: "read" as const, label: "Lidos", count: done },
  ];

  const status = (row: ReadingOverviewRow) => row.reading ? (
    <span className="inline-flex items-center gap-2">
      <TroughScoreBadge score={row.reading.score} label={`${t("feed.reading.score")} ${row.reading.score}`} />
      <Check aria-hidden="true" className="size-4 text-success" />
      <span className="sr-only">Leitura registrada</span>
    </span>
  ) : <StatusBadge tone="warning" label="Leitura pendente" icon={Clock3} size="sm" />;

  if (loading) return <PageLoading />;

  return (
    <section className="space-y-4" aria-label="Resumo e locais da ronda">
      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm font-medium" aria-live="polite">
            <span className="num text-lg font-semibold">{done}</span> de {total} locais lidos
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-3.5" />{formatDate(date)}
          </span>
        </div>
        <div role="progressbar" aria-label="Progresso da ronda" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={done}
          aria-valuetext={`${done} de ${total} locais lidos`}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
          <div className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", total > 0 && done === total ? "bg-success" : "bg-primary")}
            style={{ width: `${total ? done / total * 100 : 0}%` }} />
        </div>
      </div>

      {total === 0 ? <EmptyState icon={Wheat} titleKey="pens.empty.title" descriptionKey="pens.empty.description" /> : <>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Filtrar leituras" className="flex w-full gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
            {filters.map(item => <Button key={item.value} type="button" size="sm" variant={filter === item.value ? "default" : "ghost"}
              aria-pressed={filter === item.value} aria-controls="reading-locations" onClick={() => setFilter(item.value)}
              className="h-10 min-w-0 flex-1 gap-1.5 px-2 text-xs sm:flex-none sm:px-3 sm:text-sm">
              {item.label}<span className="num opacity-80">{item.count}</span>
            </Button>)}
          </div>
          <p className="text-xs text-muted-foreground">Oferta base em kg/cab · referência para o ajuste da manhã</p>
        </div>

        <div id="reading-locations">
          {visible.length === 0 ? <div role="status" className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {filter === "read" ? "Nenhuma leitura registrada hoje." : "Todos os locais já foram lidos."}
          </div> : <>
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
              <table className="w-full caption-bottom font-sans text-sm">
                <caption className="sr-only">Locais de manejo e leituras de cocho do dia</caption>
                <thead className="border-b border-border bg-muted">
                  <tr className="h-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 text-center">Local de manejo</th>
                    <th scope="col" className="px-3 text-center">Lote</th>
                    <th scope="col" className="px-3 text-center">Oferta base <span className="font-semibold">(kg/cab)</span></th>
                    <th scope="col" className="px-3 text-center">Leitura</th>
                    <th scope="col" className="px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map(row => <tr key={row.occupancy.pen.id} onClick={() => onOpen(row.occupancy)}
                    className={cn("h-11 cursor-pointer transition-colors duration-100 hover:bg-primary/5", lastSavedPen === locationName(row.occupancy.pen) && "bg-success/5")}>
                    <th scope="row" className="px-3 text-center align-middle font-sans text-sm font-semibold">{locationName(row.occupancy.pen)}</th>
                    <td className="px-3 text-center align-middle">{row.occupancy.lot?.code ?? "—"}</td>
                    <td className="num px-3 text-center align-middle font-medium">{formatNumber(row.base, 2)}</td>
                    <td className="px-3 text-center align-middle">{status(row)}</td>
                    <td className="px-3 text-center align-middle"><Button type="button" variant="ghost" size="sm" className="h-9"
                      aria-label={`${row.reading ? "Abrir" : "Registrar"} leitura de ${locationName(row.occupancy.pen)}`}
                      onClick={event => { event.stopPropagation(); onOpen(row.occupancy); }}>
                      {row.reading ? "Abrir" : "Registrar"}<ChevronRight aria-hidden="true" />
                    </Button></td>
                  </tr>)}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {visible.map(row => <article key={row.occupancy.pen.id} onClick={() => onOpen(row.occupancy)}
                className={cn("rounded-xl border border-border bg-card p-3 shadow-xs", lastSavedPen === locationName(row.occupancy.pen) && "ring-2 ring-success/40")}>
                <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${row.reading ? "Abrir" : "Registrar"} leitura de ${locationName(row.occupancy.pen)}`}
                  onClick={event => { event.stopPropagation(); onOpen(row.occupancy); }}>
                  <span className="min-w-0"><span className="block font-semibold">{locationName(row.occupancy.pen)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.occupancy.lot?.code ?? "—"}</span></span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-primary" />
                </button>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">Oferta base <span className="num font-semibold text-foreground">{formatNumber(row.base, 2)} kg/cab</span></span>
                  {status(row)}
                </div>
              </article>)}
            </div>
          </>}
        </div>
      </>}
    </section>
  );
};
