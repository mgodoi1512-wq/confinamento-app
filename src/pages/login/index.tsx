import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, Beef, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { normalizeContactPhone } from "@/lib/contact-phone";
import { useAuth } from "@/hooks/use-auth";
import "./login.css";

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, passwordRecovery } = useAuth();

  const [mode, setMode] = useState("login");
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // Mede o conteúdo natural para animar a altura sem cortar cadastro ou mensagens.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => setPanelHeight(panel.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [mode]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(location.state?.accountConfirmed ? "Sua conta foi confirmada. Entre com seu e-mail e senha." : null);
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

    const contactPhone = mode === "signup" ? normalizeContactPhone(phone) : null;
    if (mode === "signup" && !contactPhone) {
      setError("Informe um telefone válido com DDD, com 10 ou 11 dígitos.");
      return;
    }
    setSubmitting(true);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/conta-confirmada`,
          data: { full_name: fullName, phone: contactPhone },
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
    <div className="login-screen-page login-background min-h-dvh w-full">
      <div className="login-screen-theme fixed right-4 top-4 z-50 rounded-lg bg-background text-foreground">
        <ThemeToggle />
      </div>

      <main className="login-responsive-main min-w-0">
        <div className="login-screen-content mx-auto w-full">
          <header className="login-screen-hero">
            <div className="login-screen-brand">
  <img
    src="../public/logo-marrom-claro.png"
    alt="LiBen Gestão de Fazendas"
    className="login-logo-claro"
  />
  <img
    src="../public/logo-cinza.png"
    alt="LiBen Gestão de Fazendas"
    className="login-logo-dark"
  />
</div>
            <h1>Sua fazenda.<br /><span>Na palma da mão.</span></h1>
            <p>Mais controle para o seu dia a dia.</p>
            <ul className="login-screen-highlights" aria-label="Recursos do sistema">
              {highlights.map((item) => (
                <li key={item.key}><item.icon aria-hidden="true" /><span>{t(item.key)}</span></li>
              ))}
            </ul>
          </header>

          <div className="login-screen-card mx-auto w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xs md:p-6">
            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value);
                setShowPassword(false);
                setError(null);
              }}
            >
              <TabsList data-mode={mode} className="login-screen-tabs grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("auth.loginTab")}</TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="data-[state=inactive]:text-[#D7B49A]"
                >
                  {t("auth.signupTab")}
                </TabsTrigger>
              </TabsList>

              <motion.div
                className="login-screen-panel"
                initial={false}
                animate={{ height: panelHeight ?? "auto" }}
                transition={{ duration: reduceMotion ? 0 : 0.80, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  key={mode}
                  ref={panelRef}
                  className="login-screen-panel-content"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.24 }}
                >
                  <h2 className="login-screen-welcome">
                    {mode === "signup" ? "Crie sua conta" : "Bem-vindo de volta"}
                  </h2>

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

                    {mode === "signup" ? <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium">Telefone com DDD</label>
                      <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={22} required className="h-11" />
                      <p className="text-xs text-muted-foreground">Telefone para contato. Seu acesso continua por e-mail e senha.</p>
                    </div> : null}

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        {t("auth.email")}
                      </label>
                      <div className="login-screen-field">
                        <Mail className="login-screen-field-icon hidden" aria-hidden="true" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          autoComplete="email"
                          inputMode="email"
                          className="h-11"
                        />
                        {!email && <span className="login-screen-placeholder hidden" aria-hidden="true">seu@email.com</span>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="password" className="text-sm font-medium">
                        {t("auth.password")}
                      </label>
                      <div className="login-screen-field">
                        <LockKeyhole className="login-screen-field-icon hidden" aria-hidden="true" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          className="h-11"
                        />
                        <button
                          type="button"
                          className="login-screen-password hidden"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          aria-pressed={showPassword}
                          aria-controls="password"
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </button>
                      </div>
                    </div>

                    {mode === "login" ? <div className="text-right"><Link to="/recuperar-senha" className="text-sm font-medium text-primary underline underline-offset-4">Esqueci minha senha</Link></div> : null}

                    {notice && <p role="status" className="rounded-md bg-muted p-3 text-sm">{notice}</p>}
                    {error ? (
                      <p role="alert" className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">
                        {error}
                      </p>
                    ) : null}

                    <Button type="submit" size="lg" className="login-screen-submit h-12 w-full" disabled={submitting}>
                      <span>{submitting ? "Aguarde…" : mode === "signup" ? t("action.signUp") : "Acessar minha fazenda"}</span>
                      <ArrowRight className="login-screen-submit-arrow hidden" aria-hidden="true" />
                    </Button>
                    {mode === "signup" && <p className="login-screen-signup-hint hidden">{t("auth.signupHint")}</p>}
                  </form>
                </motion.div>
              </motion.div>
            </Tabs>

          </div>

        </div>
      </main>
    </div>
  );
};

export default Login;
