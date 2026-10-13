import { mutateApp } from "@/lib/mutations";
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
    mutationFn: (payload: { id?: string; name: string; city: string | null; state: string | null }) =>
      mutateApp("save_farm", payload, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: farmQueryKey });
    },
  });
};
