import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type BillingSettings = {
  mode: "manual" | "automatic";
  monthlyCents: number;
  annualCents: number;
  integrationReady: boolean;
  updatedAt: string;
};
export type FarmBillingControl = {
  farmId: string;
  farmName: string;
  ownerName: string;
  ownerEmail: string;
  accountStatus: "pending" | "approved" | "rejected" | "suspended";
  manualAccessPreserved: boolean;
  courtesyEnabled: boolean;
  courtesyExpiresOn: string | null;
  courtesyActive: boolean;
  updatedAt: string | null;
};
export type BillingOverview = {
  settings: BillingSettings;
  farms: FarmBillingControl[];
  phase: "controls_only";
};
export const billingAdminKey = ["platform-billing-admin"] as const;
export async function billingAdmin(action: "overview" | "save_settings" | "set_courtesy", payload: Record<string, Json | undefined> = {}): Promise<BillingOverview> {
  const { data, error } = await supabase.rpc("app_billing_admin", { p_action: action, p_payload: payload });
  if (error) throw new Error(error.message);
  return data as unknown as BillingOverview;
}
export const billingMoney = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
