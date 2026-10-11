import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Profile, Role } from "@/lib/domain";

export const profilesQueryKey = ["profiles"] as const;

export const useProfiles = () =>
  useQuery({
    queryKey: profilesQueryKey,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

/** A alteração de papel é autorizada pela política de RLS (somente gestor). */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role, fullName }: { id: string; role?: Role; fullName?: string }) => {
      const payload: { role?: Role; full_name?: string } = {};
      if (role) payload.role = role;
      if (fullName !== undefined) payload.full_name = fullName;

      const { error } = await supabase.from("profiles").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profilesQueryKey });
    },
  });
};
