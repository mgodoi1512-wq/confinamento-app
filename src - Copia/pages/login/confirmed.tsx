import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function AccountConfirmed() {
  const navigate = useNavigate();
  const work = useRef<Promise<void> | null>(null);
  const [status, setStatus] = useState<"checking" | "confirmed" | "error">("checking");
  useEffect(() => {
    let active = true;
    work.current ??= (async () => {
      const query = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (query.has("error") || query.has("error_code") || fragment.has("error") || fragment.has("error_code")) throw new Error("confirmation");
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session) throw new Error("confirmation");
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.email_confirmed_at) throw new Error("confirmation");
      // A confirmação verifica o e-mail; a entrada será feita na tela de login.
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
    })();
    void work.current.then(() => { if (active) setStatus("confirmed"); }, () => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (status !== "confirmed") return;
    const timer = window.setTimeout(() => navigate("/login", { replace: true, state: { accountConfirmed: true } }), 4000);
    return () => window.clearTimeout(timer);
  }, [status, navigate]);
  return <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-foreground">
    <section className="w-full max-w-md space-y-4 rounded-xl border bg-card p-7 text-center" aria-live="polite">
      {status === "confirmed" ? <><CheckCircle2 className="mx-auto size-14 text-green-700 dark:text-green-400" /><h1 className="text-2xl font-semibold">Sua conta foi confirmada!</h1><p>Seu e-mail foi verificado. Entre com seu e-mail e senha para continuar.</p><p className="text-sm text-muted-foreground">Você será direcionado para o login em instantes.</p></> : status === "checking" ? <p>Verificando a confirmação do seu e-mail…</p> : <><h1 className="text-xl font-semibold">Não foi possível validar este link</h1><p>Ele pode ter expirado ou já ter sido utilizado. Tente entrar com seu e-mail e senha; se necessário, solicite um novo e-mail de confirmação.</p></>}
      {status !== "checking" ? <Button onClick={() => navigate("/login", { replace: true, state: { accountConfirmed: status === "confirmed" } })}>Ir para o login</Button> : null}
    </section>
  </main>;
}
