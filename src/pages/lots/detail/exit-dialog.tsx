import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

import { NumericField } from "@/components/app/numeric-field";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRegisterExit } from "@/hooks/use-lots";
import { EXIT_REASON_OPTIONS } from "@/lib/constants";
import type { Lot } from "@/lib/domain";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";

export const ExitDialog = ({ lot, readyHead }: { lot: Lot; readyHead: number }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("abate");
  const [headCount, setHeadCount] = useState(String(readyHead || lot.head_count));
  const [weight, setWeight] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(todayIso());
  const [closeLot, setCloseLot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerExit = useRegisterExit();

  const head = parseNumberInput(headCount) ?? 0;

  const submit = async () => {
    if (head <= 0) {
      setError(t("toast.requiredFields"));
      return;
    }

    try {
      await registerExit.mutateAsync({
        lot,
        reason: reason as "abate" | "venda" | "obito",
        headCount: head,
        weightKg: parseNumberInput(weight),
        destination: destination.trim() || null,
        date,
        closeLot,
      });
      toast.success(t("lots.exit.saved", { head: formatNumber(head, 0) }));
      setOpen(false);
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10">
          <LogOut />
          {t("action.registerExit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("lots.exit.title")}</DialogTitle>
          <DialogDescription>
            {lot.code} · {formatNumber(lot.head_count, 0)} {t("common.unit.head")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("lots.exit.kind")}
            value={reason}
            onChange={setReason}
            options={EXIT_REASON_OPTIONS}
          />
          <TextField label={t("field.date")} type="date" value={date} onChange={setDate} />
          <NumericField
            label={t("lots.exit.headCount")}
            unit="cab."
            inputMode="numeric"
            value={headCount}
            onValueChange={setHeadCount}
            error={error ?? undefined}
          />
          <NumericField
            label={t("lots.exit.weight")}
            unit="kg"
            value={weight}
            onValueChange={setWeight}
          />
          <TextField
            className="sm:col-span-2"
            label={t("lots.exit.destination")}
            value={destination}
            onChange={setDestination}
            placeholder="Frigorífico, comprador ou destino"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={closeLot}
            onChange={(event) => setCloseLot(event.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          {t("lots.detail.close")}
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={registerExit.isPending}>
            {t("action.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
