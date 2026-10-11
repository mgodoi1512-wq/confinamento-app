import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SelectField } from "@/components/form/select-field";
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
import { useLots, useTransferLot } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { computePenOccupancy, type Lot } from "@/lib/domain";
import { ArrowRightLeft } from "lucide-react";

export const TransferDialog = ({ lot }: { lot: Lot }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [penId, setPenId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const transfer = useTransferLot();

  const pens = pensQuery.data ?? [];
  const occupancy = computePenOccupancy(pens, lotsQuery.data ?? []).filter(
    (item) => item.pen.id !== lot.pen_id && item.pen.status !== "manutencao",
  );

  const submit = async () => {
    if (!penId) {
      setError(t("toast.requiredFields"));
      return;
    }

    try {
      await transfer.mutateAsync({ lot, penId });
      toast.success(
        t("lots.transfer.saved", { code: pens.find((pen) => pen.id === penId)?.code ?? "" }),
      );
      setOpen(false);
      setPenId("");
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10">
          <ArrowRightLeft />
          {t("action.transfer")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lots.transfer.title")}</DialogTitle>
          <DialogDescription>
            {t("lots.transfer.from")}:{" "}
            {pens.find((pen) => pen.id === lot.pen_id)?.code ?? t("common.noData")}
          </DialogDescription>
        </DialogHeader>

        <SelectField
          label={t("lots.transfer.to")}
          value={penId}
          onChange={(value) => {
            setPenId(value);
            setError(null);
          }}
          error={error ?? undefined}
          placeholder={t("field.pen")}
          options={occupancy.map((item) => ({
            value: item.pen.id,
            labelKey: `${item.pen.code} · ${t("dashboard.occupancy.free", { head: item.free })}`,
          }))}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("action.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={transfer.isPending}>
            {t("action.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
