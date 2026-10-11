import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { NumericField } from "@/components/app/numeric-field";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSaveAnimal } from "@/hooks/use-animals";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { BREED_OPTIONS, SEX_OPTIONS } from "@/lib/constants";
import type { Animal } from "@/lib/domain";
import { parseNumberInput } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "ativo", labelKey: "status.animal.ativo" },
  { value: "tratamento", labelKey: "status.animal.tratamento" },
  { value: "abatido", labelKey: "status.animal.abatido" },
  { value: "vendido", labelKey: "status.animal.vendido" },
  { value: "morto", labelKey: "status.animal.morto" },
];

const HEALTH_OPTIONS = [
  { value: "saudavel", labelKey: "status.health.saudavel" },
  { value: "tratamento", labelKey: "status.health.tratamento" },
  { value: "observacao", labelKey: "status.health.observacao" },
  { value: "carencia", labelKey: "status.health.carencia" },
];

export const AnimalFormDialog = ({
  animal,
  trigger,
}: {
  animal?: Animal;
  trigger: ReactNode;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const saveAnimal = useSaveAnimal();

  const [earTag, setEarTag] = useState(animal?.ear_tag ?? "");
  const [sisbov, setSisbov] = useState(animal?.sisbov ?? "");
  const [lotId, setLotId] = useState(animal?.lot_id ?? "");
  const [penId, setPenId] = useState(animal?.pen_id ?? "");
  const [breed, setBreed] = useState(animal?.breed ?? BREED_OPTIONS[0].value);
  const [sex, setSex] = useState(animal?.sex ?? SEX_OPTIONS[0].value);
  const [entryWeight, setEntryWeight] = useState(
    animal?.entry_weight_kg ? String(animal.entry_weight_kg) : "",
  );
  const [currentWeight, setCurrentWeight] = useState(
    animal?.current_weight_kg ? String(animal.current_weight_kg) : "",
  );
  const [status, setStatus] = useState(animal?.status ?? "ativo");
  const [healthStatus, setHealthStatus] = useState(animal?.health_status ?? "saudavel");
  const [withdrawalUntil, setWithdrawalUntil] = useState(animal?.withdrawal_until ?? "");
  const [notes, setNotes] = useState(animal?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const lots = lotsQuery.data ?? [];
  const pens = pensQuery.data ?? [];

  const submit = async () => {
    if (!earTag.trim()) {
      setError(t("toast.requiredFields"));
      return;
    }

    try {
      await saveAnimal.mutateAsync({
        id: animal?.id,
        ear_tag: earTag.trim(),
        sisbov: sisbov.trim() || null,
        lot_id: lotId || null,
        pen_id: penId || null,
        breed: breed || null,
        sex: sex || null,
        entry_weight_kg: parseNumberInput(entryWeight),
        current_weight_kg: parseNumberInput(currentWeight),
        status,
        health_status: healthStatus,
        withdrawal_until: withdrawalUntil || null,
        notes: notes.trim() || null,
      });
      toast.success(t("animals.saved"));
      setOpen(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "";
      if (message === "duplicate-ear-tag") {
        setError(t("lots.new.dupEarTag", { tag: earTag.trim() }));
        return;
      }
      console.error(saveError);

toast.error(
  saveError instanceof Error
    ? saveError.message
    : "Erro desconhecido"
);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{animal ? t("animals.edit") : t("animals.new")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("field.earTag")}
            value={earTag}
            onChange={(value) => {
              setEarTag(value);
              setError(null);
            }}
            error={error ?? undefined}
            required
          />
          <TextField label={t("field.sisbov")} value={sisbov} onChange={setSisbov} />
          <SelectField
            label={t("field.lot")}
            value={lotId}
            onChange={setLotId}
            allowEmpty
            emptyLabel={t("common.noData")}
            options={lots.map((lot) => ({ value: lot.id, labelKey: lot.code }))}
          />
          <SelectField
            label={t("field.pen")}
            value={penId}
            onChange={setPenId}
            allowEmpty
            emptyLabel={t("common.noData")}
            options={pens.map((pen) => ({ value: pen.id, labelKey: pen.code }))}
          />
          <SelectField label={t("field.breed")} value={breed} onChange={setBreed} options={BREED_OPTIONS} />
          <SelectField label={t("field.sex")} value={sex} onChange={setSex} options={SEX_OPTIONS} />
          <NumericField
            label={t("field.entryWeight")}
            unit="kg"
            value={entryWeight}
            onValueChange={setEntryWeight}
          />
          <NumericField
            label={t("field.currentWeight")}
            unit="kg"
            value={currentWeight}
            onValueChange={setCurrentWeight}
          />
          <SelectField
            label={t("field.status")}
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
          <SelectField
            label={t("field.healthStatus")}
            value={healthStatus}
            onChange={setHealthStatus}
            options={HEALTH_OPTIONS}
          />
          <TextField
            label={t("field.withdrawalUntil")}
            type="date"
            value={withdrawalUntil}
            onChange={setWithdrawalUntil}
          />
          <TextField
            className="sm:col-span-2"
            label={t("field.notes")}
            value={notes}
            onChange={setNotes}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={saveAnimal.isPending}>
            {t("action.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
