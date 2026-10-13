import { mutateApp } from "@/lib/mutations";
import { fetchAll } from "@/lib/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Pen } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type PenInsert = Database["public"]["Tables"]["pens"]["Insert"];

export const pensQueryKey = ["pens"] as const;

export const usePens = () =>
  useQuery({
    queryKey: pensQueryKey,
    queryFn: () => fetchAll<Pen>(() => supabase.from("pens").select("*").order("code").order("id")),
  });

export const useSavePen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PenInsert & { id?: string }) => mutateApp("save_pen", payload, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};

export const useDeletePen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mutateApp("delete_pen", { id }, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};
