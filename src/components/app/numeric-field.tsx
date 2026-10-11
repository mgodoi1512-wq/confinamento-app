import { useId } from "react";
import { Calculator } from "lucide-react";

import { cn } from "@/lib/utils";

export type NumericFieldProps = {
  label?: string;
  unit?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
  inputMode?: "decimal" | "numeric";
};

/** Campo numérico pt-BR com vírgula, sufixo de unidade e teclado numérico no celular. */
export const NumericField = ({
  label,
  unit,
  value,
  onValueChange,
  placeholder,
  helper,
  error,
  readOnly = false,
  disabled = false,
  className,
  compact = false,
  autoFocus = false,
  onEnter,
  inputMode = "decimal",
}: NumericFieldProps) => {
  const id = useId();

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label
          htmlFor={id}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
        >
          {label}
          {readOnly ? <Calculator className="size-3.5" /> : null}
        </label>
      ) : null}

      <div
        className={cn(
          "flex items-center rounded-md border bg-background transition-colors duration-150",
          compact ? "h-10" : "h-12",
          error ? "border-destructive" : "border-input",
          readOnly && "bg-muted",
          disabled && "opacity-60",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        )}
      >
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint={onEnter ? "next" : "done"}
          readOnly={readOnly}
          disabled={disabled}
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && onEnter) {
              event.preventDefault();
              onEnter();
            }
          }}
          placeholder={placeholder}
          className={cn(
            "h-full w-full min-w-0 bg-transparent px-3 text-right font-display font-semibold num outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground",
            compact ? "text-base" : "text-lg",
          )}
        />
        {unit ? (
          <span className="pointer-events-none select-none pr-3 text-sm font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
};
