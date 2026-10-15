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
import { computeLotMetrics, dietTotalKg } from "@/lib/domain";
import { useWeighings } from "@/hooks/use-weighings";
import { FEED_SHIFT_OPTIONS, SELECT_ALL } from "@/lib/constants";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";

const nameOrder = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export const FeedFormDialog = ({ trigger }: { trigger: ReactNode }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const dietsQuery = useDiets();
  const dietItemsQuery = useDietItems();
  const weighingsQuery = useWeighings();
  const saveFeedLog = useSaveFeedLog();

  const pens = pensQuery.data ?? [];
  const penCodes = new Map(pens.map(pen => [pen.id, pen.code]));
  const activeLots = (lotsQuery.data ?? [])
    .filter(lot => lot.status === "ativo")
    .sort((a, b) =>
      nameOrder.compare(penCodes.get(a.pen_id ?? "") ?? "", penCodes.get(b.pen_id ?? "") ?? "")
      || nameOrder.compare(a.code, b.code)
      || a.id.localeCompare(b.id),
    );
  const allDiets = dietsQuery.data ?? [];
  const diets = allDiets.filter(diet => diet.is_active);
  const dietItems = useMemo(() => dietItemsQuery.data ?? [], [dietItemsQuery.data]);

  const [penId, setPenId] = useState("");
  const [shift, setShift] = useState("manha");
  const [dietId, setDietId] = useState("");
  const [headCount, setHeadCount] = useState("");
  const [kgOverride, setKgOverride] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lot = activeLots.find((item) => item.pen_id === penId) ?? null;

  const activeDietId = diets.find(diet => diet.id === dietId)?.id ?? "";
  const lotHasInactiveDiet = Boolean(lot?.diet_id && allDiets.some(diet => diet.id === lot.diet_id && !diet.is_active));
  const referenceWeight = lot && weighingsQuery.isSuccess
    ? computeLotMetrics(lot, weighingsQuery.data ?? []).currentAvgWeight : null;
  const selectedItems = dietItems.filter(item => item.diet_id === activeDietId);
  const dietTotal = dietTotalKg(selectedItems, referenceWeight);
  const kgPerHead = kgOverride ?? (dietTotal !== null && dietTotal > 0 ? String(Math.round(dietTotal * 1000) / 1000) : "");

  const selectPen = (value: string) => {
    setPenId(value);
    setError(null);
    setKgOverride(null);
    const selectedLot = activeLots.find(item => item.pen_id === value);
    setHeadCount(selectedLot ? String(selectedLot.head_count) : "");
    setDietId(diets.find(diet => diet.id === selectedLot?.diet_id)?.id ?? "");
  };

  const perHead = parseNumberInput(kgPerHead) ?? 0;
  const head = parseNumberInput(headCount) ?? 0;

  const submit = async () => {
    if (!penId || perHead <= 0 || head <= 0) {
      setError(t("toast.requiredFields"));
      return;
    }

    if ((dietId && !activeDietId) || (lotHasInactiveDiet && !activeDietId)) {
      setError("A dieta do lote está inativa. Selecione uma dieta ativa antes de salvar.");
      return;
    }
    try {
      await saveFeedLog.mutateAsync({
        pen_id: penId,
        lot_id: lot?.id ?? null,
        date: todayIso(),
        shift,
        diet_id: activeDietId || null,
        head_count: head,
        kg_per_head: perHead,
        total_kg: Math.round(perHead * head * 100) / 100,
        notes: notes.trim() || null,
      });
      toast.success(t("feed.saved"));
      setOpen(false);
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
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
            value={activeDietId || SELECT_ALL}
            onChange={value => { setDietId(value === SELECT_ALL ? "" : value); setKgOverride(null); }}
            allowEmpty
            emptyLabel={t("common.noData")}
            options={diets.map((diet) => ({ value: diet.id, labelKey: diet.name }))}
            disabled={dietsQuery.isLoading || dietsQuery.isError}
            error={lotHasInactiveDiet && !activeDietId ? "A dieta vinculada ao lote está inativa. Escolha uma dieta ativa." : undefined}
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
            onValueChange={setKgOverride}
            helper={dietTotal === null
              ? "A dieta percentual precisa de um peso médio válido para calcular a sugestão. Você pode informar a oferta manualmente."
              : dietTotal > 0
                ? `Referência diária: ${formatNumber(dietTotal, 3)} kg/cab/dia${referenceWeight ? ` · Peso médio: ${formatNumber(referenceWeight, 1)} kg` : ""}. Confira a parcela deste turno.`
                : undefined}
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
          <Button onClick={() => void submit()} disabled={saveFeedLog.isPending || dietsQuery.isLoading || dietsQuery.isError || (lotHasInactiveDiet && !activeDietId)}>
            {t("action.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
