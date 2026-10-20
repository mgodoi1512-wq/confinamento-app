import { ProductionSystemFields } from "@/components/farms/production-system-fields";
import { validSystems, type ProductionSystem } from "@/lib/production-systems";
import type { Json } from "@/integrations/supabase/types";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { tenantRpc } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { LocationFields } from "@/components/form/location-fields";
import { TextField } from "@/components/form/text-field";
import { ThemeToggle } from "@/components/app/theme-toggle";

export default function Onboarding() {
  const { tenant, refreshProfile, signOut, authError } = useAuth();
  const [name, setName] = useState(""); const [city, setCity] = useState(""); const [state, setState] = useState("");
  const [systems,setSystems]=useState<ProductionSystem[]>([]),[standard,setStandard]=useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: string, payload: Record<string, Json> = {}) {
    setBusy(true);
    try { await tenantRpc(action, payload); await refreshProfile(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }
  const canCreate = (tenant?.status === "approved" || tenant?.autoEnrollment) && !tenant?.hasMembership;
  const blocked = tenant?.status === "rejected" || tenant?.status === "suspended";
  return <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
    <div className="mx-auto max-w-lg space-y-5 rounded-xl border bg-card p-6 text-card-foreground">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">{canCreate ? "Cadastre sua fazenda" : "Acesso ao sistema"}</h1><ThemeToggle /></div>
      {authError ? <p role="alert">{authError}</p> : null}
      {tenant?.isAdmin ? <Button asChild><Link to="/admin">Administração do sistema</Link></Button> : null}
      {blocked ? <p>Sua conta está {tenant?.status === "rejected" ? "recusada" : "suspensa"}. Entre em contato com o administrador.</p> : <>
        {tenant?.invitations.map(invite => <section key={invite.id} className="space-y-3 rounded-lg border p-4">
          <p>Convite para <strong>{invite.farmName}</strong>, como {invite.role}.</p>
          <Button disabled={busy} onClick={() => void act("accept_invite", { invitationId: invite.id })}>Aceitar convite</Button>
        </section>)}
        {canCreate ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void act("create_farm", { name, city, state, production_systems: systems, default_production_system: standard }); }}>
          <TextField label="Nome da fazenda" value={name} onChange={setName} required />
          <LocationFields state={state} city={city} onStateChange={setState} onCityChange={setCity} disabled={busy} />
          <ProductionSystemFields systems={systems} standard={standard} disabled={busy} onChange={(list,value)=>{setSystems(list);setStandard(value);}}/>
          <Button type="submit" disabled={busy || !name.trim() || !validSystems(systems,standard)}>Criar minha fazenda</Button>
        </form> : <p>{tenant?.hasMembership ? "Seu acesso à fazenda foi desativado ou a fazenda está suspensa. Contate o responsável." : "Seu cadastro foi recebido. O administrador do sistema precisa aprovar seu acesso. Se recebeu um convite de equipe, confirme seu e-mail e aceite o convite acima."}</p>}
      </>}
      {tenant?.billingOwner ? <Button asChild variant="outline"><Link to="/config/plano">Gerenciar minha assinatura</Link></Button> : null}
      <div className="flex gap-3"><Button variant="outline" disabled={busy} onClick={() => void refreshProfile()}>Verificar novamente</Button>
        <Button variant="ghost" onClick={() => void signOut().catch(error => toast.error(error.message))}>Sair</Button></div>
    </div>
  </main>;
}
