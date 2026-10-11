import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { HealthEvent } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";
import { animalsQueryKey } from "@/hooks/use-animals";

type HealthEventInsert = Database["public"]["Tables"]["health_events"]["Insert"];

export const healthEventsQueryKey = ["health-events"] as const;

export const useHealthEvents = () =>
  useQuery({
    queryKey: healthEventsQueryKey,
    queryFn: async (): Promise<HealthEvent[]> => {
      const { data, error } = await supabase
        .from("health_events")
        .select("*")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

/**
 * Registra o evento e reflete o efeito no animal: tratamento (com carência) ou óbito.
 */
export const useSaveHealthEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      event,
      animalUpdate,
    }: {
      event: HealthEventInsert;
      animalUpdate?: { id: string; status?: string; health_status?: string; withdrawal_until?: string | null };
    }) => {
      const created = await supabase.from("health_events").insert(event);
      if (created.error) throw created.error;

      if (animalUpdate) {
        const { id, ...fields } = animalUpdate;
        const updated = await supabase.from("animals").update(fields).eq("id", id);
        if (updated.error) throw updated.error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthEventsQueryKey });
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
    },
  });
};
