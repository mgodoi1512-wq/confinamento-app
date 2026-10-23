import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Mail, RefreshCw, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { tenantRpc, type TeamMember, type TeamInvite } from "@/lib/tenant";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/form/text-field";

const roleLabel=(role:string)=>role==="gestor"?"Gestor":"Operador";
type CreatedInvite={email:string;role:string};

export default function SettingsUsers() {
  const { isGestor, user, tenant } = useAuth();
  const farmId=tenant?.farmId;
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operador");
  const [created,setCreated]=useState<CreatedInvite|null>(null);
  const [manualCopy,setManualCopy]=useState("");
  const team = useQuery({ queryKey: ["farm-team",farmId], queryFn: () => tenantRpc<TeamMember[]>("list_team"), enabled: Boolean(isGestor&&farmId) });
  const invites = useQuery({ queryKey: ["farm-invites",farmId], queryFn: () => tenantRpc<TeamInvite[]>("list_invites"), enabled: Boolean(isGestor&&farmId) });
  const change = useMutation({ mutationFn: ({ action, payload }: { action: string; payload: Record<string, string | boolean> }) => tenantRpc(action, payload),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["farm-team",farmId] }); void client.invalidateQueries({ queryKey: ["farm-invites",farmId] }); toast.success("Equipe atualizada."); },
    onError: error => toast.error(error.message) });
  const copyInstructions=async(invite:CreatedInvite,expiresAt?:string)=>{
    const text=`Você foi convidado para acessar a fazenda na plataforma LiBen como ${roleLabel(invite.role)}.\n\n1. Acesse ${window.location.origin}/login\n2. Entre ou crie sua conta com o e-mail ${invite.email}.\n3. Se criar uma conta, confirme seu e-mail.\n4. Acesse a plataforma e aceite o convite.\n\n${expiresAt?`Convite válido até ${new Date(expiresAt).toLocaleDateString("pt-BR")}.`:"O convite vale por 14 dias a partir da criação."}`;
    try{await navigator.clipboard.writeText(text);setManualCopy("");toast.success("Instruções copiadas. Encaminhe ao convidado.");}
    catch{setManualCopy(text);toast.info("Selecione e copie as instruções abaixo.");}
  };
  if (!isGestor) return <p>Somente gestores da fazenda podem administrar a equipe.</p>;
  return <div className="min-w-0 space-y-5 pb-20">
    <PageHeader titleKey="Usuários da fazenda" subtitleKey="Convide operadores ou gestores. Cada integrante utiliza sua própria conta."/>
    <form className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground sm:p-5" onSubmit={event => {
      event.preventDefault();if(change.isPending||!email.trim())return;
      const invitation={email:email.trim().toLowerCase(),role};
      change.mutate({ action: "invite_team", payload: invitation }, { onSuccess: () => {setCreated(invitation);setEmail("");setManualCopy("");} });
    }}>
      <h2 className="text-base font-semibold">Convidar integrante</h2>
      <fieldset disabled={change.isPending} className="grid min-w-0 items-end gap-3 md:grid-cols-[minmax(0,1fr)_200px_160px] [&_input]:h-10 [&_label]:text-xs">
        <TextField label="E-mail do convidado" type="email" placeholder="nome@exemplo.com" value={email} onChange={setEmail} required />
        <label className="block space-y-1.5 text-xs font-medium"><span>Perfil</span><select aria-label="Perfil do convite" aria-describedby="invite-role-description" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={role} onChange={event => setRole(event.target.value)}><option value="operador">Operador</option><option value="gestor">Gestor</option></select></label>
        <Button type="submit" className="h-10 w-40 shrink-0" disabled={change.isPending || !email.trim()}><UserPlus className="size-4"/>{change.isPending?"Criando…":"Criar convite"}</Button>
      </fieldset>
      <p id="invite-role-description" className="text-xs text-muted-foreground"><strong className="font-medium text-foreground">{roleLabel(role)}:</strong> {role==="gestor"?"administra cadastros, equipe e financeiro, além da rotina de manejo.":"registra a rotina de manejo, como tratos, pesagens e ocorrências, sem administrar a equipe ou o financeiro."}</p>
      <details className="rounded-lg border px-3 py-2 text-xs text-muted-foreground"><summary className="w-fit cursor-pointer rounded-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Como funciona</summary><ol className="mt-2 list-inside list-decimal space-y-1 leading-relaxed"><li>Crie o convite com o e-mail e o perfil do integrante.</li><li>Copie as instruções e encaminhe ao convidado. O sistema não envia e-mail de convite automaticamente.</li><li>O convidado deve entrar ou criar uma conta com o mesmo e-mail, confirmar o cadastro quando necessário e aceitar o convite.</li></ol><p className="mt-2">O convite vale por 14 dias. Você pode cancelá-lo enquanto estiver pendente.</p></details>
      {created&&<div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><p className="min-w-0 break-all"><Check className="mr-1 inline size-4 text-green-700 dark:text-green-400"/>Convite criado para <strong>{created.email}</strong>.</p><Button type="button" variant="outline" className="h-9 text-xs" onClick={()=>void copyInstructions(created)}><Copy className="size-4"/>Copiar instruções</Button></div>}
    </form>
    {manualCopy&&<div className="space-y-2 rounded-lg border bg-card p-3"><label htmlFor="invite-copy-fallback" className="text-xs font-medium">Instruções para copiar manualmente</label><textarea id="invite-copy-fallback" readOnly value={manualCopy} onFocus={event=>event.currentTarget.select()} className="min-h-44 w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"/></div>}
    <section className="space-y-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-muted-foreground"/>Equipe <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{team.isLoading?"…":team.data?.length??0}</span></h2>
      {team.isLoading&&<p className="text-sm text-muted-foreground">Carregando equipe…</p>}
      {team.isError&&<div role="alert" className="rounded-lg border border-destructive/40 bg-card p-3 text-sm">Não foi possível carregar a equipe. <Button variant="outline" size="sm" onClick={()=>void team.refetch()}><RefreshCw className="size-4"/>Tentar novamente</Button></div>}
      {team.data?.map(member => <article key={member.userId} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-card-foreground">
        <div className="min-w-0"><p className="font-semibold">{member.name}{member.userId === user?.id ? " (você)" : ""}</p><p className="break-all text-sm text-muted-foreground">{member.email}</p><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${member.enabled?"bg-green-500/10 text-green-800 dark:text-green-300":"bg-muted text-muted-foreground"}`}><span className="size-1.5 rounded-full bg-current"/>{member.enabled?"Acesso ativo":"Acesso revogado"}</span></div>
        {member.isOwner||member.userId===user?.id?<p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">{roleLabel(member.role)}{member.isOwner?" · Responsável da fazenda":" · Seu perfil"}</p>:<div className="flex flex-wrap gap-2"><select aria-label={`Perfil de ${member.name}`} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground" value={member.role} disabled={change.isPending} onChange={event => change.mutate({ action: "update_member", payload: { userId: member.userId, role: event.target.value } })}><option value="operador">Operador</option><option value="gestor">Gestor</option></select>
          <Button variant="outline" className="h-10" disabled={change.isPending} onClick={() => { if (!member.enabled || window.confirm(`Revogar acesso de ${member.name}?`)) change.mutate({ action: "update_member", payload: { userId: member.userId, enabled: !member.enabled } }); }}>{member.enabled ? "Revogar acesso" : "Reativar acesso"}</Button></div>}
      </article>)}
    </section>
    <section className="space-y-3"><h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold"><Mail className="size-5 text-muted-foreground"/>Convites pendentes <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{invites.isLoading?"…":invites.data?.length??0}</span></h2>
      {invites.isLoading&&<p className="text-sm text-muted-foreground">Carregando convites…</p>}
      {invites.isError&&<div role="alert" className="rounded-lg border border-destructive/40 bg-card p-3 text-sm">Não foi possível carregar os convites. <Button variant="outline" size="sm" onClick={()=>void invites.refetch()}><RefreshCw className="size-4"/>Tentar novamente</Button></div>}
      {invites.data?.length===0&&<div className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm text-muted-foreground"><Mail className="size-5 shrink-0"/><div><p className="font-medium text-foreground">Nenhum convite pendente</p><p className="mt-0.5 text-xs">Novos convites aparecerão aqui até serem aceitos, cancelados ou expirarem.</p></div></div>}
      {invites.data?.map(invite => <div key={invite.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"><div className="min-w-0"><p className="break-all text-sm font-medium">{invite.email}</p><p className="mt-1 text-xs text-muted-foreground">{roleLabel(invite.role)} · Válido até {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="h-9 text-xs" onClick={()=>void copyInstructions(invite,invite.expiresAt)}><Copy className="size-4"/>Copiar instruções</Button><Button variant="outline" className="h-9 text-xs" disabled={change.isPending} onClick={() => change.mutate({ action: "cancel_invite", payload: { invitationId: invite.id } },{onSuccess:()=>{if(created?.email===invite.email)setCreated(null);setManualCopy("");}})}>Cancelar convite</Button></div></div>)}
    </section>
  </div>;
}
