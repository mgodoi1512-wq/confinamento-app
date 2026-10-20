import { useId } from "react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SELECT_ALL, type Option } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type SelectFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  error?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
};

/**
 * Seleção com rótulo. Opções com chave de tradução (contendo ".") são traduzidas;
 * rótulos literais (raças, códigos) são exibidos como estão. Use SELECT_ALL para "todos".
 */
export const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = false,
  emptyLabel,
  error,
  className,
  triggerClassName,
  disabled = false,
}: SelectFieldProps) => {
  const id = useId();
  const { t, i18n } = useTranslation();

  // Rótulos dinâmicos (códigos de curral, nomes) não são chaves de tradução.
  const labelOf = (option: Option) =>
    i18n.exists(option.labelKey) ? t(option.labelKey) : option.labelKey;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
      ) : null}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className={cn("h-11", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value={SELECT_ALL}>{emptyLabel ?? t("common.all")}</SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {labelOf(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
};
