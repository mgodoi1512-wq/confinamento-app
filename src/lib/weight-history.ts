import type { Lot, Weighing } from "./domain";

/** Um ponto por data: entrada e última sessão registrada em cada dia. */
export function weightHistory(lot: Lot | null, sessions: Weighing[], today: string) {
  const points = new Map<string, {date: string; weight: number; projection: number | null}>();
  if (lot && lot.entry_date <= today && lot.entry_avg_weight_kg > 0) {
    points.set(lot.entry_date, {date: lot.entry_date, weight: lot.entry_avg_weight_kg, projection: null});
  }
  const ordered = sessions.filter(item => (!lot || item.lot_id === lot.id) && item.date <= today &&
    (!lot || item.date >= lot.entry_date) && item.avg_weight_kg > 0)
    .sort((a,b) => a.date.localeCompare(b.date) || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  for (const item of ordered) points.set(item.date, {date: item.date, weight: item.avg_weight_kg, projection: null});
  return [...points.values()].sort((a,b) => a.date.localeCompare(b.date));
}
