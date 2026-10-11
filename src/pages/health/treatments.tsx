import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, ShieldAlert, Syringe } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnimals } from "@/hooks/use-animals";
import { useAuth } from "@/hooks/use-auth";
import { useHealthEvents, useSaveHealthEvent } from "@/hooks/use-health";
import { useLots } from "@/hooks/use-lots";
import { healthEventTone, isUnderWithdrawal, type HealthEvent } from "@/lib/domain";
import { addDays, formatDate, formatNumber, parseNumberInput, todayIso } from "@/lib/format";

const Treatments = () => {
  const { t } = useTranslation();
  const today = todayIso();
  const { user } = useAuth();

  const eventsQuery = useHealthEvents();
  const animalsQuery = useAnimals();
  const lotsQuery = useLots();
  const saveEvent = useSaveHealthEvent();

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const animals = useMemo(() => animalsQuery.data ?? [], [animalsQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);

  const treatments = useMemo(
    () =>
      events
        .filter((event) => event.kind === "tratamento" || event.kind === "vacina")
        .sort((a, b) => (a.event_date < b.event_date ? 1 : -1)),
    [events],
  );

  const [open, setOpen] = useState(false);
  const [animalId, setAnimalId] = useState("");
  const [kind, setKind] = useState("tratamento");
  const [product, setProduct] = useState("");
  const [dose, setDose] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [date, setDate] = useState(today);
  const [withdrawalDays, setWithdrawalDays] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const animalOptions = animals
    .filter((animal) => animal.status !== "morto" && animal.status !== "abatido")
    .map((animal) => ({
      value: animal.id,
      labelKey: `${animal.ear_tag} · ${lots.find((lot) => lot.id === animal.lot_id)?.code ?? "—"}`,
    }));

  const days = parseNumberInput(withdrawalDays) ?? 0;
  const withdrawalUntil = days > 0 ? addDays(date, days) : null;

  const inTreatment = animals.filter((animal) => animal.health_status === "tratamento").length;
  const underWithdrawal = animals.filter((animal) => isUnderWithdrawal(animal, today)).length;

  const submit = async () => {
    if (!animalId || !product.trim()) {
      setError(t("toast.requiredFields"));
      return;
    }

    const animal = animals.find((item) => item.id === animalId);

    try {
      await saveEvent.mutateAsync({
        event: {
          animal_id: animalId,
          lot_id: animal?.lot_id ?? null,
          pen_id: animal?.pen_id ?? null,
          kind,
          product: product.trim(),
          dose: dose.trim() || null,
          diagnosis: diagnosis.trim() || null,
          event_date: date,
          withdrawal_until: withdrawalUntil,
          notes: notes.trim() || null,
          recorded_by: user?.id ?? null,
        },
        animalUpdate: {
          id: animalId,
          status: kind === "tratamento" ? "tratamento" : "ativo",
          health_status: days > 0 ? "carencia" : kind === "tratamento" ? "tratamento" : "saudavel",
          withdrawal_until: withdrawalUntil,
        },
      });

      toast.success(t("health.treatments.saved"));
      setOpen(false);
      setProduct("");
      setDose("");
      setDiagnosis("");
      setWithdrawalDays("");
      setNotes("");
      setAnimalId("");
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  const columns: Column<HealthEvent>[] = [
    { key: "date", headerKey: "field.date", render: (event) => formatDate(event.event_date) },
    {
      key: "kind",
      headerKey: "field.kind",
      render: (event) => (
        <StatusBadge
          tone={healthEventTone(event.kind)}
          label={t(`status.event.${event.kind}`)}
          icon={event.kind === "vacina" ? Syringe : ShieldAlert}
          size="sm"
        />
      ),
    },
    {
      key: "animal",
      headerKey: "field.earTag",
      render: (event) => (
        <span className="font-display text-sm font-semibold">
          {animals.find((animal) => animal.id === event.animal_id)?.ear_tag ?? "—"}
        </span>
      ),
    },
    {
      key: "lot",
      headerKey: "field.lot",
      render: (event) => lots.find((lot) => lot.id === event.lot_id)?.code ?? "—",
    },
    { key: "product", headerKey: "field.product", render: (event) => event.product ?? "—" },
    { key: "dose", headerKey: "field.dose", render: (event) => event.dose ?? "—" },
    { key: "diagnosis", headerKey: "field.diagnosis", render: (event) => event.diagnosis ?? "—" },
    {
      key: "withdrawal",
      headerKey: "health.withdrawalUntil",
      numeric: true,
      render: (event) => (event.withdrawal_until ? formatDate(event.withdrawal_until) : "—"),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="health.treatments.title"
        subtitleKey="health.treatments.subtitle"
        actions={
          <Button className="h-10" onClick={() => setOpen(true)}>
            <Plus />
            {t("health.treatments.new")}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          labelKey="health.morbidity.rate"
          value={formatNumber(inTreatment, 0)}
          unitKey="common.unit.head"
          icon={ShieldAlert}
        />
        <StatCard
          labelKey="status.health.carencia"
          value={formatNumber(underWithdrawal, 0)}
          unitKey="common.unit.head"
          icon={ShieldAlert}
          variant="agro"
        />
        <StatCard
          labelKey="health.treatments.title"
          value={formatNumber(treatments.length, 0)}
          icon={Syringe}
        />
        <StatCard
          labelKey="field.animalCount"
          value={formatNumber(animals.length, 0)}
          unitKey="common.unit.head"
        />
      </div>

      <DataTable
        rows={treatments}
        columns={columns}
        getRowKey={(event) => event.id}
        loading={eventsQuery.isLoading}
        emptyState={
          <EmptyState
            icon={ShieldAlert}
            titleKey="health.treatments.empty.title"
            descriptionKey="health.treatments.empty.description"
            action={
              <Button className="h-10" onClick={() => setOpen(true)}>
                {t("health.treatments.new")}
              </Button>
            }
          />
        }
        renderCard={(event) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-base font-semibold">
                {animals.find((animal) => animal.id === event.animal_id)?.ear_tag ?? "—"}
              </span>
              <StatusBadge
                tone={healthEventTone(event.kind)}
                label={t(`status.event.${event.kind}`)}
                size="sm"
              />
            </div>
            <p className="text-sm">{event.product ?? "—"}</p>
            <p className="text-xs text-muted-foreground num">
              {formatDate(event.event_date)}
              {event.withdrawal_until
                ? ` · ${t("health.withdrawalUntil", { date: formatDate(event.withdrawal_until) })}`
                : ""}
            </p>
          </div>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("health.treatments.new")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              className="sm:col-span-2"
              label={t("health.treatments.selectAnimal")}
              value={animalId}
              onChange={(value) => {
                setAnimalId(value);
                setError(null);
              }}
              placeholder={t("field.earTag")}
              options={animalOptions}
            />
            <SelectField
              label={t("field.kind")}
              value={kind}
              onChange={setKind}
              options={[
                { value: "tratamento", labelKey: "status.event.tratamento" },
                { value: "vacina", labelKey: "status.event.vacina" },
              ]}
            />
            <TextField label={t("field.date")} type="date" value={date} onChange={setDate} />
            <TextField
              label={t("field.product")}
              value={product}
              onChange={(value) => {
                setProduct(value);
                setError(null);
              }}
              error={error ?? undefined}
              required
            />
            <TextField label={t("field.dose")} value={dose} onChange={setDose} />
            <TextField label={t("field.diagnosis")} value={diagnosis} onChange={setDiagnosis} />
            <NumericField
              label={t("field.withdrawalDays")}
              unit={t("common.unit.days")}
              inputMode="numeric"
              value={withdrawalDays}
              onValueChange={setWithdrawalDays}
              helper={
                withdrawalUntil
                  ? t("health.withdrawalUntil", { date: formatDate(withdrawalUntil) })
                  : undefined
              }
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
            <Button onClick={() => void submit()} disabled={saveEvent.isPending}>
              <Save />
              {t("action.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Treatments;
