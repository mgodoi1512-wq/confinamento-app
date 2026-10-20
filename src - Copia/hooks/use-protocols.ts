import { fetchAll } from "@/lib/query";
import { mutateApp } from "@/lib/mutations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Protocol, ProtocolItem } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type ProtocolInsert = Database["public"]["Tables"]["protocols"]["Insert"];

export const protocolsQueryKey = ["protocols"] as const;
export const protocolItemsQueryKey = ["protocol-items"] as const;

export const useProtocols = () =>
  useQuery({
    queryKey: protocolsQueryKey,
    queryFn: () => fetchAll<Protocol>(() => supabase.from("protocols").select("*").order("name").order("id")),
  });

export const useProtocolItems = () =>
  useQuery({
    queryKey: protocolItemsQueryKey,
    queryFn: () => fetchAll<ProtocolItem>(() => supabase.from("protocol_items").select("*").order("product").order("id")),
  });

export const useSaveProtocol = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { protocol: ProtocolInsert & { id?: string }; items: { kind: string; product: string; dose: string | null; withdrawal_days: number }[] }) =>
      mutateApp<string>("save_protocol", payload, crypto.randomUUID()),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};

export const useDeleteProtocol = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mutateApp("delete_protocol", { id }, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: protocolsQueryKey });
      void queryClient.invalidateQueries({ queryKey: protocolItemsQueryKey });
    },
  });
};
