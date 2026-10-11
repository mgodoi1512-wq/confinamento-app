import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { FeedLog } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type FeedLogInsert = Database["public"]["Tables"]["feed_logs"]["Insert"];

export const feedLogsQueryKey = ["feed-logs"] as const;

export const useFeedLogs = () =>
  useQuery({
    queryKey: feedLogsQueryKey,
    queryFn: async (): Promise<FeedLog[]> => {
      const { data, error } = await supabase
        .from("feed_logs")
        .select("*")
        .order("date", { ascending: false })
        .order("shift");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useSaveFeedLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FeedLogInsert) => {
      const { error } = await supabase.from("feed_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedLogsQueryKey });
    },
  });
};

export const useDeleteFeedLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feed_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedLogsQueryKey });
    },
  });
};
