import { mutateApp } from "@/lib/mutations";
import { fetchAll } from "@/lib/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { FeedLog } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type FeedLogInsert = Database["public"]["Tables"]["feed_logs"]["Insert"];

export const feedLogsQueryKey = ["feed-logs"] as const;

export const useFeedLogs = () =>
  useQuery({
    queryKey: feedLogsQueryKey,
    queryFn: () => fetchAll<FeedLog>(() => supabase
        .from("feed_logs")
        .select("*")
        .order("date", { ascending: false })
        .order("shift").order("id")),
  });

export const useSaveFeedLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FeedLogInsert) => mutateApp("save_feed", payload, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedLogsQueryKey });
    },
  });
};

export const useDeleteFeedLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mutateApp("delete_feed", { id }, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedLogsQueryKey });
    },
  });
};
