import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEGAL_VERSION } from "@/lib/legal-documents";
import { LegalDocumentContent, type LegalDocumentKind } from "./legal-document-content";

export function LegalDocumentDialog({ kind, onClose, onComplete }: {
  kind: LegalDocumentKind;
  onClose: () => void;
  onComplete: (kind: LegalDocumentKind) => void;
}) {
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mountViewport = useCallback((node: HTMLDivElement | null) => { contentRef.current = node; setViewport(node); }, []);
  const checkEnd = useCallback((element: HTMLDivElement) => {
    if (element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight <= 8) setReachedEnd(true);
  }, []);

  useEffect(() => {
    if (!viewport) return;
    checkEnd(viewport);
    const observer = new ResizeObserver(() => checkEnd(viewport));
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    return () => observer.disconnect();
  }, [viewport, checkEnd]);

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] flex h-[90dvh] max-h-[900px] w-[calc(100%_-_1rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl outline-none sm:w-[92vw] sm:rounded-2xl" onOpenAutoFocus={event => { event.preventDefault(); contentRef.current?.focus(); }}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:px-6">
          <div className="min-w-0"><Dialog.Title className="flex items-center gap-2 font-display text-lg font-semibold sm:text-xl"><ShieldCheck className="size-5 shrink-0 text-primary" />{kind === "privacy" ? "Aviso de Privacidade" : "Termos de Uso"}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-muted-foreground">LiBen Agronegócios · versão {LEGAL_VERSION}. Percorra o documento até o final para concluir.</Dialog.Description></div>
          <Dialog.Close asChild><Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Fechar documento sem concluir"><X className="size-4" /></Button></Dialog.Close>
        </header>
        <div ref={mountViewport} role="region" aria-label="Conteúdo do documento" tabIndex={0} onScroll={event => checkEnd(event.currentTarget)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6">
          <LegalDocumentContent kind={kind} />
        </div>
        <footer className="shrink-0 space-y-3 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <p role="status" className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">{reachedEnd ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : <ArrowDown className="mt-0.5 size-4 shrink-0" />}{reachedEnd ? "Você chegou ao final. Conclua para voltar ao cadastro; o aceite será marcado por você." : "Role o texto até o final para liberar Concluir leitura."}</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end"><Button type="button" variant="outline" className="h-10 min-w-0 sm:w-40" onClick={onClose}>Voltar</Button><Button type="button" className="h-10 min-w-0 px-2 sm:w-40" disabled={!reachedEnd} onClick={() => { if (reachedEnd) onComplete(kind); }}>Concluir leitura</Button></div>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
