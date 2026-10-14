import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/app/theme-toggle";

export default function ResetPassword() {
  const { session, loading, passwordRecovery, finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null); const [signOutNotice, setSignOutNotice] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    if (!session || !passwordRecovery) { setError("Abra o link de recuperação recebido por e-mail."); return; }
    if (password.length < 8) { setError("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirmation) { setError("As senhas não são iguais."); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword(""); setConfirmation(""); setDone(true); finishPasswordRecovery();
      const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
      if (logoutError) setSignOutNotice("Sua senha foi alterada, mas não foi possível encerrar esta sessão. Você pode sair pelo menu do sistema.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a senha."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-foreground">
    <section className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6 text-card-foreground">
      <header className="flex items-center justify-between gap-3"><h1 className="text-xl font-semibold">Definir nova senha</h1><ThemeToggle /></header>
      {done ? <><p role="status">Senha atualizada com sucesso. Entre usando sua nova senha.</p>{signOutNotice ? <p>{signOutNotice}</p> : null}<Button asChild className="w-full"><Link to="/login">Voltar para o login</Link></Button></> : loading ? <p>Validando o acesso...</p> : !session || !passwordRecovery ? <>
        <p role="alert">O link de recuperação está ausente, inválido ou expirou. Solicite um novo link e abra o mais recente recebido por e-mail.</p>
        <Button asChild className="w-full"><Link to="/recuperar-senha">Solicitar novo link</Link></Button>
      </> : <form onSubmit={event => void submit(event)} className="space-y-4">
        <div className="space-y-2"><label htmlFor="new-password" className="text-sm font-medium">Nova senha</label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="h-11" /><p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres.</p></div>
        <div className="space-y-2"><label htmlFor="confirm-password" className="text-sm font-medium">Confirmar nova senha</label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} className="h-11" /></div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Salvando..." : "Salvar nova senha"}</Button>
      </form>}
    </section>
  </main>;
}
