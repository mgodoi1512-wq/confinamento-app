import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";

export type BillingSettings = {
  mode: "manual" | "automatic";
  monthlyCents: number;
  annualCents: number;
  integrationReady: boolean;
  productionCheckedAt?: string | null; activationReady?: boolean; paymentVerified?: boolean;
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
  financial?: ProductionAccess;
  updatedAt: string | null;
};
export type BillingOverview = {
  settings: BillingSettings;
  farms: FarmBillingControl[];
  phase: "controls_only" | "production_ready";
};
export const billingAdminKey = ["platform-billing-admin"] as const;
export async function billingAdmin(action: "overview" | "save_settings" | "set_courtesy" | "set_farm_access" | "set_mode", payload: Record<string, Json | undefined> = {}): Promise<BillingOverview> {
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

export type MyPlanOrder = {
  id: string; subscriptionId?: string | null; dueOn?: string | null; archived: boolean; plan: "monthly" | "annual"; method: "PIX" | "CREDIT_CARD";
  amountCents: number; status: string; invoiceUrl: string | null;
  refundedCents?: number; lastSyncSource?: "manual" | "webhook" | null; lastWebhookAt?: string | null;
  validFrom: string | null; validUntil: string | null; checkedAt: string | null; createdAt: string;
};
export type MyPlanOverview = {
  environment: "sandbox" | "production"; mode: "manual" | "automatic"; monthlyCents: number; annualCents: number;
  canCreate?: boolean; newSubscriptionStartsOn?: string; billingVersion?: string; access?: ProductionAccess;
  subscription?: SandboxSubscription | null; graceDays?: number; simulatedStatus?: string | null; paidThrough?: string | null;
  isOwner: boolean; canTest: boolean; orders: MyPlanOrder[];
};
export async function getMyPlan(): Promise<MyPlanOverview> {
  const { data, error } = await supabase.rpc("app_my_plan");
  if (error) throw new Error("Não foi possível carregar Meu plano. Confira a instalação da etapa 2.2 no Supabase.");
  return data as unknown as MyPlanOverview;
}
export type SandboxPaymentInput = { action: "create"; plan: "monthly" | "annual"; method: "PIX" | "CREDIT_CARD"; name: string; cpfCnpj: string } | { action: "refresh" | "archive"; id: string };
export async function sandboxPayment(input: SandboxPaymentInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke("asaas-sandbox-payment", { body: input });
  if (error) {
    let message = "Não foi possível consultar o pagamento. Confira a publicação da função asaas-sandbox-payment.";
    if (error instanceof FunctionsHttpError) {
      try { const details = await error.context.json(); if (typeof details?.error?.message === "string") message = details.error.message; } catch { /* Erro sem JSON. */ }
    }
    throw new Error(message);
  }
  if (data?.ok !== true || data?.environment !== "sandbox") throw new Error("Resposta do Sandbox inválida.");
}

export type SandboxSubscription = {
  id: string; plan: "monthly" | "annual"; method: "PIX" | "CREDIT_CARD"; amountCents: number;
  status: "creating" | "ACTIVE" | "INACTIVE" | "EXPIRED" | "canceling" | "CANCELLED";
  firstDueOn: string; nextDueOn: string | null; cancelledAt: string | null; checkedAt: string | null;
};
export type SubscriptionInput = { action: "create"; plan: "monthly" | "annual"; method: "PIX" | "CREDIT_CARD"; name: string; cpfCnpj: string } | { action: "refresh"; id: string } | { action: "cancel"; id: string; confirm: true };
export async function sandboxSubscription(input: SubscriptionInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke("asaas-sandbox-subscription", { body: input });
  if (error) {
    let message = "Não foi possível consultar a assinatura. Confira a publicação da função asaas-sandbox-subscription.";
    if (error instanceof FunctionsHttpError) {
      try { const details = await error.context.json(); if (typeof details?.error?.message === "string") message = details.error.message; } catch { /* Sem JSON. */ }
    }
    throw new Error(message);
  }
  if (data?.ok !== true || data?.environment !== "sandbox") throw new Error("A assinatura não confirmou o ambiente Sandbox.");
}

export type ProductionAccess = { allowed: boolean; reason: string; paidThrough: string | null; graceDays: number; graceUntil: string | null };
export async function getProductionPlan(): Promise<MyPlanOverview> {
  const { data, error } = await supabase.rpc("app_my_production_plan");
  if (error) throw new Error("Não foi possível carregar o plano. Confira o SQL de produção e sua sessão.");
  return data as unknown as MyPlanOverview;
}
async function productionInvoke(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = "Não foi possível concluir. Confira a publicação da função de produção.";
    if (error instanceof FunctionsHttpError) {
      try { const details = await error.context.json(); if (typeof details?.error?.message === "string") message = details.error.message; } catch { /* Sem JSON. */ }
    }
    throw new Error(message);
  }
  if (data?.ok !== true || data?.environment !== "production") throw new Error("A resposta não confirmou o ambiente de produção.");
  return data;
}
export const checkAsaasProduction = () => productionInvoke("asaas-production-check", { action: "check_production" });
export const productionSubscription = (input: SubscriptionInput, priceVersion?: string) => productionInvoke("asaas-production-subscription", input.action === "create" ? { ...input, productionConsent: true, priceVersion } : input);
export const productionPayment = (id: string) => productionInvoke("asaas-production-payment", { action: "refresh", id });
