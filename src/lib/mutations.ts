import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type DuplicateEarTag = { earTag: string; lotCode: string };
export class DuplicateEarTagsError extends Error {
  constructor(public matches: DuplicateEarTag[]) { super("Há brincos já usados em outros lotes."); this.name = "DuplicateEarTagsError"; }
}

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
  if (error) {
    const prefix = "BRINCOS_OUTROS_LOTES:";
    if (["create_lot", "save_animal"].includes(operation) && error.message.startsWith(prefix)
      && payload && typeof payload === "object") {
      let matches: { earTag: string; lotCode: string }[] = [];
      try {
        const parsed: unknown = JSON.parse(error.message.slice(prefix.length));
        if (Array.isArray(parsed) && parsed.every(item => item && typeof item.earTag === "string" && typeof item.lotCode === "string")) matches = parsed;
      } catch { /* Uma resposta inválida não autoriza cadastrar. */ }
      if (matches.length && operation === "create_lot") { pending.delete(key); throw new DuplicateEarTagsError(matches); }
      if (matches.length && !("confirmedDuplicateEarTags" in payload)) {
        const shown = matches.slice(0, 12).map(item => `• ${item.earTag} — ${item.lotCode}`).join("\n");
        const more = matches.length > 12 ? `\nE mais ${matches.length - 12} ocorrência(s).` : "";
        pending.delete(key);
        if (!window.confirm(`Já existem animais com estes brincos em outros lotes da fazenda:\n\n${shown}${more}\n\nDeseja cadastrar mesmo assim? Os animais existentes serão mantidos.`)) {
          throw new Error("Cadastro cancelado. Nenhum animal foi alterado.");
        }
        return mutateApp<T>(operation, { ...payload, confirmedDuplicateEarTags: [...new Set(matches.map(item => item.earTag))] }, token);
      }
    }
    if (error.message.startsWith(prefix)) throw new Error("Os brincos repetidos precisam ser conferidos novamente. Tente salvar outra vez.");
    throw new Error(error.message);
  }
  pending.delete(key);
  return data as T;
};
