import { useAuth } from "@/hooks/use-auth";
import { mutateApp } from "@/lib/mutations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Farm } from "@/lib/domain";

export const farmQueryKey = ["farm"] as const;

export const useFarm = () => {
  const { tenant } = useAuth();
  return useQuery({
    queryKey: [...farmQueryKey, tenant?.farmId],
    enabled: Boolean(tenant?.farmId),
    queryFn: async (): Promise<Farm | null> => {
      const { data, error } = await supabase
        .from("farms")
        .select("*")
        .eq("id", tenant!.farmId!)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

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
