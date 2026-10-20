import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
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
import { usePens } from "@/hooks/use-pens";
import { healthEventTone, type HealthEvent } from "@/lib/domain";
import { formatDate, formatNumber, todayIso } from "@/lib/format";

const Occurrences = () => {
  const { t } = useTranslation();
  const today = todayIso();
  const { user } = useAuth();

  const eventsQuery = useHealthEvents();
  const animalsQuery = useAnimals();
  const lotsQuery = useLots();
  const pensQuery = usePens();
  const saveEvent = useSaveHealthEvent();

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const animals = useMemo(() => animalsQuery.data ?? [], [animalsQuery.data]);
  const lots = useMemo(() => lotsQuery.data ?? [], [lotsQuery.data]);
  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);

  const occurrences = useMemo(
    () =>
      events
        .filter((event) => event.kind === "obito" || Boolean(event.diagnosis))
        .sort((a, b) => (a.event_date < b.event_date ? 1 : -1)),
    [events],
  );

  const deaths = events.filter((event) => event.kind === "obito" && lots.some((lot) => lot.id === event.lot_id));
  const deathHead = deaths.reduce((sum, event) => sum + (event.head_count ?? 1), 0);
  const totalHead = lots.reduce((sum, lot) => sum + (lot.initial_head_count ?? lot.head_count), 0);
  const mortalityRate = totalHead > 0 ? (deathHead / totalHead) * 100 : null;

  const [open, setOpen] = useState(false);
  const [animalId, setAnimalId] = useState("");
  const [cause, setCause] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const animalOptions = animals
    .filter((animal) => animal.status === "ativo" || animal.status === "tratamento")
    .map((animal) => ({
      value: animal.id,
      labelKey: `${animal.ear_tag} · ${lots.find((lot) => lot.id === animal.lot_id)?.code ?? "—"}`,
    }));

  const submit = async () => {
    if (!animalId || !cause.trim()) {
      setError(t("toast.requiredFields"));
      return;
    }

    const animal = animals.find((item) => item.id === animalId);

    try {
      await saveEvent.mutateAsync({
        requestId,
        event: {
          animal_id: animalId,
          lot_id: animal?.lot_id ?? null,
          pen_id: animal?.pen_id ?? null,
          kind: "obito",
          diagnosis: cause.trim(),
          event_date: date,
          notes: notes.trim() || null,
          recorded_by: user?.id ?? null,
        },
      });


      setRequestId(crypto.randomUUID());
      toast.success(t("health.occurrences.saved"));
      setOpen(false);
      setAnimalId("");
      setCause("");
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
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
      key: "pen",
      headerKey: "field.pen",
      render: (event) => pens.find((pen) => pen.id === event.pen_id)?.code ?? "—",
    },
    {
      key: "cause",
      headerKey: "field.deathCause",
      render: (event) => event.diagnosis ?? "—",
    },
    { key: "notes", headerKey: "field.notes", render: (event) => event.notes ?? "—" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="health.occurrences.title"
        subtitleKey="health.occurrences.subtitle"
        actions={
          <Button className="h-10 w-40 max-w-full shrink-0 gap-1.5 px-2 py-1" onClick={() => setOpen(true)}>
            <Plus />
            <span className="min-w-0 whitespace-normal text-center leading-4">{t("health.occurrences.new")}</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          labelKey="health.mortality.rate"
          value={mortalityRate !== null ? formatNumber(mortalityRate, 2) : "—"}
          unitKey="common.unit.percent"
          icon={AlertTriangle}
        />
        <StatCard
          labelKey="dashboard.kpi.mortality"
          value={formatNumber(deathHead, 0)}
          unitKey="common.unit.head"
          icon={AlertTriangle}
          variant="agro"
        />
        <StatCard
          labelKey="health.occurrences.title"
          value={formatNumber(occurrences.length, 0)}
          icon={AlertTriangle}
        />
        <StatCard
          labelKey="dashboard.kpi.confined"
          value={formatNumber(lots.filter((lot) => lot.status === "ativo").reduce((sum, lot) => sum + lot.head_count, 0), 0)}
          unitKey="common.unit.head"
        />
      </div>

      <DataTable
        rows={occurrences}
        columns={columns}
        getRowKey={(event) => event.id}
        loading={eventsQuery.isLoading}
        emptyState={
          <EmptyState
            icon={AlertTriangle}
            titleKey="health.occurrences.empty.title"
            descriptionKey="health.occurrences.empty.description"
            action={
              <Button className="h-10 w-40 max-w-full shrink-0 gap-1.5 px-2 py-1" onClick={() => setOpen(true)}>
                <Plus />
                <span className="min-w-0 whitespace-normal text-center leading-4">{t("health.occurrences.new")}</span>
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
            <p className="text-sm">{event.diagnosis ?? "—"}</p>
            <p className="text-xs text-muted-foreground num">{formatDate(event.event_date)}</p>
          </div>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("health.occurrences.new")}</DialogTitle>
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
            <TextField
              className="sm:col-span-2"
              label={t("field.deathCause")}
              value={cause}
              onChange={(value) => {
                setCause(value);
                setError(null);
              }}
              error={error ?? undefined}
              required
            />
            <TextField label={t("field.date")} type="date" value={date} onChange={setDate} />
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

export default Occurrences;
