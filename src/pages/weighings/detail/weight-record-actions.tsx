import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { NumericField } from "@/components/app/numeric-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCorrectWeightRecord } from "@/hooks/use-weighings";
import type { WeightRecord } from "@/lib/domain";
import { formatNumber, parseNumberInput } from "@/lib/format";

type Intent = { record: WeightRecord; count: number; requestId: string };

export const WeightRecordActions = ({ record, count, animalLabel }: {
  record: WeightRecord; count: number; animalLabel: string;
}) => {
  const { t } = useTranslation();
  const correction = useCorrectWeightRecord();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = () => {
    setIntent({ record: { ...record }, count, requestId: crypto.randomUUID() });
    setWeight(String(record.weight_kg)); setError(null);
  };
  const submit = async () => {
    if (!intent || correction.isPending) return;
    const parsed = parseNumberInput(weight);
    if (parsed === null || parsed <= 0 || parsed > 99999.99 || Math.round(parsed * 100) <= 0) {
      setError(t("weighings.record.invalidWeight")); return;
    }
    setError(null);
    try {
      await correction.mutateAsync({ record: intent.record, count: intent.count, weight: parsed, requestId: intent.requestId });
      toast.success(t("weighings.record.updated"));
      setIntent(null);
    } catch (error) { setError(error instanceof Error ? error.message : t("toast.error.generic")); }
  };
  return <>
    <Button variant="outline" size="sm" disabled={correction.isPending} onClick={open}>
      <Pencil />{t("weighings.record.edit")}
    </Button>
    <Dialog open={Boolean(intent)} onOpenChange={(value) => { if (!value && !correction.isPending) setIntent(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("weighings.record.edit")}</DialogTitle>
          <DialogDescription>{t("weighings.record.context", { tag: animalLabel, weight: formatNumber(intent?.record.weight_kg, 2) })}</DialogDescription>
        </DialogHeader>
        <NumericField label={t("field.weight")} unit="kg" value={weight} onValueChange={setWeight} autoFocus disabled={correction.isPending} helper={t("weighings.record.precision")} />
        <p className="text-xs text-muted-foreground">{t("weighings.record.recalculate")}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={correction.isPending} onClick={() => setIntent(null)}>{t("action.cancel")}</Button>
          <Button disabled={correction.isPending} onClick={() => void submit()}>{t("action.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
};
