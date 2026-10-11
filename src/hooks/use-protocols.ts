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
    queryFn: async (): Promise<Protocol[]> => {
      const { data, error } = await supabase.from("protocols").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useProtocolItems = () =>
  useQuery({
    queryKey: protocolItemsQueryKey,
    queryFn: async (): Promise<ProtocolItem[]> => {
      const { data, error } = await supabase.from("protocol_items").select("*").order("product");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useSaveProtocol = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      protocol,
      items,
    }: {
      protocol: ProtocolInsert & { id?: string };
      items: {
        kind: string;
        product: string;
        dose: string | null;
        withdrawal_days: number;
      }[];
    }) => {
      const saved = protocol.id
        ? await supabase.from("protocols").update(protocol).eq("id", protocol.id).select().single()
        : await supabase.from("protocols").insert(protocol).select().single();

      if (saved.error) throw saved.error;

      const protocolId = saved.data.id;

      const removed = await supabase
        .from("protocol_items")
        .delete()
        .eq("protocol_id", protocolId);
      if (removed.error) throw removed.error;

      const cleanItems = items.filter((item) => item.product.trim() !== "");
      if (cleanItems.length > 0) {
        const inserted = await supabase
          .from("protocol_items")
          .insert(cleanItems.map((item) => ({ ...item, protocol_id: protocolId })));
        if (inserted.error) throw inserted.error;
      }

      return protocolId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: protocolsQueryKey });
      void queryClient.invalidateQueries({ queryKey: protocolItemsQueryKey });
    },
  });
};

export const useDeleteProtocol = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("protocols").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: protocolsQueryKey });
      void queryClient.invalidateQueries({ queryKey: protocolItemsQueryKey });
    },
  });
};
