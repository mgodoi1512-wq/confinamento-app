import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthContext, type AuthValue } from "@/components/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Role } from "@/lib/domain";

/**
 * Sessão (não apenas o usuário) e perfil de acesso.
 * O listener é registrado antes do getSession para não perder a restauração inicial,
 * o callback não é async e as chamadas ao cliente são adiadas com setTimeout.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Falha ao carregar o perfil do usuário:", error.message);
      return;
    }

    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setLoading(false);

      if (nextSession?.user) {
        setTimeout(() => {
          void loadProfile(nextSession.user.id);
        }, 0);
        return;
      }

      setProfile(null);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      setSession(data.session);
      setLoading(false);

      if (data.session?.user) {
        void loadProfile(data.session.user.id);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      role: (profile?.role as Role | undefined) ?? null,
      isGestor: profile?.role === "gestor",
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
    }),
    [session, profile, loading, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
