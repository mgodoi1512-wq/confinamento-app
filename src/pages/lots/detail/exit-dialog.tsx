import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { NumericField } from "@/components/app/numeric-field";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRegisterExit } from "@/hooks/use-lots";
import { useAnimals } from "@/hooks/use-animals";
import { EXIT_REASON_OPTIONS } from "@/lib/constants";
import { isUnderWithdrawal, type Lot } from "@/lib/domain";
import { formatNumber, isValidIsoDate, parseNumberInput, todayIso } from "@/lib/format";

export const ExitDialog = ({ lot, readyHead, open: externalOpen, onOpenChange, hideTrigger = false }: { lot: Lot; readyHead: number; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) => {
  const { t } = useTranslation();
  const [localOpen, setLocalOpen] = useState(false);
  const open = externalOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  const [reason, setReason] = useState("abate");
  const [animalIds, setAnimalIds] = useState<string[]>([]);
  const [anonymousHead, setAnonymousHead] = useState("");
  const [weight, setWeight] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(todayIso());
  const [closeLot, setCloseLot] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const animalsQuery = useAnimals();
  const registerExit = useRegisterExit();
  const animals = (animalsQuery.data ?? []).filter((animal) => animal.lot_id === lot.id && (animal.status === "ativo" || animal.status === "tratamento"));
  const unregistered = Math.max(lot.head_count - animals.length, 0);
  const anonymous = parseNumberInput(anonymousHead) ?? 0;
  const head = animalIds.length + anonymous;
  const blocked = (animal: typeof animals[number]) => reason === "abate" &&
    (animal.status === "tratamento" || isUnderWithdrawal(animal, date));

  const submit = async () => {
    const weightKg = parseNumberInput(weight);
    if (animalsQuery.isLoading || animalsQuery.isError || !isValidIsoDate(date) || date < lot.entry_date || date > todayIso() ||
      !Number.isInteger(anonymous) || anonymous < 0 || anonymous > unregistered ||
      !Number.isInteger(head) || head <= 0 || head > lot.head_count ||
      (weight.trim() && (!weightKg || weightKg <= 0)) ||
      (closeLot && head !== lot.head_count) ||
      (reason === "abate" && anonymous > 0) ||
      animalIds.some((id) => { const animal = animals.find((item) => item.id === id); return !animal || blocked(animal); })) {
      setError("Confira a data, a quantidade e os animais selecionados. Abate exige identificação e carência liberada; só encerre o lote ao zerar o saldo.");
      return;
    }
    try {
      await registerExit.mutateAsync({ lot, reason: reason as "abate" | "venda" | "obito", headCount: head,
        animalIds, weightKg, destination: destination.trim() || null, date, closeLot, requestId });
      toast.success(t("lots.exit.saved", { head: formatNumber(head, 0) }));
      setRequestId(crypto.randomUUID()); setAnimalIds([]); setAnonymousHead(""); setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : t("toast.error.generic")); }
  };
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); setError(null); }}>
    {!hideTrigger && <DialogTrigger asChild><Button variant="outline" className="h-10"><LogOut />{t("action.registerExit")}</Button></DialogTrigger>}
    <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
      <DialogHeader><DialogTitle>{t("lots.exit.title")}</DialogTitle><DialogDescription>
        {lot.code} · {formatNumber(lot.head_count, 0)} cabeças · {readyHead} com peso alvo e carência liberada
      </DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label={t("lots.exit.kind")} value={reason} onChange={(value) => { setReason(value); setAnimalIds([]); setAnonymousHead(""); }} options={EXIT_REASON_OPTIONS} />
        <TextField label={t("field.date")} type="date" value={date} onChange={setDate} />
        <NumericField label="Peso médio dos animais que saíram (opcional)" unit="kg" value={weight} onValueChange={setWeight} />
        <TextField label={t("lots.exit.destination")} value={destination} onChange={setDestination} />
      </div>
      <fieldset className="space-y-2"><legend className="font-medium">Selecione os animais que saíram</legend>
        {animalsQuery.isLoading && <p>Carregando animais…</p>}
        {animalsQuery.isError && <p role="alert">Falha ao carregar animais. Tente novamente.</p>}
        {animals.map((animal) => <label key={animal.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={animalIds.includes(animal.id)} disabled={blocked(animal)}
            onChange={(event) => setAnimalIds((ids) => event.target.checked ? [...ids, animal.id] : ids.filter((id) => id !== animal.id))} />
          {animal.ear_tag}{blocked(animal) ? " · em tratamento ou carência" : ""}
        </label>)}
      </fieldset>
      {unregistered > 0 && <NumericField label={`Cabeças sem identificação (saldo: ${unregistered}; venda ou óbito)`}
        inputMode="numeric" value={anonymousHead} onValueChange={setAnonymousHead} />}
      <p className="text-sm">Quantidade de saída: {head} · Saldo após saída: {lot.head_count - head}</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={closeLot} onChange={(event) => setCloseLot(event.target.checked)} />{t("lots.detail.close")}</label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("action.cancel")}</Button>
        <Button onClick={() => void submit()} disabled={registerExit.isPending || animalsQuery.isLoading || animalsQuery.isError}>{t("action.confirm")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};
