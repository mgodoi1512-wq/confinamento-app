import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Reserva espaço e só mostra o indicador em esperas perceptíveis. */
export const PageLoading = ({
  fullScreen = false,
  rows = 5,
}: {
  fullScreen?: boolean;
  rows?: number;
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      aria-busy="true"
      aria-label="Carregando página"
      className={cn("flex w-full items-center justify-center", fullScreen && "min-h-dvh bg-background p-6")}
      style={fullScreen ? undefined : { minHeight: Math.max(240, rows * 44) }}
    >
      <div
        role="status"
        className={cn(
          "flex flex-col items-center gap-3 text-foreground/60 transition-opacity duration-150 motion-reduce:transition-none",
          visible ? "opacity-100" : "invisible opacity-0",
        )}
      >
        {fullScreen && (
          <>
            <img src="/logo-liben-2.webp" alt="LiBen Agronegócios" width={80} height={80} className="size-20 rounded-xl object-contain dark:hidden" />
            <img src="/logo-liben-dark.webp" alt="LiBen Agronegócios" width={80} height={80} className="hidden size-20 rounded-xl object-contain dark:block" />
          </>
        )}
        <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
        <span className="text-sm">Carregando...</span>
      </div>
    </div>
  );
};
