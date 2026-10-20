import { locationName } from "@/lib/location-name";
import { compatibleLocation } from "@/lib/production-systems";
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

export const TransferDialog = ({ lot, open: externalOpen, onOpenChange, hideTrigger = false }: { lot: Lot; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) => {
  const { t } = useTranslation();
  const [localOpen, setLocalOpen] = useState(false);
  const open = externalOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  const [penId, setPenId] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const transfer = useTransferLot();

  const pens = pensQuery.data ?? [];
  const occupancy = computePenOccupancy(pens, lotsQuery.data ?? []).filter(
    (item) => compatibleLocation(lot.production_system,item.pen.location_type)&&item.pen.id !== lot.pen_id && !["manutencao","inativo"].includes(item.pen.status) && item.free >= lot.head_count,
  );

  const submit = async () => {
    if (!penId) {
      setError(t("toast.requiredFields"));
      return;
    }

    try {
      await transfer.mutateAsync({ lot, penId, requestId });
      setRequestId(crypto.randomUUID());
      toast.success(
        t("lots.transfer.saved", { code: locationName(pens.find((pen) => pen.id === penId), "") }),
      );
      setOpen(false);
      setPenId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && <DialogTrigger asChild>
        <Button variant="outline" className="h-10">
          <ArrowRightLeft />
          {t("action.transfer")}
        </Button>
      </DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lots.transfer.title")}</DialogTitle>
          <DialogDescription>
            {t("lots.transfer.from")}:{" "}
            {locationName(pens.find((pen) => pen.id === lot.pen_id), t("common.noData"))}
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
            labelKey: `${locationName(item.pen)} · ${t("dashboard.occupancy.free", { head: item.free })}`,
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
