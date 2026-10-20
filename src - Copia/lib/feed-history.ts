import type { FeedLog } from "./domain";
export type FeedHistoryFilters = {from: string; to: string; pen: string; shift: string};
export function filterFeedHistory<T extends Pick<FeedLog,"id"|"date"|"created_at"|"pen_id"|"shift">>(logs: T[], filters: FeedHistoryFilters): T[] {
  if(filters.from && filters.to && filters.from > filters.to) return [];
  const timestamp = (value: string) => {const n=Date.parse(value);return Number.isFinite(n)?n:0;};
  return logs.filter(log => (!filters.from || log.date >= filters.from) && (!filters.to || log.date <= filters.to)
    && (filters.pen === "all" || log.pen_id === filters.pen) && (filters.shift === "all" || log.shift === filters.shift))
    .sort((a,b) => b.date.localeCompare(a.date) || timestamp(b.created_at)-timestamp(a.created_at) || a.id.localeCompare(b.id));
}
