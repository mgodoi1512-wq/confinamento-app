import { useId } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  textarea?: boolean;
  className?: string;
  monospace?: boolean;
};

/** Campo de texto com rótulo, dica e erro — base dos formulários do sistema. */
export const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  helper,
  required = false,
  textarea = false,
  className,
  monospace = false,
}: TextFieldProps) => {
  const id = useId();

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>

      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(
            "min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            monospace && "font-mono",
          )}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn("h-11", monospace && "font-mono")}
        />
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
};
