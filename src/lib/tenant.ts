import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
export type Invitation = { id: string; farmName: string; role: "gestor" | "operador"; expiresAt: string };
export type TenantContext = {
  isAdmin: boolean; status: "pending" | "approved" | "rejected" | "suspended";
  farmId: string | null; role: "gestor" | "operador" | null;
  billingFarmId?: string | null; billingOwner?: boolean; billingMode?: "manual" | "automatic";
  billingRequired?: boolean; autoEnrollment?: boolean; billing?: import("./billing").ProductionAccess | null;
  invitations: Invitation[]; hasMembership: boolean;
};
export type Customer = { userId: string; name: string; email: string; status: TenantContext["status"]; source: string; createdAt: string; farmName: string | null; confirmed: boolean; isAdmin: boolean };
export type TeamMember = { userId: string; name: string; email: string; role: "gestor" | "operador"; enabled: boolean; isOwner: boolean };
export type TeamInvite = { id: string; email: string; role: "gestor" | "operador"; expiresAt: string };
export async function tenantRpc<T>(action: string, payload: Record<string, Json | undefined> = {}): Promise<T> {
  const { data, error } = await supabase.rpc("app_tenant", { p_action: action, p_payload: payload });
  if (error) throw new Error(error.message);
  return data as T;
}
