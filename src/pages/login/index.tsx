import { useEffect, useState } from "react";
import { BarChart3, Beef, Leaf, ShieldCheck, UtensilsCrossed } from "lucide-react";
import logoLiben from "@/assets/logo-liben-2.png";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, loading, passwordRecovery } = useAuth();

  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate(passwordRecovery ? "/redefinir-senha" : "/", { replace: true });
  }, [loading, session, navigate, passwordRecovery]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email || !password) {
      setError(t("auth.errorRequired"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.errorPasswordShort"));
      return;
    }

    setSubmitting(true);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { full_name: fullName },
        },
      });
      setSubmitting(false);
      if (signUpError) {
        setError(
          signUpError.message.toLowerCase().includes("already")
            ? t("auth.errorEmailInUse")
            : signUpError.message,
        );
        return;
      }
      if (!data.session) {
        setNotice("Confira seu e-mail para confirmar o cadastro. Depois do login, aguarde a aprovação do administrador do sistema.");
        return;
      }
      navigate("/", { replace: true });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(t("auth.errorInvalid"));
      return;
    }
    navigate("/", { replace: true });
  };

  const highlights = [
    { icon: Beef, key: "nav.lots" },
    { icon: UtensilsCrossed, key: "nav.feed" },
    { icon: BarChart3, key: "nav.weighings" },
    { icon: ShieldCheck, key: "nav.treatments" },
  ];

  return (
    <div className="flex min-h-dvh w-full bg-background">
      {/* Painel de marca */}

      <div className="fixed right-4 top-4 z-50 rounded-lg bg-background text-foreground">
  <ThemeToggle />
</div>
      <aside className="hidden w-[46%] flex-col justify-between bg-brand p-10 text-white/50 lg:flex">
<div className="mt-10 flex flex-col items-center text-center">            <span>
            <>
  <img
    src="/logo-liben-2.png"
    alt="LiBen Agronegócios"
    className="h-96 w-auto object-contain dark:hidden"
  />

  <img
    src="/logo-liben-dark.png"
    alt="LiBen Agronegócios"
    className="hidden h-96 w-auto object-contain dark:block"
  />
</>
          </span>
          
        </div>

        <div className="space-y-6" >
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
            {t("auth.title")}
          </h1>
          <p className="max-w-md text-sm text-white/50">{t("auth.subtitle")}</p>
          <ul className="grid grid-cols-2 gap-3">
            {highlights.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-2 rounded-lg bg-primary-foreground/30 px-3 py-2 text-sm"
              >

                
                <item.icon className="size-4" />
                {t(item.key)}
              </li>

              
            ))}
          </ul>
        </div>
 
        <p className="text-xs text-white/40">
          {t("auth.signupHint")}
        </p>
      </aside>

      {/* Formulário */}
      <main className="flex flex-1 items-center justify-center p-5 md:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-md bg-brand text-primary-foreground">
              <Leaf className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">
                {t("common.appName")}
              </p>
              <p className="text-xs text-stone-200">{t("common.appSubtitle")}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-xs md:p-6">
            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value);
                setError(null);
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("auth.loginTab")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signupTab")}</TabsTrigger>
              </TabsList>

              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "signup" ? (
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-sm font-medium">
                      {t("auth.fullName")}
                    </label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                      className="h-11"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    {t("auth.email")}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    {t("auth.password")}
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="h-11"
                  />
                </div>

                {mode === "login" ? <div className="text-right"><Link to="/recuperar-senha" className="text-sm font-medium text-primary underline underline-offset-4">Esqueci minha senha</Link></div> : null}

                {notice && <p role="status" className="rounded-md bg-muted p-3 text-sm">{notice}</p>}
                {error ? (
                  <p className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" size="lg" className="h-12 w-full" disabled={submitting}>
                  {mode === "signup" ? t("action.signUp") : t("action.signIn")}
                </Button>
              </form>
            </Tabs>

            {mode === "signup" ? (
              <p className="mt-4 text-xs text-stone-200">{t("auth.signupHint")}</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
