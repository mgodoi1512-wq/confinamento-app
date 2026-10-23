import { locationName } from "@/lib/location-name";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, ShieldAlert, Syringe, ClipboardList } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnimals } from "@/hooks/use-animals";
import { useAuth } from "@/hooks/use-auth";
import { useHealthEvents, useSaveHealthEvent } from "@/hooks/use-health";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { healthEventTone, isUnderWithdrawal, type HealthEvent } from "@/lib/domain";
import { isValidIsoDate, addDays, formatDate, formatNumber, todayIso } from "@/lib/format";

import { emptyHealthFilters, filterHealthEvents, hasHealthFilters } from "./health-list";
import { HealthListFilters, WithdrawalSummary } from "./health-list-tools";

import { HealthAnimalField, WithdrawalDaysField } from "./health-form-fields";
import { parseWithdrawalDays, validateTreatmentForm, type HealthFormErrors } from "./health-form";

const Treatments = () => {
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

  const treatments = useMemo(
    () =>
      events
        .filter((event) => event.kind === "tratamento" || event.kind === "vacina")
        .sort((a, b) => b.event_date.localeCompare(a.event_date) || b.id.localeCompare(a.id)),
    [events],
  );

  const [filters, setFilters] = useState(emptyHealthFilters);
  const animalMap = useMemo(() => new Map(animals.map(animal => [animal.id, animal])), [animals]);
  const lotMap = useMemo(() => new Map(lots.map(lot => [lot.id, lot])), [lots]);
  const filtered = filterHealthEvents(treatments, filters, animalMap, lotMap, "treatments", today);
  const loading = eventsQuery.isLoading || animalsQuery.isLoading || lotsQuery.isLoading || pensQuery.isLoading;
  const failed = eventsQuery.isError || animalsQuery.isError || lotsQuery.isError || pensQuery.isError;
  const retry = () => void Promise.all([eventsQuery.refetch(), animalsQuery.refetch(), lotsQuery.refetch(), pensQuery.refetch()]);

  const [open, setOpen] = useState(false);
  const [animalId, setAnimalId] = useState("");
  const [kind, setKind] = useState("tratamento");
  const [product, setProduct] = useState("");
  const [dose, setDose] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [date, setDate] = useState(today);
  const [withdrawalDays, setWithdrawalDays] = useState("");
  const [notes, setNotes] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [fieldErrors, setFieldErrors] = useState<HealthFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const clearError = (field: keyof HealthFormErrors) => { setFieldErrors(current => ({ ...current, [field]: undefined })); setSubmitError(null); };
  const changeOpen = (next: boolean) => {
    if (savingRef.current) return;
    setOpen(next);
    setFieldErrors({});
    setSubmitError(null);
  };

  const eligibleIds = animals.filter(animal => animal.status === "ativo" || animal.status === "tratamento").map(animal => animal.id);
  const selectedAnimal = animals.find(animal => animal.id === animalId);
  const days = parseWithdrawalDays(withdrawalDays);
  const withdrawalUntil = days !== null && isValidIsoDate(date) ? addDays(date, days) : null;

  const inTreatment = animals.filter((animal) => animal.status === "tratamento").length;
  const underWithdrawal = animals.filter((animal) => (animal.status === "ativo" || animal.status === "tratamento") && isUnderWithdrawal(animal, today)).length;

  const validate = () => {
    const errors = validateTreatmentForm({ animalId, eligibleIds, date, today, product, withdrawal: withdrawalDays });
    setFieldErrors(errors);
    setSubmitError(null);
    return Object.keys(errors).length === 0;
  };
  const submit = async () => {
    if (savingRef.current || saveEvent.isPending) return;
    if (!validate()) { return; }
    const animal = selectedAnimal;
    savingRef.current = true;

    try {
      await saveEvent.mutateAsync({
        requestId,
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
      });

      setRequestId(crypto.randomUUID());
      toast.success(t("health.treatments.saved"));
      setOpen(false);
      setProduct("");
      setDose("");
      setDiagnosis("");
      setWithdrawalDays("");
      setNotes("");
      setAnimalId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.error.generic");
      setSubmitError(message);
      toast.error(message);
    } finally {
      savingRef.current = false;
    }
  };

  const columns: Column<HealthEvent>[] = [
    { key: "date", headerKey: "field.date", render: event => <div className="space-y-1 py-2"><p className="num">{formatDate(event.event_date)}</p><StatusBadge tone={healthEventTone(event.kind)} label={t(`status.event.${event.kind}`)} size="sm" /></div> },
    { key: "animal", headerKey: "Animal / lote", render: event => <div className="space-y-1"><p className="font-semibold">{animalMap.get(event.animal_id)?.ear_tag ?? "—"}</p><p className="text-xs text-muted-foreground">{lotMap.get(event.lot_id)?.code ?? "—"}</p></div> },
    { key: "product", headerKey: "field.product", render: event => event.product ?? "—" },
    { key: "dose", headerKey: "field.dose", render: event => event.dose ?? "—" },
    { key: "diagnosis", headerKey: "field.diagnosis", render: event => event.diagnosis ?? "—" },
    { key: "withdrawal", headerKey: "Carência do registro", render: event => <WithdrawalSummary event={event} today={today} /> },
  ];

  if (failed) return <div className="space-y-4"><PageHeader titleKey="health.treatments.title" /><div role="alert" className="rounded-lg border border-destructive/40 bg-card p-4"><p>{t("Não foi possível carregar os dados sanitários.")}</p><Button variant="outline" className="mt-3" onClick={retry}>{t("Tentar novamente")}</Button></div></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        titleKey="health.treatments.title"
        subtitleKey="health.treatments.subtitle"
        actions={
          <Button className="h-10 max-w-full shrink-0 gap-1.5 whitespace-nowrap px-4" onClick={() => changeOpen(true)}>
            <Plus />
            <span className="min-w-0 whitespace-normal text-center leading-4">{t("health.treatments.new")}</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard className="h-full [&>div:first-child>svg]:shrink-0" loading={loading} labelKey="Animais em tratamento" value={formatNumber(inTreatment, 0)} unitKey="common.unit.head" icon={ShieldAlert} note={t("Situação atual")} />
        <StatCard className="h-full [&>div:first-child>svg]:shrink-0" loading={loading} labelKey="Carência ativa" value={formatNumber(underWithdrawal, 0)} unitKey="common.unit.head" icon={ShieldAlert} variant={underWithdrawal > 0 ? "agro" : "default"} note={t("Animais presentes · situação atual")} />
        <StatCard className="h-full [&>div:first-child>svg]:shrink-0" loading={loading} labelKey="Tratamentos registrados" value={formatNumber(treatments.length, 0)} icon={Syringe} note={t("Histórico completo · inclui vacinas")} />
        <StatCard className="h-full [&>div:first-child>svg]:shrink-0" loading={loading} labelKey="Animais cadastrados" value={formatNumber(animals.length, 0)} unitKey="common.unit.head" note={t("Todos os status")} />
      </div>
      <p className="text-xs text-muted-foreground">{t("Indicadores gerais, independentes dos filtros da lista. A carência exibida em cada linha pertence àquela aplicação.")}</p>
      {(treatments.length > 0 || hasHealthFilters(filters)) && !loading && (
        <HealthListFilters value={filters} onChange={setFilters} lots={lots} mode="treatments" count={filtered.length} total={treatments.length} />
      )}

      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(event) => event.id}
        loading={loading}
        className="[&_table]:table-fixed [&_th]:text-center [&_td]:text-center [&_td]:py-2 [&_td]:break-words [&_td]:[overflow-wrap:anywhere]"
        emptyState={
          <EmptyState className="min-h-0 gap-2 py-5" icon={ClipboardList}
            titleKey={treatments.length > 0 ? "Nenhum tratamento encontrado" : "health.treatments.empty.title"}
            descriptionKey={treatments.length > 0 ? "Ajuste ou limpe os filtros para consultar outros registros." : "Registre a primeira aplicação para acompanhar os tratamentos e prazos de carência."}
            action={treatments.length > 0
              ? <Button variant="outline" className="h-10" onClick={() => setFilters(emptyHealthFilters())}>{t("Limpar filtros")}</Button>
              : <Button className="h-10 gap-1.5 whitespace-nowrap px-4" onClick={() => changeOpen(true)}><Plus />{t("health.treatments.new")}</Button>}
          />
        }
        renderCard={event => (
          <article className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-display text-base font-semibold">{animalMap.get(event.animal_id)?.ear_tag ?? "—"}</p><p className="text-xs text-muted-foreground">{t("field.lot")}: {lotMap.get(event.lot_id)?.code ?? "—"}</p></div><StatusBadge tone={healthEventTone(event.kind)} label={t(`status.event.${event.kind}`)} size="sm" /></div>
            <p className="text-sm font-medium">{event.product ?? "—"}</p>
            <div className="grid grid-cols-2 gap-3 text-xs"><p><span className="text-muted-foreground">{t("field.date")}: </span><span className="num">{formatDate(event.event_date)}</span></p><p><span className="text-muted-foreground">{t("field.dose")}: </span>{event.dose ?? "—"}</p></div>
            {event.diagnosis && <p className="text-xs"><span className="text-muted-foreground">{t("field.diagnosis")}: </span>{event.diagnosis}</p>}
            {event.notes && <p className="text-xs text-muted-foreground">{event.notes}</p>}
            <div className="border-t border-border pt-1"><WithdrawalSummary event={event} today={today} /></div>
          </article>
        )}
      />

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-[680px] flex-col gap-0 overflow-hidden p-0 dark:[color-scheme:dark]">
          <DialogHeader className="shrink-0 border-b border-border p-4 text-left sm:px-5">
            <DialogTitle>{t("health.treatments.new")}</DialogTitle>
            <DialogDescription>{t("Registre a aplicação e o prazo indicado na bula. Campos com * são obrigatórios.")}</DialogDescription>
          </DialogHeader>
          <form noValidate id="health-treatment-form" className="min-h-0 overflow-y-auto p-4 sm:px-5" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <fieldset disabled={saveEvent.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0 [&_label]:text-sm [&_label]:font-medium [&_input]:h-11">
              <div className="sm:col-span-2"><HealthAnimalField animals={animals} lots={lots} pens={pens} value={animalId} onChange={value => { setAnimalId(value); clearError("animal"); }} error={fieldErrors.animal} /></div>
              <SelectField label={t("field.kind")} value={kind} onChange={setKind} options={[{ value: "tratamento", labelKey: "status.event.tratamento" }, { value: "vacina", labelKey: "status.event.vacina" }]} />
              <TextField label={t("field.date")} type="date" required value={date} onChange={value => { setDate(value); clearError("date"); }} error={fieldErrors.date && t(fieldErrors.date)} />
              <TextField className="sm:col-span-2" label={t("field.product")} required placeholder={t("Nome do produto aplicado")} value={product} onChange={value => { setProduct(value); clearError("product"); }} error={fieldErrors.product && t(fieldErrors.product)} />
              <TextField label={t("field.dose")} placeholder={t("Quantidade + unidade")} value={dose} onChange={setDose} helper={t("Inclua a unidade e a referência de aplicação.")} />
              <WithdrawalDaysField value={withdrawalDays} onChange={value => { setWithdrawalDays(value); clearError("withdrawal"); }} until={withdrawalUntil} error={fieldErrors.withdrawal} />
              <TextField className="sm:col-span-2" label={t("field.diagnosis")} placeholder={t("Descreva o diagnóstico, se houver")} value={diagnosis} onChange={setDiagnosis} />
              <TextField className="sm:col-span-2" label={t("field.notes")} textarea value={notes} onChange={setNotes} />
            </fieldset>
          </form>
          {submitError && <p role="alert" className="shrink-0 border-t border-destructive/40 px-4 py-2 text-sm text-destructive">{submitError}</p>}
          <DialogFooter className="shrink-0 gap-2 border-t border-border p-4 sm:px-5">
            <Button type="button" variant="outline" disabled={saveEvent.isPending} onClick={() => changeOpen(false)}>{t("action.cancel")}</Button>
            <Button type="submit" form="health-treatment-form" disabled={saveEvent.isPending}><Save />{t(saveEvent.isPending ? "Salvando…" : "Salvar tratamento")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Treatments;
