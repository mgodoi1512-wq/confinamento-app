import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
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

export type AsaasSandboxConnection = {
  ok: true;
  environment: "sandbox";
  checkedAt: string;
  paymentCreationEnabled: false;
  accessModeChanged: false;
};

export async function checkAsaasSandbox(): Promise<AsaasSandboxConnection> {
  const { data, error } = await supabase.functions.invoke("asaas-sandbox-check", { body: { action: "check_connection" } });
  if (error) {
    let message = "Não foi possível testar o Asaas. Confira se a Edge Function asaas-sandbox-check foi publicada e se os Secrets foram configurados.";
    if (error instanceof FunctionsHttpError) {
      try {
        const details = await error.context.json();
        if (typeof details?.error?.message === "string") message = details.error.message;
        else if (error.context.status === 401) message = "Sessão não autorizada. Entre novamente com a conta administrativa e tente de novo.";
      } catch { /* Resposta de rede sem mensagem estruturada. */ }
    }
    throw new Error(message);
  }
  if (data?.ok !== true || data?.environment !== "sandbox" || data?.paymentCreationEnabled !== false || data?.accessModeChanged !== false || typeof data?.checkedAt !== "string" || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error("O retorno não confirmou a conexão segura com o Sandbox.");
  return data as AsaasSandboxConnection;
}
