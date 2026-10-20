import { useDailyFeedPlans } from "@/hooks/use-feed-planning";
import { useDiets, useDietItems } from "@/hooks/use-diets";
import { useFeedLogs } from "@/hooks/use-feed";
import { useLots } from "@/hooks/use-lots";
import { useWeighings } from "@/hooks/use-weighings";
import { computePenDailyFeeding } from "@/lib/domain";
import { todayIso } from "@/lib/format";

export const usePenFeeding = () => {
  const lots = useLots(), logs = useFeedLogs(), diets = useDiets(), items = useDietItems(), weights = useWeighings();
  const date = todayIso();
  const plans = useDailyFeedPlans(date);
  const queries = [lots, logs, diets, items, weights, plans];
  const error = queries.some(query => query.isError);
  const ready = queries.every(query => query.isSuccess) && !error;
  return { date, error, ready, forPen: (id: string) => ready ? computePenDailyFeeding(id, lots.data ?? [], logs.data ?? [], diets.data ?? [], items.data ?? [], weights.data ?? [], date, plans.data ?? []) : null };
};
