import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, BookOpenText, ExternalLink, Info, List, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { chapterForPath, tutorialChapters, tutorialPage } from "@/lib/tutorial";
import { LotTutorialDemo } from "./lot-tutorial-demo";
import { TutorialCycle } from "./tutorial-cycle";
import "./tutorial-layout.css";

export default function TutorialDialog({ currentPath, onClose }: { currentPath: string; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [showIndex, setShowIndex] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { isGestor } = useAuth();
  const navigate = useNavigate();
  const chapter = tutorialChapters[page];
  const contextPage = chapterForPath(currentPath);
  const contextTitle = tutorialChapters[contextPage].title;
  const selectPage = (index: number) => { setPage(tutorialPage(index)); setShowIndex(false); };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [page]);

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
      <Dialog.Content className="tutorial-dialog fixed left-1/2 top-1/2 z-[70] flex h-[94dvh] max-h-[1040px] w-[calc(100%_-_1rem)] max-w-[1440px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl outline-none sm:w-[96vw] sm:rounded-2xl" onOpenAutoFocus={event => { event.preventDefault(); headingRef.current?.focus(); }} onKeyDown={event => {
        const target = event.target as HTMLElement;
        if (target.closest("input,select,textarea,button,a,[contenteditable=true]")) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          selectPage(page + (event.key === "ArrowRight" ? 1 : -1));
        }
      }}>
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><BookOpenText className="hidden size-6 shrink-0 text-primary sm:block" /><div><Dialog.Title className="font-display text-base font-semibold sm:text-lg">Tutorial da plataforma</Dialog.Title><Dialog.Description className="text-xs text-muted-foreground">Aprenda a usar as ferramentas da LiBen.</Dialog.Description></div></div>
          <div className="flex items-center gap-1"><Button variant="ghost" className="h-11 px-3 md:hidden" aria-expanded={showIndex} aria-controls="tutorial-index" onClick={() => setShowIndex(value => !value)}><List className="size-4" /><span className="hidden min-[380px]:inline">Índice</span></Button><Dialog.Close asChild><Button variant="ghost" size="icon" className="size-11" aria-label="Fechar tutorial"><X /></Button></Dialog.Close></div>
        </header>
        <div className="relative flex min-h-0 flex-1">
          <nav id="tutorial-index" aria-label="Capítulos do tutorial" className={`${showIndex ? "absolute inset-0 z-10 block" : "hidden"} overflow-y-auto border-r border-border bg-background p-3 md:static md:block md:w-64 md:shrink-0`}>
            <div className="sticky top-0 z-10 space-y-2 bg-background pb-2">
              <button type="button" className="tutorial-index-link min-h-11 w-full rounded-lg border border-border px-3 py-2 text-left text-sm font-medium" onClick={() => selectPage(0)}>Início do tutorial</button>
              <button type="button" className="tutorial-index-link min-h-11 w-full rounded-lg border border-border px-3 py-2 text-left text-xs" onClick={() => selectPage(contextPage)}><span className="block text-muted-foreground">Ajuda da tela aberta no site</span><span className="mt-1 block font-semibold">{contextTitle}</span></button>
            </div>
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Índice · {tutorialChapters.length} capítulos</p>
            {tutorialChapters.map((entry, index) => <button key={entry.id} type="button" onClick={() => selectPage(index)} aria-current={index === page ? "step" : undefined} className={`tutorial-index-link mb-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${index === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><span className="w-5 shrink-0 text-xs tabular-nums">{String(index + 1).padStart(2, "0")}</span><span>{entry.title}</span></button>)}
          </nav>
          <div className={`${showIndex ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-1 flex-col`}>
          <div ref={contentRef} className="tutorial-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <article key={chapter.id} className={`mx-auto max-w-5xl pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 ${page === 0 ? "space-y-4" : "space-y-6"}`}>
              <div>{page !== 0 && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">{chapter.group}</p>}<h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold outline-none sm:text-3xl">{chapter.title}</h2><p className={`mt-2 max-w-3xl leading-relaxed text-muted-foreground ${page === 0 ? "text-sm" : "text-base"}`}>{chapter.summary}</p>{page !== 0 && <p className="mt-3 text-xs text-muted-foreground">Onde encontrar: <span className="font-medium text-foreground">{chapter.path}</span></p>}</div>
              {chapter.managerOnly && !isGestor && <p className="rounded-lg border border-border bg-muted p-3 text-sm">As ações de cadastro deste capítulo são realizadas pelo gestor. Consulte-o se precisar de acesso.</p>}
              {page !== 0 && <button type="button" onClick={() => selectPage(0)} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" />Voltar ao ciclo da fazenda</button>}
              {chapter.demo === "cycle" && <TutorialCycle onChapter={selectPage} />}
              <div className={chapter.demo === "lot" ? "grid items-start gap-6 xl:grid-cols-2" : ""}>
                <ol className="space-y-3">{chapter.steps.map((step, index) => <li key={step.title} className="flex gap-3 rounded-xl border border-border bg-card p-4"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><div><h3 className="text-sm font-semibold">{step.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p></div></li>)}</ol>
                {chapter.demo === "lot" && <LotTutorialDemo />}
              </div>
              {chapter.example && <div className="rounded-xl border border-border p-4"><h3 className="mb-2 text-sm font-semibold">Exemplo de cálculo</h3><p className="text-sm leading-relaxed text-muted-foreground">{chapter.example}</p></div>}
              {chapter.table && <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><caption className="sr-only">Referências de {chapter.title}</caption><thead className="bg-muted"><tr>{chapter.table.headers.map(header => <th key={header} scope="col" className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{chapter.table.rows.map(row => <tr key={row[0]} className="border-t border-border">{row.map((cell, index) => <td key={index} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div>}
              <aside className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><Info className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed">{chapter.tip}</p></aside>
              {chapter.route && (!chapter.managerOnly || isGestor) && <Button variant="outline" className="h-auto min-h-11 whitespace-normal" onClick={() => { onClose(); void navigate(chapter.route!); }}><ExternalLink className="size-4 shrink-0" />Abrir página real</Button>}
            </article>
          </div>
        <footer className="tutorial-footer z-10 shrink-0 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-border/50" aria-hidden="true"><div className="h-full rounded-full bg-primary motion-safe:transition-all" style={{ width: `${(page + 1) / tutorialChapters.length * 100}%` }} /></div>
          <div className="flex items-center justify-between gap-2"><Button variant="outline" className="h-11 px-3" disabled={page === 0} onClick={() => selectPage(page - 1)}><ArrowLeft className="size-4" /><span>Anterior</span></Button><p className="text-center text-xs tabular-nums text-muted-foreground" aria-live="polite" aria-atomic="true">{page + 1} de {tutorialChapters.length}</p><Button className="h-11 px-3" onClick={() => page === tutorialChapters.length - 1 ? onClose() : selectPage(page + 1)}>{page === tutorialChapters.length - 1 ? "Concluir" : "Próxima"}<ArrowRight className="size-4" /></Button></div>
        </footer>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
