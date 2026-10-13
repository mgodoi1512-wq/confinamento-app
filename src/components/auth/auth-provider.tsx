import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext, type AuthValue } from "@/components/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Role } from "@/lib/domain";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [approved, setApproved] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const identity = useRef<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    const request = ++generation.current;
    try {
      const [profileResult, accessResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.rpc("has_app_access"),
      ]);
      if (!mounted.current || identity.current !== userId || request !== generation.current) return;
      if (profileResult.error || accessResult.error) throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
      setProfile(profileResult.data);
      setApproved(accessResult.data === true);
      setAuthError(null);
    } catch (error) {
      if (!mounted.current || identity.current !== userId || request !== generation.current) return;
      setApproved(false);
      setAuthError(error instanceof Error ? error.message : "Falha ao verificar acesso.");
    } finally {
      if (mounted.current && identity.current === userId && request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    generation.current++;
    let receivedEvent = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const applySession = (next: Session | null) => {
      if (!mounted.current) return;
      const nextId = next?.user.id ?? null;
      const changed = identity.current !== nextId;
      if (changed) {
        generation.current++;
        queryClient.clear();
        setProfile(null);
        setApproved(false);
        setAuthError(null);
        identity.current = nextId;
      }
      setSession(next);
      if (!nextId) { setLoading(false); return; }
      if (changed) setLoading(true);
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (mounted.current && identity.current === nextId) void loadProfile(nextId);
      }, 0);
      timers.add(timer);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedEvent = true;
      applySession(nextSession);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted.current || receivedEvent) return;
      if (error) { setAuthError(error.message); setLoading(false); return; }
      applySession(data.session);
    }).catch(() => {
      if (mounted.current && !receivedEvent) { setAuthError("Falha ao restaurar a sessão."); setLoading(false); }
    });
    return () => {
      mounted.current = false;
      timers.forEach(clearTimeout);
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, queryClient]);

  const value = useMemo<AuthValue>(() => ({
    user: session?.user ?? null, session, profile, approved, authError,
    role: (profile?.role as Role | undefined) ?? null,
    isGestor: approved && profile?.role === "gestor", loading,
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    refreshProfile: async () => {
      if (session?.user) { setLoading(true); await loadProfile(session.user.id); }
    },
  }), [session, profile, approved, authError, loading, loadProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
