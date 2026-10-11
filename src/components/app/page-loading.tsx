import { cn } from "@/lib/utils";

/** Esqueleto de carregamento que espelha o layout final. */
export const PageLoading = ({
  fullScreen = false,
  rows = 5,
}: {
  fullScreen?: boolean;
  rows?: number;
}) => (
  <div
    className={cn(
      "w-full space-y-3",
      fullScreen && "flex min-h-dvh items-center justify-center p-6",
    )}
  >
    <div className={cn(fullScreen && "w-full max-w-md space-y-3")}>
      {Array.from({ length: fullScreen ? 3 : rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "animate-pulse rounded-md bg-muted",
            fullScreen ? "h-11" : index === 0 ? "h-8" : "h-10",
          )}
        />
      ))}
    </div>
  </div>
);
