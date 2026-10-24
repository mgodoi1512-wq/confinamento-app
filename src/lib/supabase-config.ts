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
  const publicKeyError = "Use a chave pública publishable/anon do Supabase no frontend. Chaves administrativas não podem ser publicadas.";
  if (key.startsWith("sb_secret_")) throw new Error(publicKeyError);
  if (key.startsWith("eyJ")) {
    let role: unknown;
    try {
      const payload = key.split(".")[1];
      role = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role;
    } catch { throw new Error(publicKeyError); }
    if (role !== "anon") throw new Error(publicKeyError);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol === "http:" && !local) throw new Error("Use HTTPS para conectar ao Supabase fora do ambiente local.");
  return { url: parsed.origin, key };
};
