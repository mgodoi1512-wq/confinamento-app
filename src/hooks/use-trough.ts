import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TroughReading } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type TroughReadingInsert = Database["public"]["Tables"]["trough_readings"]["Insert"];

export const troughReadingsQueryKey = ["trough-readings"] as const;

export const useTroughReadings = () =>
  useQuery({
    queryKey: troughReadingsQueryKey,
    queryFn: async (): Promise<TroughReading[]> => {
      const { data, error } = await supabase
        .from("trough_readings")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useSaveTroughReading = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TroughReadingInsert) => {
      const { error } = await supabase.from("trough_readings").insert(payload);
      if (error) throw error;
      return payload;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: troughReadingsQueryKey });
    },
  });
};
