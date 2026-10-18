import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { BillingGate } from "@/components/auth/billing-gate";
import { PageLoading } from "@/components/app/page-loading";

/** Permanece no plano após o webhook; a entrada na operação exige o botão. */
export default function PlanEntry() {
  const { session, loading, passwordRecovery, tenant } = useAuth();
  if (loading) return <PageLoading fullScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (passwordRecovery) return <Navigate to="/redefinir-senha" replace />;
  if (!tenant?.billingOwner && !tenant?.billingRequired) return <Navigate to="/" replace />;
  return <BillingGate />;
}
