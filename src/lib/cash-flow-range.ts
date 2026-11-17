import type { CashEntry, WorkspaceSettings } from "./financial-workspace";
import type { ExportReport } from "./export-data";
import type { CashPdfData } from "./cash-flow-pdf";

/**
 * Fluxo de caixa por intervalo livre (data inicial e final) com subtotais por semana ou por mês.
 * Código puro: não importa nada em tempo de execução, para poder ser testado isoladamente.
 * Regras iguais às da tela: realizados entram pela data do pagamento/recebimento e
 * pendentes pela data prevista ou vencimento; saldo de abertura e entradas/saídas seguem cashSummary.
 */
export type RangeGroup = "semana" | "mes" | "nenhum";
export type RangeOptions = { from: string; to: string; group: RangeGroup };
export type RangeInterval = {
  label: string; from: string; to: string;
  income: number; expenses: number; net: number;
  receivable: number; payable: number;
  count: number; balanceEnd: number;
};
export type CashRange = {
  from: string; to: string; group: RangeGroup;
  opening: number; closing: number;
  income: number; expenses: number; net: number;
  receivable: number; payable: number;
  intervals: RangeInterval[];
};

export const MAX_RANGE_DAYS = 732;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => { const date = toDate(iso); date.setUTCDate(date.getUTCDate() + days); return toIso(date); };
const dayDiff = (from: string, to: string) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fullDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const lastDayOfMonth = (iso: string) => toIso(new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)));
const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value).replace(/ /g, " ");

export const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toIso(toDate(value)) === value;

/** Mensagem de erro para o intervalo informado, ou null quando é válido. */
export function checkRange(from: string, to: string): string | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return "Informe a data inicial e a data final.";
  if (from > to) return "A data inicial deve ser anterior ou igual à data final.";
  if (dayDiff(from, to) + 1 > MAX_RANGE_DAYS) return "O intervalo pode ter no máximo 24 meses.";
  return null;
}

/** Divide o intervalo em semanas (a partir da data inicial) ou em meses do calendário. */
export function splitRange(from: string, to: string, group: RangeGroup) {
  if (group === "nenhum") return [{ from, to, label: `${fullDate(from)} a ${fullDate(to)}` }];
  const parts: { from: string; to: string; label: string }[] = [];
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const show = (iso: string) => (sameYear ? dayMonth(iso) : fullDate(iso));
  let cursor = from;
  while (cursor <= to) {
    let end: string;
    let label: string;
    if (group === "semana") {
      end = addDays(cursor, 6) < to ? addDays(cursor, 6) : to;
      label = cursor === end ? show(cursor) : `${show(cursor)} a ${show(end)}`;
    } else {
      const monthEnd = lastDayOfMonth(cursor);
      end = monthEnd < to ? monthEnd : to;
      const name = `${MONTHS[Number(cursor.slice(5, 7)) - 1]}/${cursor.slice(0, 4)}`;
      const partial = cursor.slice(8, 10) !== "01" || end !== monthEnd;
      label = partial ? `${name} (${dayMonth(cursor)} a ${dayMonth(end)})` : name;
    }
    parts.push({ from: cursor, to: end, label });
    cursor = addDays(end, 1);
  }
  return parts;
}

/** Lançamentos do intervalo (realizados pela data de realização, pendentes pela data prevista), em ordem cronológica. */
export function rangeEntries(entries: CashEntry[], from: string, to: string) {
  const key = (entry: CashEntry) => entry.settled_on ?? entry.due_date;
  return entries
    .filter(entry => key(entry) >= from && key(entry) <= to)
    .sort((a, b) => key(a).localeCompare(key(b)) || a.id.localeCompare(b.id));
}

export function summarizeRange(entries: CashEntry[], settings: WorkspaceSettings | null, options: RangeOptions): CashRange {
  const { from, to, group } = options;
  const config = settings?.cash_configured === false ? null : settings;
  const signed = (entry: CashEntry) => (entry.direction === "entrada" ? entry.amount : -entry.amount);
  const total = (list: CashEntry[]) => list.reduce((sum, entry) => sum + entry.amount, 0);
  const openingDate = config?.opening_date ?? from;
  const eligible = entries.filter(entry => entry.settled_on && entry.settled_on >= openingDate);
  const opening = round(
    (openingDate <= to ? (config?.opening_balance ?? 0) : 0)
    + eligible.filter(entry => (entry.settled_on as string) < from).reduce((sum, entry) => sum + signed(entry), 0),
  );
  let running = opening;
  const intervals: RangeInterval[] = splitRange(from, to, group).map(part => {
    const realized = eligible.filter(entry => (entry.settled_on as string) >= part.from && (entry.settled_on as string) <= part.to);
    const pending = entries.filter(entry => !entry.settled_on && entry.due_date >= part.from && entry.due_date <= part.to);
    const income = round(total(realized.filter(entry => entry.direction === "entrada")));
    const expenses = round(total(realized.filter(entry => entry.direction === "saida")));
    const net = round(income - expenses);
    running = round(running + net);
    return {
      label: part.label, from: part.from, to: part.to, income, expenses, net,
      receivable: round(total(pending.filter(entry => entry.direction === "entrada"))),
      payable: round(total(pending.filter(entry => entry.direction === "saida"))),
      count: rangeEntries(entries, part.from, part.to).length,
      balanceEnd: running,
    };
  });
  const sum = (pick: (interval: RangeInterval) => number) => round(intervals.reduce((acc, interval) => acc + pick(interval), 0));
  return {
    from, to, group, opening, closing: running,
    income: sum(i => i.income), expenses: sum(i => i.expenses), net: sum(i => i.net),
    receivable: sum(i => i.receivable), payable: sum(i => i.payable),
    intervals,
  };
}

/** Relatório (Excel/PDF) do intervalo: mesma tabela de lançamentos da tela, mais o resumo por intervalo. */
export function buildCashFlowRange(
  entries: CashEntry[],
  settings: WorkspaceSettings | null,
  options: RangeOptions,
  helpers: { lotName: (id: string | null) => string; today?: string },
): { report: ExportReport; pdf: CashPdfData } {
  const today = helpers.today ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const range = summarizeRange(entries, settings, options);
  const list = rangeEntries(entries, options.from, options.to);
  const status = (entry: CashEntry) => entry.settled_on ? (entry.direction === "entrada" ? "Recebido" : "Pago") : entry.due_date < today ? "Em atraso" : "Pendente";
  const period = `${fullDate(options.from)} a ${fullDate(options.to)}`;
  const grouping = options.group === "semana" ? "subtotais por semana" : options.group === "mes" ? "subtotais por mês" : "sem subtotais";
  const filters = `Período: ${period}; ${grouping}; toda a fazenda, sem filtro de categoria ou lote`;
  const note = `Saldo de abertura do período: ${brl(range.opening)}. Entradas recebidas: ${brl(range.income)}. Saídas pagas: ${brl(range.expenses)}. Saldo realizado ao fim do período: ${brl(range.closing)}. A receber no período: ${brl(range.receivable)}. A pagar no período: ${brl(range.payable)}. Realizados são agrupados pela data do pagamento/recebimento; pendentes pela data prevista de recebimento ou vencimento. Pendências vencidas antes do início do período não entram.`;
  const report: ExportReport = {
    title: "Fluxo de caixa",
    filename: `fluxo-de-caixa-${options.from}-a-${options.to}`,
    filters, note, cashRange: range, recordCount: list.length,
    columns: [
      { title: "Data / vencimento" }, { title: "Pagamento/recebimento" }, { title: "Descrição" }, { title: "Categoria" },
      { title: "Lote" }, { title: "Tipo" }, { title: "Valor (R$)", decimals: 2 }, { title: "Situação" }, { title: "Observações" },
    ],
    rows: list.map(entry => [
      fullDate(entry.due_date), entry.settled_on ? fullDate(entry.settled_on) : "—", entry.description, entry.category,
      helpers.lotName(entry.lot_id), entry.direction === "entrada" ? "Entrada" : "Saída", entry.amount, status(entry), entry.notes,
    ]),
  };
  const pdf: CashPdfData = {
    month: options.from.slice(0, 7), periodLabel: period, range, filters,
    summary: { opening: range.opening, income: range.income, expenses: range.expenses, actual: range.closing },
    entries: list.map(entry => ({ ...entry, lotLabel: entry.lot_id ? helpers.lotName(entry.lot_id) : "" })),
  };
  return { report, pdf };
}
