import { mutateApp } from "@/lib/mutations";
import { fetchAll } from "@/lib/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TroughReading } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type TroughReadingInsert = Database["public"]["Tables"]["trough_readings"]["Insert"];

export const troughReadingsQueryKey = ["trough-readings"] as const;

export const useTroughReadings = () =>
  useQuery({
    queryKey: troughReadingsQueryKey,
    queryFn: () => fetchAll<TroughReading>(() => supabase
        .from("trough_readings")
        .select("*")
        .order("date", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false })),
  });

export const useSaveTroughReading = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TroughReadingInsert & { base_kg_per_head: number }) => mutateApp("save_reading", payload, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: troughReadingsQueryKey });
    },
  });
};

export type ReadingApplicationResult = {
  created: number;
  alreadyApplied: number;
  zeroAdjustment: number;
};

export const useApplyReadings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (date: string): Promise<ReadingApplicationResult> => {
      const { data, error } = await supabase.rpc("app_apply_readings", {
        p_date: date, p_request_id: crypto.randomUUID(),
      });
      if (error) throw new Error(error.message);
      return data as ReadingApplicationResult;
    },
    onSuccess: () => { void client.invalidateQueries(); },
  });
};
