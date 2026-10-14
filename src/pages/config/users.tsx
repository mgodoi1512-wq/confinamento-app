import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { tenantRpc, type TeamMember, type TeamInvite } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/form/text-field";

export default function SettingsUsers() {
  const { isGestor, user } = useAuth(); const client = useQueryClient();
  const [email, setEmail] = useState(""); const [role, setRole] = useState("operador");
  const team = useQuery({ queryKey: ["farm-team"], queryFn: () => tenantRpc<TeamMember[]>("list_team"), enabled: isGestor });
  const invites = useQuery({ queryKey: ["farm-invites"], queryFn: () => tenantRpc<TeamInvite[]>("list_invites"), enabled: isGestor });
  const change = useMutation({ mutationFn: ({ action, payload }: { action: string; payload: Record<string, string | boolean> }) => tenantRpc(action, payload),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["farm-team"] }); void client.invalidateQueries({ queryKey: ["farm-invites"] }); toast.success("Equipe atualizada."); },
    onError: error => toast.error(error.message) });
  if (!isGestor) return <p>Somente gestores da fazenda podem administrar a equipe.</p>;
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold">Usuários da fazenda</h1><p className="text-muted-foreground">Convide operadores ou outros gestores. Cada integrante utiliza sua própria conta.</p></header>
    <form className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground" onSubmit={event => { event.preventDefault(); change.mutate({ action: "invite_team", payload: { email, role } }, { onSuccess: () => setEmail("") }); }}>
      <h2 className="font-semibold">Convidar integrante</h2>
      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]"><TextField label="E-mail do convidado" value={email} onChange={setEmail} required />
        <label className="space-y-2 text-sm"><span>Perfil</span><select className="h-11 w-full rounded-md border bg-background px-3 text-foreground" value={role} onChange={event => setRole(event.target.value)}><option value="operador">Operador</option><option value="gestor">Gestor</option></select></label>
        <Button
  type="submit"
  className="h-11 w-fit px-5"
  disabled={change.isPending || !email.trim()}
>
  Criar convite
</Button></div>
      <p className="text-sm text-muted-foreground">Após criar o convite, informe ao convidado que deve acessar {window.location.origin}/login, cadastrar-se com esse e-mail, confirmar o cadastro e aceitar o convite. O sistema não envia e-mail de convite automaticamente. O convite vale por 14 dias.</p>
    </form>
    {team.isError || invites.isError ? <p role="alert">{team.error?.message ?? invites.error?.message}</p> : null}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Equipe</h2>
      {team.isLoading ? <p>Carregando equipe...</p> : null}
      {team.data?.map(member => <article key={member.userId} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4 text-card-foreground">
        <div><p className="font-semibold">{member.name}{member.userId === user?.id ? " (você)" : ""}</p><p className="break-all text-sm">{member.email}</p><p className="text-sm text-muted-foreground">{member.isOwner ? "Responsável da fazenda · " : ""}{member.enabled ? "Acesso ativo" : "Acesso revogado"}</p></div>
        <div className="flex flex-wrap gap-2"><select aria-label={`Perfil de ${member.name}`} className="rounded-md border bg-background px-3 py-2 text-foreground" value={member.role} disabled={change.isPending || member.isOwner || member.userId === user?.id} onChange={event => change.mutate({ action: "update_member", payload: { userId: member.userId, role: event.target.value } })}><option value="operador">Operador</option><option value="gestor">Gestor</option></select>
          <Button variant="outline" disabled={change.isPending || member.isOwner || member.userId === user?.id} onClick={() => { if (!member.enabled || window.confirm(`Revogar acesso de ${member.name}?`)) change.mutate({ action: "update_member", payload: { userId: member.userId, enabled: !member.enabled } }); }}>{member.enabled ? "Revogar acesso" : "Reativar acesso"}</Button></div>
      </article>)}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Convites pendentes</h2>
      {invites.data?.length === 0 ? <p>Nenhum convite pendente.</p> : null}
      {invites.data?.map(invite => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><p>{invite.email} · {invite.role} · até {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}</p><Button variant="outline" disabled={change.isPending} onClick={() => change.mutate({ action: "cancel_invite", payload: { invitationId: invite.id } })}>Cancelar convite</Button></div>)}
    </section>
  </div>;
}
