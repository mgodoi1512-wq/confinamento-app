import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/app/theme-toggle";

export default function PasswordRecovery() {
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice(null); setError(null); setBusy(true);
    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (requestError) throw requestError;
      setNotice("Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Confira também a pasta de spam.");
      setCooldown(60);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível solicitar a recuperação.";
      setError(/rate limit|too many/i.test(message) ? "Muitas solicitações. Aguarde alguns minutos e tente novamente." : message);
    } finally { setBusy(false); }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-foreground">
    <section className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6 text-card-foreground">
      <header className="flex items-center justify-between gap-3"><h1 className="text-xl font-semibold">Recuperar senha</h1><ThemeToggle /></header>
      <p className="text-sm text-muted-foreground">Informe o e-mail da sua conta para receber o link de recuperação.</p>
      <form onSubmit={event => void submit(event)} className="space-y-4">
        <div className="space-y-2"><label htmlFor="recovery-email" className="text-sm font-medium">E-mail</label><Input id="recovery-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} className="h-11" /></div>
        {notice ? <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-11 w-full" disabled={busy || cooldown > 0}>{busy ? "Enviando..." : cooldown > 0 ? `Reenviar em ${cooldown}s` : "Enviar link de recuperação"}</Button>
      </form>
      <Button asChild variant="outline" className="w-full"><Link to="/login">Voltar para o login</Link></Button>
    </section>
  </main>;
}
