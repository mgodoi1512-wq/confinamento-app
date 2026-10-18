import { useId, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { computePenDailyFeeding } from "@/lib/domain";
import { formatNumber } from "@/lib/format";

type Props = { summary: ReturnType<typeof computePenDailyFeeding> | null; error?: boolean };
const shiftNames = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

/** Balão por hover/foco; toque abre e toque fora ou Escape fecha. */
const FeedingInfo = ({ label, children, content, className }: { label: string; children: ReactNode; content: ReactNode; className: string }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined}
        className={`${className} rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
        onPointerEnter={event=>{if(event.pointerType==="mouse")setOpen(true);}}
        onPointerLeave={event=>{if(event.pointerType==="mouse")setOpen(false);}}
        onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)}
        onClick={event=>{event.preventDefault();event.stopPropagation();setOpen(true);}}>
        {children}
      </button>
    </PopoverTrigger>
    <PopoverContent aria-label="Informações do trato" side="top" sideOffset={8} className="pointer-events-none z-[100] w-auto max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2 text-xs"
      onOpenAutoFocus={event=>event.preventDefault()} onCloseAutoFocus={event=>event.preventDefault()}>
      <div id={id}>{content}</div>
    </PopoverContent>
  </Popover>;
};

export const PenFeedingStatus = ({ summary, error }: Props) => <div className="inline-flex items-center gap-1" aria-label="Tratos: manhã, tarde e noite">
  {(["manha","tarde","noite"] as const).map(shift=>{
    const item=summary?.shifts.find(item=>item.shift===shift);
    const empty=item?.total===0;
    const status=!item ? error ? "Informação indisponível" : "Carregando tratos..."
      : empty ? summary?.activeLots ? "Não previsto" : "Sem lote"
      : item.complete ? "Fornecido" : item.served ? `Parcial: ${item.served} de ${item.total} lotes` : "Não fornecido";
    const label=`${shiftNames[shift]}: ${status}`;
    return <FeedingInfo key={shift} label={label} className="inline-flex h-8 w-7 shrink-0 items-center justify-center [@media(pointer:coarse)]:size-11"
      content={<><p className="font-medium">{shiftNames[shift]}</p><p>{status}</p></>}>
      <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${!item||empty ? "bg-muted-foreground/40" : item.complete ? "bg-green-600 dark:bg-green-400" : "bg-red-600 dark:bg-red-400"}`} />
    </FeedingInfo>;
  })}
</div>;

export const PenFeedingProgress = ({ summary, error }: Props) => {
  const percent=summary?.percent??null;
  const headline=summary ? percent===null ? "Sem referência diária" : `${formatNumber(percent,1)}% da dieta diária`
    : error ? "Fornecimento indisponível" : "Carregando fornecimento...";
  const quantities=summary ? percent===null ? `${formatNumber(summary.suppliedKg,1)} kg fornecidos` : `${formatNumber(summary.suppliedKg,1)} kg de ${formatNumber(summary.recommendedKg,1)} kg previstos` : "";
  const extra=summary ? percent===null ? summary.reason : percent>100 ? "Acima da recomendação diária" : "Mistura: ração + volumoso" : null;
  return <FeedingInfo label={[headline,quantities,extra].filter(Boolean).join(". ")}
    className="flex h-8 w-full min-w-36 max-w-52 items-center px-1 [@media(pointer:coarse)]:min-h-11"
    content={<div className="space-y-1"><p className="font-medium num">{headline}</p>{quantities&&<p className="num">{quantities}</p>}{extra&&<p>{extra}</p>}</div>}>
    <span aria-hidden="true" className="block h-2 w-full overflow-hidden rounded-full bg-[#DCCABC] dark:bg-[#8A705C]">
      {percent!==null&&<span className="block h-full bg-green-600 dark:bg-green-400" style={{width:`${Math.min(Math.max(percent,0),100)}%`}} />}
    </span>
  </FeedingInfo>;
};
