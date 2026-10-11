import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Weighing, WeightRecord } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";
import { animalsQueryKey } from "@/hooks/use-animals";
import { lotsQueryKey } from "@/hooks/use-lots";

type WeighingInsert = Database["public"]["Tables"]["weighings"]["Insert"];

export const weighingsQueryKey = ["weighings"] as const;
export const weightRecordsQueryKey = ["weight-records"] as const;

export const useWeighings = () =>
  useQuery({
    queryKey: weighingsQueryKey,
    queryFn: async (): Promise<Weighing[]> => {
      const { data, error } = await supabase
        .from("weighings")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useWeightRecords = () =>
  useQuery({
    queryKey: weightRecordsQueryKey,
    queryFn: async (): Promise<WeightRecord[]> => {
      const { data, error } = await supabase.from("weight_records").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useSaveWeighing = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      weighing,
      records,
    }: {
      weighing: WeighingInsert;
      records: { animal_id: string; weight_kg: number }[];
    }) => {
      const created = await supabase.from("weighings").insert(weighing).select().single();
      if (created.error) throw created.error;

      if (records.length > 0) {
        const inserted = await supabase
          .from("weight_records")
          .insert(records.map((record) => ({ ...record, weighing_id: created.data.id })));
        if (inserted.error) throw inserted.error;

        for (const record of records) {
          const updated = await supabase
            .from("animals")
            .update({ current_weight_kg: record.weight_kg })
            .eq("id", record.animal_id);
          if (updated.error) throw updated.error;
        }
      }

      return created.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: weighingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: weightRecordsQueryKey });
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey });
    },
  });
};

export const useDeleteWeighing = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weighings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: weighingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: weightRecordsQueryKey });
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey });
    },
  });
};
