import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Animal } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type AnimalInsert = Database["public"]["Tables"]["animals"]["Insert"];

export const animalsQueryKey = ["animals"] as const;

export const useAnimals = () =>
  useQuery({
    queryKey: animalsQueryKey,
    queryFn: async (): Promise<Animal[]> => {
      const { data, error } = await supabase.from("animals").select("*").order("ear_tag");
      if (error) throw error;
      return data ?? [];
    },
  });

const isDuplicateTag = (message: string) => message.includes("duplicate key");

export const useSaveAnimal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AnimalInsert & { id?: string }) => {
      const { error } = payload.id
        ? await supabase.from("animals").update(payload).eq("id", payload.id)
        : await supabase.from("animals").insert(payload);

      if (error) {
        throw new Error(isDuplicateTag(error.message) ? "duplicate-ear-tag" : error.message);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
    },
  });
};

export const useDeleteAnimal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("animals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
    },
  });
};

/** Ajusta o peso atual de um animal a partir de uma pesagem individual. */
export const useUpdateAnimalWeights = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; weight: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("animals")
          .update({ current_weight_kg: update.weight })
          .eq("id", update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: animalsQueryKey });
    },
  });
};
