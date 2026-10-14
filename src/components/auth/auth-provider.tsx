import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext, type AuthValue } from "@/components/auth/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { tenantRpc, type TenantContext } from "@/lib/tenant";
import type { Profile, Role } from "@/lib/domain";

// Captura o evento antes da montagem do React e da carga de rotas lazy.
// O callback só mantém estado local; não faz chamadas ao Supabase.
const syncRecoveryMarker = (event: string, nextSession: Session | null) => {
  if (event === "PASSWORD_RECOVERY" && nextSession?.user) {
    sessionStorage.setItem("liben-password-recovery", nextSession.user.id);
  } else if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && sessionStorage.getItem("liben-password-recovery") !== nextSession?.user.id)) {
    sessionStorage.removeItem("liben-password-recovery");
  }
};
const { data: recoveryListener } = supabase.auth.onAuthStateChange(syncRecoveryMarker);
if (import.meta.hot) import.meta.hot.dispose(() => recoveryListener.subscription.unsubscribe());

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [approved, setApproved] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const farmScope = useRef<string | null>(null);
  const identity = useRef<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    const request = ++generation.current;
    try {
      const [profileResult, accessResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        tenantRpc<TenantContext>("context"),
      ]);
      if (!mounted.current || identity.current !== userId || request !== generation.current) return;
      if (profileResult.error) throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
      if (farmScope.current !== accessResult.farmId) {
        queryClient.clear();
        farmScope.current = accessResult.farmId;
      }
      setProfile(profileResult.data ? { ...profileResult.data, role: accessResult.role ?? "operador" } : null);
      setTenant(accessResult);
      setApproved(Boolean(accessResult.farmId));
      setAuthError(null);
    } catch (error) {
      if (!mounted.current || identity.current !== userId || request !== generation.current) return;
      setApproved(false);
      setTenant(null);
      setAuthError(error instanceof Error ? error.message : "Falha ao verificar acesso.");
    } finally {
      if (mounted.current && identity.current === userId && request === generation.current) setLoading(false);
    }
  }, [queryClient]);

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
        setTenant(null);
        setAuthError(null);
        identity.current = nextId;
        farmScope.current = null;
      }
      setPasswordRecovery(Boolean(nextId) && sessionStorage.getItem("liben-password-recovery") === nextId);
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
      syncRecoveryMarker(_event, nextSession);
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
    user: session?.user ?? null, session, profile, approved, tenant, authError,
    passwordRecovery,
    finishPasswordRecovery: () => { sessionStorage.removeItem("liben-password-recovery"); setPasswordRecovery(false); },
    role: (profile?.role as Role | undefined) ?? null,
    isGestor: approved && profile?.role === "gestor", loading,
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    refreshProfile: async () => {
      if (session?.user) { setLoading(true); await loadProfile(session.user.id); }
    },
  }), [session, profile, approved, tenant, authError, loading, loadProfile, passwordRecovery]);
  useEffect(() => {
    if (!session?.user.id) return;
    // Revalida suspensão e revogação durante uma sessão aberta.
    const timer = setInterval(() => void loadProfile(session.user.id), 60_000);
    return () => clearInterval(timer);
  }, [session?.user.id, loadProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
