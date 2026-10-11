import { useMemo, useState, type ReactNode } from "react";
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
import { useDietItems, useDiets } from "@/hooks/use-diets";
import { useSaveFeedLog } from "@/hooks/use-feed";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { FEED_SHIFT_OPTIONS } from "@/lib/constants";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";

export const FeedFormDialog = ({ trigger }: { trigger: ReactNode }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const dietsQuery = useDiets();
  const dietItemsQuery = useDietItems();
  const saveFeedLog = useSaveFeedLog();

  const activeLots = (lotsQuery.data ?? []).filter((lot) => lot.status === "ativo");
  const pens = pensQuery.data ?? [];
  const diets = dietsQuery.data ?? [];
  const dietItems = useMemo(() => dietItemsQuery.data ?? [], [dietItemsQuery.data]);

  const [penId, setPenId] = useState("");
  const [shift, setShift] = useState("manha");
  const [dietId, setDietId] = useState("");
  const [headCount, setHeadCount] = useState("");
  const [kgPerHead, setKgPerHead] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lot = activeLots.find((item) => item.pen_id === penId) ?? null;

  const dietTotal = useMemo(
    () =>
      dietItems
        .filter((item) => item.diet_id === (dietId || lot?.diet_id))
        .reduce((sum, item) => sum + item.kg_per_head_day, 0),
    [dietItems, dietId, lot?.diet_id],
  );

  const selectPen = (value: string) => {
    setPenId(value);
    setError(null);
    const selectedLot = activeLots.find((item) => item.pen_id === value);
    if (selectedLot) {
      setHeadCount(String(selectedLot.head_count));
      setDietId(selectedLot.diet_id ?? "");
      const total = dietItems
        .filter((item) => item.diet_id === selectedLot.diet_id)
        .reduce((sum, item) => sum + item.kg_per_head_day, 0);
      setKgPerHead(total > 0 ? String(total) : "");
    }
  };

  const perHead = parseNumberInput(kgPerHead) ?? 0;
  const head = parseNumberInput(headCount) ?? 0;

  const submit = async () => {
    if (!penId || perHead <= 0 || head <= 0) {
      setError(t("toast.requiredFields"));
      return;
    }

    try {
      await saveFeedLog.mutateAsync({
        pen_id: penId,
        lot_id: lot?.id ?? null,
        date: todayIso(),
        shift,
        diet_id: dietId || lot?.diet_id || null,
        head_count: head,
        kg_per_head: perHead,
        total_kg: Math.round(perHead * head * 100) / 100,
        notes: notes.trim() || null,
      });
      toast.success(t("feed.saved"));
      setOpen(false);
      setNotes("");
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("feed.new")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("feed.pen")}
            value={penId}
            onChange={selectPen}
            placeholder={t("field.pen")}
            options={activeLots.map((item) => ({
              value: item.pen_id ?? item.id,
              labelKey: `${pens.find((pen) => pen.id === item.pen_id)?.code ?? "—"} · ${item.code}`,
            }))}
          />
          <SelectField
            label={t("feed.shift")}
            value={shift}
            onChange={setShift}
            options={FEED_SHIFT_OPTIONS}
          />
          <SelectField
            label={t("feed.dietUsed")}
            value={dietId}
            onChange={setDietId}
            allowEmpty
            emptyLabel={t("common.noData")}
            options={diets.map((diet) => ({ value: diet.id, labelKey: diet.name }))}
          />
          <NumericField
            label={t("field.headCount")}
            unit="cab."
            inputMode="numeric"
            value={headCount}
            onValueChange={setHeadCount}
            error={error ?? undefined}
          />
          <NumericField
            label={t("feed.kgPerHead")}
            unit="kg"
            value={kgPerHead}
            onValueChange={setKgPerHead}
            helper={dietTotal > 0 ? `${t("config.diets.totalOffered")}: ${formatNumber(dietTotal, 2)} kg` : undefined}
          />
          <NumericField
            label={t("feed.total")}
            unit="kg"
            value={formatNumber(perHead * head, 1)}
            onValueChange={() => undefined}
            readOnly
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
          <Button onClick={() => void submit()} disabled={saveFeedLog.isPending}>
            {t("action.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
