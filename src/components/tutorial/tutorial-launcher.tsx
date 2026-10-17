import { lazy, Suspense, useRef, useState } from "react";
import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";

const TutorialDialog = lazy(() => import("./tutorial-dialog"));

export const TutorialLauncher = ({ currentPath }: { currentPath: string }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); };
  return <>
    <Button ref={triggerRef} variant="ghost" className="h-10 shrink-0 px-2 sm:px-3" aria-label="Abrir tutorial" aria-haspopup="dialog" title="Tutorial da plataforma" onClick={() => setOpen(true)}><BookOpenText className="size-5" /><span className="hidden sm:inline">Tutorial</span></Button>
    {open && <Suspense fallback={<div className="fixed inset-0 z-[70] grid place-items-center bg-background p-6"><div className="space-y-4 text-center"><p role="status">Carregando tutorial…</p><Button variant="outline" onClick={close}>Cancelar</Button></div></div>}><TutorialDialog currentPath={currentPath} onClose={close} /></Suspense>}
  </>;
};
