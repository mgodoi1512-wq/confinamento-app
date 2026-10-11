import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Farm } from "@/lib/domain";

export const farmQueryKey = ["farm"] as const;

export const useFarm = () =>
  useQuery({
    queryKey: farmQueryKey,
    queryFn: async (): Promise<Farm | null> => {
      const { data, error } = await supabase
        .from("farms")
        .select("*")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const useSaveFarm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id?: string; name: string; city: string | null; state: string | null }) => {
      const { error } = payload.id
        ? await supabase.from("farms").update(payload).eq("id", payload.id)
        : await supabase.from("farms").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: farmQueryKey });
    },
  });
};
