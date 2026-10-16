import { fetchAll } from "@/lib/query";
import { mutateApp } from "@/lib/mutations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Diet, DietItem } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type DietInsert = Database["public"]["Tables"]["diets"]["Insert"];

export const dietsQueryKey = ["diets"] as const;
export const dietItemsQueryKey = ["diet-items"] as const;

export const useDiets = () =>
  useQuery({
    queryKey: dietsQueryKey,
    queryFn: async () => {
      const diets = await fetchAll<Diet>(() =>
        supabase.from("diets").select("*").order("name").order("id"),
      );
      return diets.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" })
        || a.id.localeCompare(b.id),
      );
    },
  });

export const useDietItems = () =>
  useQuery({
    queryKey: dietItemsQueryKey,
    queryFn: () => fetchAll<DietItem>(() => supabase.from("diet_items").select("*").order("ingredient").order("id")),
  });

export type DietWithItems = Diet & { items: DietItem[] };

export const useSaveDiet = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { diet: DietInsert & { id?: string }; items: { ingredient: string; kg_per_head_day: number; body_weight_pct?: number | null }[] }) =>
      mutateApp<string>("save_diet", payload, crypto.randomUUID()).catch((error: unknown) => {
        if (error instanceof Error && error.message.includes("diets_farm_normalized_name_unique")) {
          throw new Error("Já existe uma dieta com esse nome, ativa ou inativa. Use outro nome ou edite a dieta existente.");
        }
        throw error;
      }),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};

export const useDeleteDiet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => mutateApp("delete_diet", { id }, crypto.randomUUID()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dietsQueryKey });
      void queryClient.invalidateQueries({ queryKey: dietItemsQueryKey });
    },
  });
};
