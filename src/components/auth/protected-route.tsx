import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";
import { PageLoading } from "@/components/app/page-loading";

/** Bloqueia rotas internas enquanto não há sessão; a autorização real é RLS. */
export const ProtectedRoute = () => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoading fullScreen />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
