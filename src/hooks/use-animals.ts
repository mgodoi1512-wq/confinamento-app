import { fetchAll } from "@/lib/query";
import { mutateApp } from "@/lib/mutations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Animal } from "@/lib/domain";
import type { Database } from "@/integrations/supabase/types";

type AnimalInsert = Database["public"]["Tables"]["animals"]["Insert"];

export const animalsQueryKey = ["animals"] as const;

export const useAnimals = () =>
  useQuery({
    queryKey: animalsQueryKey,
    queryFn: () => fetchAll<Animal>(() => supabase.from("animals").select("*").order("ear_tag").order("id")),
  });

export const useSaveAnimal = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AnimalInsert & { id?: string }) => {
      try { return await mutateApp("save_animal", payload, crypto.randomUUID()); }
      catch (error) {
        if (error instanceof Error && error.message.includes("animals_ear_tag_key")) throw new Error("duplicate-ear-tag");
        throw error;
      }
    },
    onSuccess: () => { void client.invalidateQueries(); },
  });
};
export const useDeleteAnimal = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mutateApp("delete_animal", { id }, crypto.randomUUID()),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};
