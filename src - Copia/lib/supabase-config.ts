export type SupabaseEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

/** Mesma validação no build e no navegador: cada ambiente aponta para seu projeto. */
export const readSupabaseConfig = (env: SupabaseEnvironment) => {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou VITE_SUPABASE_PUBLISHABLE_KEY) no ambiente antes de iniciar ou publicar o site.");
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("VITE_SUPABASE_URL deve ser uma URL válida do projeto Supabase."); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("VITE_SUPABASE_URL deve conter apenas o endereço HTTP/HTTPS do projeto Supabase.");
  }
  if (key.startsWith("sb_secret_")) throw new Error("Use a chave pública publishable/anon do Supabase no frontend.");
  return { url: parsed.origin, key };
};
