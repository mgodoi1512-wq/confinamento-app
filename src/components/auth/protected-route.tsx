import { signupPlanFromSearch } from "@/lib/signup-plan";
import { lazy } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { PageLoading } from "@/components/app/page-loading";
import Onboarding from "@/pages/onboarding";
const PublicHome = lazy(() => import("@/pages/home"));

/** Acesso por contexto do banco; RLS continua sendo a proteção real. */
export const ProtectedRoute = () => {
  const { session, loading, approved, tenant, passwordRecovery } = useAuth(); const location = useLocation();
  if (loading) return <PageLoading fullScreen />;
  if (!session && location.pathname.replace(/\/+$/, "") === "") return <PublicHome />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (passwordRecovery && session) return <Navigate to="/redefinir-senha" replace />;
  if (location.pathname.replace(/\/+$/, "") === "/admin") return tenant?.isAdmin ? <Outlet /> : <main className="p-8">Acesso exclusivo do administrador.</main>;
  const preferredPlan = signupPlanFromSearch(location.search);
  if (!approved && (tenant?.billingRequired || (location.pathname.replace(/\/+$/, "") === "/config/plano" && tenant?.billingOwner))) return <Navigate to={preferredPlan ? `/acesso-plano?plano=${preferredPlan}` : "/acesso-plano"} replace />;
  if (!approved) return <Onboarding />;
  return <Outlet />;
};
