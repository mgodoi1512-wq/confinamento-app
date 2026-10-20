import type { FeedLog } from "./domain";

type DailyFeeding = { suppliedKg: number; shifts: { total: number; complete: boolean }[] };

/** Iniciado inclui concluídos; conclusão considera todos os períodos previstos. */
export function summarizeDashboardFeeding(states: DailyFeeding[]) {
  const expected = states.filter(state => state.shifts.some(shift => shift.total > 0));
  return {
    total: expected.length,
    started: expected.filter(state => state.suppliedKg > 0).length,
    completed: expected.filter(state => {
      const shifts = state.shifts.filter(shift => shift.total > 0);
      return state.suppliedKg > 0 && shifts.every(shift => shift.complete);
    }).length,
  };
}

/** Ordena pela criação, mantendo a data operacional como filtro do dia. */
export function recentDashboardFeed<T extends Pick<FeedLog, "id" | "date" | "created_at">>(logs: T[], date: string, limit = 6): T[] {
  const timestamp = (value: string) => { const n = Date.parse(value); return Number.isFinite(n) ? n : 0; };
  return logs.filter(log => log.date === date).sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at) || a.id.localeCompare(b.id)).slice(0, limit);
}
