import { mutateApp } from "@/lib/mutations";
import { fetchAll } from "@/lib/query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Profile, Role } from "@/lib/domain";

export const profilesQueryKey = ["profiles"] as const;

export const useProfiles = () =>
  useQuery({
    queryKey: profilesQueryKey,
    queryFn: () => fetchAll<Profile>(() => supabase.from("profiles").select("*").order("created_at").order("id")),
  });

export const useMembers = () => useQuery({
  queryKey: ["app-members"],
  queryFn: () => fetchAll<{ user_id: string; enabled: boolean }>(() => supabase.from("app_members").select("user_id,enabled").order("user_id")),
});
export const useUpdateProfile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; role?: Role; fullName?: string; enabled?: boolean }) =>
      mutateApp("update_profile", payload, crypto.randomUUID()),
    onSuccess: () => { void client.invalidateQueries(); },
  });
};
