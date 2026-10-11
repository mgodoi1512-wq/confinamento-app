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
    queryFn: async (): Promise<Diet[]> => {
      const { data, error } = await supabase.from("diets").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useDietItems = () =>
  useQuery({
    queryKey: dietItemsQueryKey,
    queryFn: async (): Promise<DietItem[]> => {
      const { data, error } = await supabase.from("diet_items").select("*").order("ingredient");
      if (error) throw error;
      return data ?? [];
    },
  });

export type DietWithItems = Diet & { items: DietItem[] };

export const useSaveDiet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      diet,
      items,
    }: {
      diet: DietInsert & { id?: string };
      items: { ingredient: string; kg_per_head_day: number }[];
    }) => {
      const saved = diet.id
        ? await supabase.from("diets").update(diet).eq("id", diet.id).select().single()
        : await supabase.from("diets").insert(diet).select().single();

      if (saved.error) throw saved.error;

      const dietId = saved.data.id;

      const removed = await supabase.from("diet_items").delete().eq("diet_id", dietId);
      if (removed.error) throw removed.error;

      const cleanItems = items.filter((item) => item.ingredient.trim() !== "");
      if (cleanItems.length > 0) {
        const inserted = await supabase
          .from("diet_items")
          .insert(cleanItems.map((item) => ({ ...item, diet_id: dietId })));
        if (inserted.error) throw inserted.error;
      }

      return dietId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dietsQueryKey });
      void queryClient.invalidateQueries({ queryKey: dietItemsQueryKey });
    },
  });
};

export const useDeleteDiet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dietsQueryKey });
      void queryClient.invalidateQueries({ queryKey: dietItemsQueryKey });
    },
  });
};
