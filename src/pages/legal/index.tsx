import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { LEGAL_VERSION } from "@/lib/legal-documents";
import { LegalDocumentContent } from "@/components/legal/legal-document-content";

export default function LegalDocuments({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy";
  return <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:py-10">
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3"><Button asChild variant="outline"><Link to="/login"><ArrowLeft className="size-4" />Voltar ao acesso</Link></Button><ThemeToggle /></div>
      <header className="space-y-2"><ShieldCheck className="size-7 text-primary" /><p className="text-sm font-medium text-primary">LiBen Agronegócios</p><h1 className="font-display text-3xl font-semibold">{privacy ? "Aviso de Privacidade" : "Termos de Uso"}</h1><p className="text-xs text-muted-foreground">Versão {LEGAL_VERSION} · Atualização em 23/10/2026</p></header>
      <div className="rounded-xl border border-border bg-card p-5 sm:p-7"><LegalDocumentContent kind={kind} /></div>
      <footer className="space-y-3 text-sm"><Link className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" to={privacy ? "/termos-de-uso" : "/privacidade"}>{privacy ? "Ler Termos de Uso" : "Ler Aviso de Privacidade"}</Link><p className="text-xs text-muted-foreground">Referência legal: <a className="underline" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener noreferrer">Lei Geral de Proteção de Dados Pessoais</a>.</p></footer>
    </div>
  </main>;
}
