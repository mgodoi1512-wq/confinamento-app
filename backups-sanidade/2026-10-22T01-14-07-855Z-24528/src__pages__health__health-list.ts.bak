import type { Animal, HealthEvent, Lot } from "@/lib/domain";
import { withdrawalDaysLeft } from "@/lib/domain";

export type HealthFiltersValue = { search: string; lot: string; from: string; to: string; situation: string };
export const emptyHealthFilters = (): HealthFiltersValue => ({ search: "", lot: "all", from: "", to: "", situation: "all" });
export const hasHealthFilters = (value: HealthFiltersValue) =>
  Boolean(value.search.trim() || value.lot !== "all" || value.from || value.to || value.situation !== "all");
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export const filterHealthEvents = (
  events: HealthEvent[],
  filters: HealthFiltersValue,
  animals: Map<string, Animal>,
  lots: Map<string, Lot>,
  mode: "treatments" | "occurrences",
  today: string,
) => events.filter(event => {
  if (filters.from && filters.to && filters.from > filters.to) return false;
  if (filters.from && event.event_date < filters.from) return false;
  if (filters.to && event.event_date > filters.to) return false;
  if (filters.lot !== "all" && event.lot_id !== filters.lot) return false;
  const situation = mode === "occurrences"
    ? event.kind === "obito" ? "death" : "clinical"
    : !event.withdrawal_until ? "unknown" : withdrawalDaysLeft(event, today) > 0 ? "active" : "ended";
  if (filters.situation !== "all" && filters.situation !== situation) return false;
  const search = normalize(filters.search);
  const text = [event.animal_id ? animals.get(event.animal_id)?.ear_tag : "", event.lot_id ? lots.get(event.lot_id)?.code : "", event.product, event.diagnosis, event.notes].filter(Boolean).join(" ");
  return !search || normalize(text).includes(search);
});

