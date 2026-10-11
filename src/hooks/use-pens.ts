import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Pen } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type PenInsert = Database["public"]["Tables"]["pens"]["Insert"];

export const pensQueryKey = ["pens"] as const;

export const usePens = () =>
  useQuery({
    queryKey: pensQueryKey,
    queryFn: async (): Promise<Pen[]> => {
      const { data, error } = await supabase.from("pens").select("*").order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useSavePen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PenInsert & { id?: string }) => {
      const { error } = payload.id
        ? await supabase.from("pens").update(payload).eq("id", payload.id)
        : await supabase.from("pens").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};

export const useDeletePen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};
