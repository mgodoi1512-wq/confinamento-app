import { LEGAL_CONTACT, privacySections, termsSections } from "@/lib/legal-documents";

export type LegalDocumentKind = "privacy" | "terms";

export function LegalDocumentContent({ kind }: { kind: LegalDocumentKind }) {
  return <article className="space-y-6">
    {(kind === "privacy" ? privacySections : termsSections).map((section, index) => <section key={section.title} className="space-y-2"><h2 className="text-base font-semibold">{index + 1}. {section.title}</h2><p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{section.text}</p></section>)}
    <p className="border-t border-border pt-4 text-sm">Contato: <a className="break-all font-medium text-primary underline underline-offset-4" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a></p>
  </article>;
}
