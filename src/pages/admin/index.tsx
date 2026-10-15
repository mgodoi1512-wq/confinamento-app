import { FeedbackAdmin } from "@/components/app/feedback-admin";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { tenantRpc, type Customer } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app/theme-toggle";
const labels = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado", suspended: "Suspenso" };
export default function Administration() {
  const { tenant, signOut } = useAuth(); const client = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const query = useQuery({ queryKey: ["platform-customers"], queryFn: () => tenantRpc<Customer[]>("list_requests"), enabled: tenant?.isAdmin === true });
  const decision = useMutation({ mutationFn: ({ userId, status }: { userId: string; status: string }) => tenantRpc("decide_request", { userId, status }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["platform-customers"] }); toast.success("Cadastro atualizado."); },
    onError: error => toast.error(error.message) });
  if (!tenant?.isAdmin) return <main className="p-8">Acesso exclusivo do administrador do sistema.</main>;
  return <main className="min-h-dvh bg-background p-5 text-foreground md:p-10">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Administração do sistema</h1><p className="text-muted-foreground">Aprove novos clientes e controle o acesso ao serviço.</p></div>
        <div className="flex items-center gap-2"><ThemeToggle /><Button asChild variant="outline"><Link to="/">Minha fazenda</Link></Button><Button variant="ghost" onClick={() => void signOut().catch(error => toast.error(error.message))}>Sair</Button></div>
      </header>
      <div className="flex flex-wrap gap-2">{["pending", "approved", "rejected", "suspended", "all"].map(value => <Button key={value} variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value === "all" ? "Todos" : labels[value as keyof typeof labels]}</Button>)}<Button variant="ghost" onClick={() => void query.refetch()}>Atualizar</Button></div>
      {query.isError ? <p role="alert">{query.error.message}</p> : null}
      {query.isLoading ? <p>Carregando cadastros...</p> : null}
      <div className="grid gap-4 md:grid-cols-2">{query.data?.filter(row => filter === "all" || row.status === filter).map(row => <article key={row.userId} className="space-y-3 rounded-xl border bg-card p-5 text-card-foreground">
        <div><h2 className="font-semibold">{row.name}</h2><p className="break-all text-sm">{row.email}</p><p className="text-sm">{row.farmName ?? "Fazenda ainda não cadastrada"}</p></div>
        <p className="text-sm">{labels[row.status]} · {row.confirmed ? "E-mail confirmado" : "E-mail não confirmado"}</p>
        {!row.isAdmin ? <div className="flex flex-wrap gap-2">
          {row.status !== "approved" ? <Button disabled={decision.isPending || !row.confirmed} onClick={() => decision.mutate({ userId: row.userId, status: "approved" })}>Aprovar</Button> : null}
          {row.status === "pending" ? <Button variant="outline" disabled={decision.isPending} onClick={() => { if (window.confirm(`Recusar o cadastro de ${row.name}?`)) decision.mutate({ userId: row.userId, status: "rejected" }); }}>Recusar</Button> : null}
          {row.status === "approved" ? <Button variant="destructive" disabled={decision.isPending} onClick={() => { if (window.confirm(`Suspender ${row.name}? Isso bloqueia também sua fazenda e equipe.`)) decision.mutate({ userId: row.userId, status: "suspended" }); }}>Suspender acesso</Button> : null}
        </div> : <p className="text-sm">Conta administrativa</p>}
      </article>)}</div>
      {!query.isLoading && query.data?.filter(row => filter === "all" || row.status === filter).length === 0 ? <p>Nenhum cadastro nesta situação.</p> : null}
      <FeedbackAdmin />
    </div>
  </main>;
}
