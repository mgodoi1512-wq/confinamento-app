import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const pending = new Map<string, string>();
/** Uma chamada RPC é uma transação. Repetir após falha de rede reutiliza a mesma chave. */
export const mutateApp = async <T>(operation: string, payload: unknown, requestId: string): Promise<T> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error("Sessão expirada. Entre novamente.");
  const key = `${sessionData.session.user.id}:${operation}:${JSON.stringify(payload)}`;
  const token = pending.get(key) ?? requestId;
  pending.set(key, token);
  const { data, error } = await supabase.rpc("app_mutate", {
    p_operation: operation, p_payload: payload as Json, p_request_id: token,
  });
  if (error) throw new Error(error.message);
  pending.delete(key);
  return data as T;
};
