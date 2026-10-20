import { computeGmd, type Lot, type Weighing } from "./domain";
import { daysBetween, formatDate, todayIso } from "./format";

export function weighingGmd(weighing: Weighing, lot: Lot | null, weighings: Weighing[], today = todayIso()): {
  gmd: number | null; reason: string; reference?: "entry" | "previous";
} {
  if (!lot) return { gmd: null, reason: "Lote de referência não disponível." };
  if (weighing.date > today) return { gmd: null, reason: "Pesagem com data futura." };
  if (weighing.date < lot.entry_date) return { gmd: null, reason: "Pesagem anterior à entrada do lote atual." };
  const previous = weighings.filter(item => item.lot_id === lot.id && item.date >= lot.entry_date && item.date < weighing.date)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id.localeCompare(a.id))[0];
  const fromDate = previous?.date ?? lot.entry_date;
  const fromWeight = previous?.avg_weight_kg ?? lot.entry_avg_weight_kg;
  const days = daysBetween(fromDate, weighing.date);
  const reference = previous ? "previous" : "entry";
  if (days <= 0) return { gmd: null, reference, reason: "É necessário pelo menos um dia entre a referência e a pesagem." };
  const gmd = computeGmd(fromWeight, weighing.avg_weight_kg, days);
  if (gmd === null) return { gmd, reference, reason: "Informe pesos médios válidos na referência e na pesagem." };
  return { gmd, reference, reason: `GMD do lote: (${weighing.avg_weight_kg} − ${fromWeight}) ÷ ${days} dias. Referência: ${previous ? "pesagem anterior" : "entrada do lote"}, de ${formatDate(fromDate)} a ${formatDate(weighing.date)}. Unidade: kg/dia.` };
}
