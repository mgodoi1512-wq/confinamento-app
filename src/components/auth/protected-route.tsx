import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";
import { PageLoading } from "@/components/app/page-loading";

/** Bloqueia rotas internas enquanto não há sessão; a autorização real é RLS. */
export const ProtectedRoute = () => {
  const { session, loading, approved, authError, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoading fullScreen />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!approved) return <main className="mx-auto max-w-md space-y-4 p-8">
    <h1 className="text-xl font-semibold">{authError ? "Falha ao verificar acesso" : "Aguardando autorização"}</h1>
    <p role="alert">{authError ?? "Seu cadastro foi recebido. Um gestor precisa liberar seu acesso à fazenda."}</p>
    <button className="rounded border px-4 py-2" onClick={() => void refreshProfile()}>Verificar novamente</button>
    <button className="ml-3 rounded border px-4 py-2" onClick={() => void signOut().catch(() => undefined)}>Sair</button>
  </main>;
  return <Outlet />;
};
