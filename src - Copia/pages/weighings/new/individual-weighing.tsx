import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Pencil } from "lucide-react";

import { NumericField } from "@/components/app/numeric-field";
import { Button } from "@/components/ui/button";
import type { Animal } from "@/lib/domain";
import { formatNumber, parseNumberInput } from "@/lib/format";

type Props = {
  animals: Animal[];
  weights: Record<string, string>;
  inputs: Record<string, string>;
  cursor: string;
  average: number | null;
  onCursorChange: (cursor: string) => void;
  onInputChange: (id: string, value: string) => void;
  onRegister: (id: string, weight: string) => void;
  onPendingChange: (pending: boolean) => void;
};

function AnimalWeight({ animal, savedWeight, value, onInputChange, willReview, onRegister, onPendingChange }: {
  animal: Animal; savedWeight: string; value: string; onInputChange: (value: string) => void;
  willReview: boolean; onRegister: (weight: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [error, setError] = useState<string>();
  useEffect(() => { onPendingChange(value !== savedWeight); }, [value, savedWeight, onPendingChange]);
  const register = () => {
    const weight = parseNumberInput(value);
    if (weight === null || weight <= 0) {
      setError("Informe um peso válido maior que zero.");
      return;
    }
    onPendingChange(false);
    onRegister(value);
  };
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Brinco do animal</p>
        <p className="break-words font-sans text-3xl font-bold text-foreground">{animal.ear_tag}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {animal.current_weight_kg === null ? "Sem peso anterior informado" : `Último peso registrado: ${formatNumber(animal.current_weight_kg, 1)} kg`}
        </p>
      </div>
      <NumericField label="Peso nesta pesagem" unit="kg" value={value} autoFocus
        placeholder="Informe o peso" error={error}
        onValueChange={(next) => { onInputChange(next); setError(undefined); }} onEnter={register} />
      <Button className="h-11 w-full" onClick={register}>
        <Check /> {willReview ? "Registrar e revisar" : "Registrar e próximo"} <ArrowRight />
      </Button>
    </div>
  );
}

export function IndividualWeighing({ animals, weights, inputs, cursor, average, onInputChange, onCursorChange, onRegister, onPendingChange }: Props) {
  const index = cursor === "__review__" ? animals.length : Math.max(0, animals.findIndex(animal => animal.id === cursor));
  const current = animals[index];
  const registered = animals.filter((animal) => parseNumberInput(weights[animal.id] ?? "") !== null);
  const navigate = (next: number) => { onPendingChange(false); onCursorChange(animals[next]?.id ?? "__review__"); };
  const register = (weight: string) => {
    if (!current) return;
    onRegister(current.id, weight);
    const next = animals.findIndex((animal, position) => position > index && !weights[animal.id]);
    const previous = animals.findIndex((animal, position) => position < index && !weights[animal.id]);
    onCursorChange(animals[next >= 0 ? next : previous >= 0 ? previous : animals.length]?.id ?? "__review__");
  };
  return (
    <section className="space-y-2" aria-label="Pesagem animal por animal">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <h2 className="font-semibold">Pesagem individual</h2>
        <span className="text-muted-foreground">Média: <strong className="text-foreground">{average === null ? "—" : `${formatNumber(average, 1)} kg`}</strong></span>
        <span className="text-muted-foreground" aria-live="polite">{registered.length} de {animals.length} animais registrados</span>
      </div>
      <div role="progressbar" aria-label="Animais registrados" aria-valuenow={registered.length} aria-valuemin={0} aria-valuemax={animals.length}
        className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${animals.length ? registered.length / animals.length * 100 : 0}%` }} />
      </div>
      {current ? (
        <>
          <AnimalWeight key={current.id} animal={current} savedWeight={weights[current.id] ?? ""}
            value={inputs[current.id] ?? weights[current.id] ?? ""}
            onInputChange={value => onInputChange(current.id, value)}
            willReview={animals.every(animal => animal.id === current.id || !!weights[animal.id])}
            onRegister={register} onPendingChange={onPendingChange} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" className="h-10" disabled={index === 0} onClick={() => navigate(index - 1)}><ArrowLeft /> Anterior</Button>
            <Button variant="ghost" className="h-10" onClick={() => navigate(index + 1)}>Pular animal <ArrowRight /></Button>
          </div>
          <Button variant="link" className="h-auto px-0" onClick={() => navigate(animals.length)}>Revisar pesos</Button>
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold">Revisão dos pesos</p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {animals.map((animal, position) => (
              <button key={animal.id} type="button" onClick={() => navigate(position)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-ring">
                <span className="min-w-0 break-words">Brinco <strong>{animal.ear_tag}</strong></span>
                <span className="flex shrink-0 items-center gap-2">
                  {weights[animal.id] ? `${formatNumber(parseNumberInput(weights[animal.id]), 1)} kg` : "Não pesado"}
                  <Pencil className="size-3.5 text-muted-foreground" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Somente pesos registrados serão enviados. Animais pulados não serão alterados.</p>
    </section>
  );
}
