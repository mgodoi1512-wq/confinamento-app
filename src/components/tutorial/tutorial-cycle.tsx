import { useId, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, ClipboardList, HeartPulse, House, MapPin, Package, Scale, Sprout, TrendingUp, Utensils, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tutorialChapters, tutorialJourney } from "@/lib/tutorial";
import "./tutorial-cycle.css";

const icons = [House, MapPin, Sprout, Package, ClipboardList, Utensils, HeartPulse, Scale, TrendingUp, Wallet];

export function TutorialCycle({ onChapter }: { onChapter: (index: number) => void }) {
  const [active, setActive] = useState(0);
  const arrowId = useId();
  const detailId = useId();
  const step = tutorialJourney[active];
  const changeStep = (delta: number) => setActive(value => (value + delta + tutorialJourney.length) % tutorialJourney.length);

  return <section className="tutorial-cycle" aria-label="Ciclo de gestão da fazenda em dez etapas">
    <p className="text-center text-xs text-muted-foreground">Clique ou toque em uma etapa para ver o resultado no centro.</p>
    <div className="tutorial-cycle__orbit">
      <svg className="tutorial-cycle__lines" viewBox="0 0 100 100" aria-hidden="true">
        <defs><marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="currentColor" /></marker></defs>
        {tutorialJourney.map((_, index) => {
          const start = (index * 36 - 90 + 13) * Math.PI / 180;
          const end = (index * 36 - 90 + 23) * Math.PI / 180;
          return <path key={index} d={`M ${50 + 40 * Math.cos(start)} ${50 + 40 * Math.sin(start)} A40 40 0 0 1 ${50 + 40 * Math.cos(end)} ${50 + 40 * Math.sin(end)}`} fill="none" stroke="currentColor" strokeWidth=".35" markerEnd={`url(#${arrowId})`} />;
        })}
      </svg>
      <div id={detailId} className="tutorial-cycle__center" aria-live="polite" aria-atomic="true">
        <p className="tutorial-cycle__eyebrow">Resultado · {String(active + 1).padStart(2, "0")}/10</p>
        <h3>{step.shortTitle}</h3>
        <p className="tutorial-cycle__result">{step.result}</p>
      </div>
      {tutorialJourney.map((entry, index) => {
        const angle = (index * 36 - 90) * Math.PI / 180;
        const Icon = icons[index];
        return <button key={entry.title} type="button" className="tutorial-cycle__node" aria-label={`${index + 1}. ${entry.title}`} aria-pressed={active === index} aria-controls={detailId} onClick={() => setActive(index)} style={{ left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 40 * Math.sin(angle)}%` }}>
          <span className="tutorial-cycle__number">{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden="true" /><span className="tutorial-cycle__label">{entry.shortTitle}</span>
        </button>;
      })}
    </div>
    <div className="flex items-center justify-center gap-3">
      <Button variant="outline" size="icon" className="size-11 shrink-0" aria-label="Etapa anterior do ciclo" onClick={() => changeStep(-1)}><ArrowLeft className="size-4" /></Button>
      <p className="text-center text-xs text-muted-foreground">Etapa {active + 1} de 10</p>
      <Button variant="outline" size="icon" className="size-11 shrink-0" aria-label="Próxima etapa do ciclo" onClick={() => changeStep(1)}><ArrowRight className="size-4" /></Button>
    </div>
    <div className="mt-4 rounded-xl border border-border bg-card p-3 sm:p-4">
      <p className="mb-3 text-sm font-semibold">Aprenda esta etapa</p>
      <div className="flex flex-wrap gap-2">{step.chapters.map(id => {
        const index = tutorialChapters.findIndex(chapter => chapter.id === id);
        return <Button key={id} variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal text-left text-xs" onClick={() => onChapter(index)}><BookOpenText className="size-4 shrink-0" />{tutorialChapters[index].title}</Button>;
      })}</div>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Tratos, saúde e pesagens se repetem durante o manejo. A venda e o fluxo de caixa ajudam a planejar o próximo ciclo. Você pode consultar os capítulos na ordem que precisar.</p>
  </section>;
}
