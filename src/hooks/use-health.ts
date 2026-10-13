import { fetchAll } from "@/lib/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { HealthEvent } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";
import { mutateApp } from "@/lib/mutations";

type HealthEventInsert = Database["public"]["Tables"]["health_events"]["Insert"];

export const healthEventsQueryKey = ["health-events"] as const;

export const useHealthEvents = () =>
  useQuery({
    queryKey: healthEventsQueryKey,
    queryFn: () => fetchAll<HealthEvent>(() => supabase
        .from("health_events")
        .select("*")
        .order("event_date", { ascending: false }).order("id")),
  });

export const useSaveHealthEvent = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { event: HealthEventInsert; requestId: string }) =>
      mutateApp("save_health_event", payload, payload.requestId),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};
