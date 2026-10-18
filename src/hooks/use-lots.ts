import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lot } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";
import { mutateApp } from "@/lib/mutations";
import { fetchAll } from "@/lib/query";

type LotInsert = Database["public"]["Tables"]["lots"]["Insert"];
export const lotsQueryKey = ["lots"] as const;
export const useLots = () => useQuery({
  queryKey: lotsQueryKey,
  queryFn: () => fetchAll<Lot>(() => supabase.from("lots").select("*").order("entry_date", { ascending: false }).order("id")),
});
export type NewLotAnimal = { ear_tag: string; entry_weight_kg: number | null; sisbov: string | null; sex: string };
const useLotMutation = <T, R = unknown>(operation: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: T & { requestId: string }) => mutateApp<R>(operation, payload, payload.requestId),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};
export const useCreateLot = () => useLotMutation<{ lot: LotInsert; animals: NewLotAnimal[]; applyProtocol: boolean; confirmedDuplicateEarTags?: string[] }, Lot>("create_lot");
export const useUpdateLot = () => useLotMutation<Partial<Lot> & { id: string }>("update_lot");
export const useTransferLot = () => useLotMutation<{ lot: Lot; penId: string }>("transfer_lot");
export type ExitPayload = {
  lot: Lot; reason: "abate" | "venda" | "obito"; headCount: number;
  animalIds: string[]; weightKg: number | null; destination: string | null;
  date: string; closeLot: boolean;
};
export const useRegisterExit = () => useLotMutation<ExitPayload>("register_exit");
