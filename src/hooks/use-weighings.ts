import { fetchAll } from "@/lib/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Weighing, WeightRecord } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";
import { mutateApp } from "@/lib/mutations";

type WeighingInsert = Database["public"]["Tables"]["weighings"]["Insert"];

export const weighingsQueryKey = ["weighings"] as const;
export const weightRecordsQueryKey = ["weight-records"] as const;

export const useWeighings = () =>
  useQuery({
    queryKey: weighingsQueryKey,
    queryFn: () => fetchAll<Weighing>(() => supabase
        .from("weighings")
        .select("*")
        .order("date", { ascending: false }).order("id")),
  });

export const useWeightRecords = () =>
  useQuery({
    queryKey: weightRecordsQueryKey,
    queryFn: () => fetchAll<WeightRecord>(() => supabase.from("weight_records").select("*").order("id")),
  });

export const useSaveWeighing = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { weighing: WeighingInsert; records: { animal_id: string; weight_kg: number }[]; requestId: string }) =>
      mutateApp<Weighing>("save_weighing", payload, payload.requestId),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};
export const useDeleteWeighing = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mutateApp("delete_weighing", { id }, crypto.randomUUID()),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};

export type WeightCorrectionResult = {
  weighingId: string;
  weighingDeleted: boolean;
  headCount: number;
  avgWeight: number | null;
};
export type WeightCorrectionPayload = {
  record: WeightRecord;
  count: number;
  weight: number;
  requestId: string;
};
export const useCorrectWeightRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WeightCorrectionPayload): Promise<WeightCorrectionResult> => {
      const { data, error } = await supabase.rpc("app_correct_weight_record", {
        p_record_id: payload.record.id,
        p_weight: payload.weight,
        p_delete: false,
        p_remove_empty: false,
        p_expected_weight: payload.record.weight_kg,
        p_expected_count: payload.count,
        p_request_id: payload.requestId,
      });
      if (error) throw new Error(error.message);
      return data as WeightCorrectionResult;
    },
    // Erro também pode indicar dados alterados por outro operador; atualizar a tela.
    onSettled: () => { void client.invalidateQueries(); },
  });
};
