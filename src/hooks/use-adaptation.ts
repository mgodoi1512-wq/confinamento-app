import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchAll } from "@/lib/query";
import type { AdaptationInput } from "@/lib/adaptation";

export type AdaptationPlan = Database["public"]["Tables"]["adaptation_plans"]["Row"];
const queryKey = ["adaptation-plans"] as const;
export const useAdaptationPlans = () => useQuery({
  queryKey,
  queryFn: () => fetchAll<AdaptationPlan>(() => supabase.from("adaptation_plans").select("*").order("updated_at", { ascending: false }).order("id")),
});
export const useSaveAdaptation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { lotId: string; parameters: AdaptationInput; expectedUpdatedAt: string | null }) => {
      const { data, error } = await supabase.rpc("app_save_adaptation", {
        p_lot_id: input.lotId, p_parameters: input.parameters as unknown as Json, p_expected_updated_at: input.expectedUpdatedAt,
      });
      if (error) throw new Error(error.message);
      return data as unknown as AdaptationPlan;
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey }); },
  });
};

export const useDeleteAdaptation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; expectedUpdatedAt: string }) => {
      const { error } = await supabase.rpc("app_delete_adaptation", { p_id: input.id, p_expected_updated_at: input.expectedUpdatedAt });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey }); },
  });
};
