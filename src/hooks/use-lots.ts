import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Lot } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";
import { animalsQueryKey } from "@/hooks/use-animals";
import { healthEventsQueryKey } from "@/hooks/use-health";
import { weighingsQueryKey } from "@/hooks/use-weighings";
import { pensQueryKey } from "@/hooks/use-pens";

type LotInsert = Database["public"]["Tables"]["lots"]["Insert"];

export const lotsQueryKey = ["lots"] as const;

export const useLots = () =>
  useQuery({
    queryKey: lotsQueryKey,
    queryFn: async (): Promise<Lot[]> => {
      const { data, error } = await supabase
        .from("lots")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export type NewLotAnimal = {
  ear_tag: string;
  entry_weight_kg: number | null;
  sisbov: string | null;
  sex: string;
};

/** Cria o lote, os animais pesados individualmente e o evento de protocolo de entrada. */
export const useCreateLot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      lot,
      animals,
      applyProtocol,
    }: {
      lot: LotInsert;
      animals: NewLotAnimal[];
      applyProtocol: boolean;
    }) => {
      const created = await supabase.from("lots").insert(lot).select().single();
      if (created.error) throw created.error;

      const newLot = created.data;

      if (animals.length > 0) {
        const inserted = await supabase.from("animals").insert(
          animals.map((animal) => ({
            lot_id: newLot.id,
            pen_id: newLot.pen_id,
            ear_tag: animal.ear_tag,
            sisbov: animal.sisbov,
            breed: newLot.breed,
            sex: animal.sex,
            entry_weight_kg: animal.entry_weight_kg,
            current_weight_kg: animal.entry_weight_kg,
          })),
        );
        if (inserted.error) {
  console.error("ANIMALS ERROR", inserted.error);
  throw inserted.error;
}
      }

      if (applyProtocol && newLot.protocol_id) {
        const event = await supabase.from("health_events").insert({
          lot_id: newLot.id,
          pen_id: newLot.pen_id,
          kind: "protocolo",
          product: "Protocolo de entrada",
          event_date: newLot.entry_date,
        });
        if (event.error) {
  console.error("EVENT ERROR", event.error);
  throw event.error;
}
      }

      return newLot;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey });
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
      void queryClient.invalidateQueries({ queryKey: healthEventsQueryKey });
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};

export const useUpdateLot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Lot> & { id: string }) => {
      const { error } = await supabase.from("lots").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey });
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};

/** Move o lote (e os animais vinculados) para outro curral. */
export const useTransferLot = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lot, penId }: { lot: Lot; penId: string }) => {
      const updated = await supabase.from("lots").update({ pen_id: penId }).eq("id", lot.id);
      if (updated.error) throw updated.error;

      const moved = await supabase
        .from("animals")
        .update({ pen_id: penId })
        .eq("lot_id", lot.id)
        .eq("status", "ativo");
      if (moved.error) throw moved.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey });
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};

export type ExitPayload = {
  lot: Lot;
  reason: "abate" | "venda" | "obito";
  headCount: number;
  weightKg: number | null;
  destination: string | null;
  date: string;
  closeLot: boolean;
};

/** Saída do lote: baixa no lote, status dos animais, pesagem de saída e evento sanitário. */
export const useRegisterExit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      lot,
      reason,
      headCount,
      weightKg,
      destination,
      date,
      closeLot,
    }: ExitPayload) => {
      const remaining = Math.max(lot.head_count - headCount, 0);

      const updated = await supabase
        .from("lots")
        .update({ head_count: remaining, status: closeLot || remaining === 0 ? "encerrado" : "ativo" })
        .eq("id", lot.id);
      if (updated.error) throw updated.error;

      if (reason === "abate" || reason === "venda") {
        const sold = await supabase
          .from("animals")
          .update({ status: reason === "abate" ? "abatido" : "vendido" })
          .eq("lot_id", lot.id)
          .eq("status", "ativo");
        if (sold.error) throw sold.error;
      }

      if (weightKg) {
        const weighing = await supabase.from("weighings").insert({
          lot_id: lot.id,
          pen_id: lot.pen_id,
          date,
          kind: "amostral",
          head_count_weighed: headCount,
          avg_weight_kg: weightKg,
          notes: destination ? `Saída: ${destination}` : "Pesagem de saída",
        });
        if (weighing.error) throw weighing.error;
      }

      const event = await supabase.from("health_events").insert({
        lot_id: lot.id,
        pen_id: lot.pen_id,
        kind: reason === "obito" ? "obito" : "tratamento",
        product: reason === "obito" ? null : `Saída para ${destination ?? "destino não informado"}`,
        diagnosis: reason === "obito" ? "Óbito registrado na saída" : null,
        event_date: date,
      });
      if (event.error) throw event.error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lotsQueryKey });
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
      void queryClient.invalidateQueries({ queryKey: weighingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: healthEventsQueryKey });
      void queryClient.invalidateQueries({ queryKey: pensQueryKey });
    },
  });
};
