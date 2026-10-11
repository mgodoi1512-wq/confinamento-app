import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pencil, Scale, ShieldAlert, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDeleteAnimal } from "@/hooks/use-animals";
import { useHealthEvents } from "@/hooks/use-health";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useWeightRecords, useWeighings } from "@/hooks/use-weighings";
import {
  animalGain,
  animalStatusTone,
  healthTone,
  healthEventTone,
  liveWeightToArroba,
  withdrawalDaysLeft,
  type Animal,
} from "@/lib/domain";
import { formatDate, formatNumber } from "@/lib/format";
import { AnimalFormDialog } from "./animal-form-dialog";

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="num font-medium">{value}</span>
  </div>
);

export const AnimalDetailSheet = ({
  animal,
  onClose,
}: {
  animal: Animal | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const deleteAnimal = useDeleteAnimal();
  const lotsQuery = useLots();
  const pensQuery = usePens();
  const healthQuery = useHealthEvents();
  const weighingsQuery = useWeighings();
  const recordsQuery = useWeightRecords();

  if (!animal) return null;

  const lot = (lotsQuery.data ?? []).find((item) => item.id === animal.lot_id);
  const pen = (pensQuery.data ?? []).find((item) => item.id === animal.pen_id);
  const events = (healthQuery.data ?? []).filter((event) => event.animal_id === animal.id);

  const weighingIds = new Set(
    (weighingsQuery.data ?? []).filter((w) => w.lot_id === animal.lot_id).map((w) => w.id),
  );
  const weights = (recordsQuery.data ?? [])
    .filter((record) => record.animal_id === animal.id && weighingIds.has(record.weighing_id))
    .sort((a, b) => (a.weight_kg < b.weight_kg ? 1 : -1));

  const gain = animalGain(animal);
  const arroba = liveWeightToArroba(animal.current_weight_kg);
  const withdrawal = withdrawalDaysLeft(animal);

  const remove = async () => {
    try {
      await deleteAnimal.mutateAsync(animal.id);
      toast.success(t("animals.deleted"));
      onClose();
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <Sheet open={Boolean(animal)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">
            {t("animals.detail.title", { tag: animal.ear_tag })}
          </SheetTitle>
          <SheetDescription>
            {t("field.lot")} {lot?.code ?? "—"} · {t("field.pen")} {pen?.code ?? "—"}
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <StatusBadge
              tone={animalStatusTone(animal.status)}
              label={t(`status.animal.${animal.status}`)}
            />
            <StatusBadge
              tone={healthTone(animal.health_status)}
              label={t(`status.health.${animal.health_status}`)}
            />
            {withdrawal > 0 ? (
              <StatusBadge
                tone="agro"
                label={t("health.withdrawalUntil", {
                  date: formatDate(animal.withdrawal_until),
                })}
              />
            ) : null}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <section>
            <h3 className="mb-2 font-display text-sm font-semibold">
              {t("lots.detail.performance")}
            </h3>
            <div className="rounded-lg border border-border px-3 py-1">
              <Row
                label={t("field.entryWeight")}
                value={
                  animal.entry_weight_kg ? `${formatNumber(animal.entry_weight_kg, 1)} kg` : "—"
                }
              />
              <Separator />
              <Row
                label={t("field.currentWeight")}
                value={
                  animal.current_weight_kg
                    ? `${formatNumber(animal.current_weight_kg, 1)} kg`
                    : "—"
                }
              />
              <Separator />
              <Row
                label={t("animals.detail.gain")}
                value={gain !== null ? `${formatNumber(gain, 1)} kg` : "—"}
              />
              <Separator />
              <Row
                label={t("animals.detail.arroba")}
                value={arroba !== null ? `${formatNumber(arroba, 1)} @` : "—"}
              />
              <Separator />
              <Row label={t("field.sisbov")} value={animal.sisbov ?? "—"} />
              <Separator />
              <Row label={t("field.breed")} value={animal.breed ?? "—"} />
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
              <Scale className="size-4 text-muted-foreground" />
              {t("animals.detail.weights")}
            </h3>
            {weights.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("weighings.detail.noRecords")}</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {weights.slice(0, 6).map((record) => (
                  <li
                    key={record.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="num">{formatNumber(record.weight_kg, 1)} kg</span>
                    <span className="num text-muted-foreground">
                      {formatNumber(liveWeightToArroba(record.weight_kg) ?? 0, 1)} @
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
              <ShieldAlert className="size-4 text-muted-foreground" />
              {t("animals.detail.health")}
            </h3>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("animals.detail.noEvents")}</p>
            ) : (
              <ul className="space-y-2">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <StatusBadge
                        tone={healthEventTone(event.kind)}
                        label={t(`status.event.${event.kind}`)}
                        size="sm"
                      />
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {event.product ?? event.diagnosis ?? "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs num text-muted-foreground">
                      {formatDate(event.event_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex items-center gap-2 pb-4">
            <AnimalFormDialog
              animal={animal}
              trigger={
                <Button variant="outline" className="h-11 flex-1">
                  <Pencil />
                  {t("action.edit")}
                </Button>
              }
            />
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              onClick={() => void remove()}
              disabled={deleteAnimal.isPending}
            >
              <Trash2 />
              {t("action.delete")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
