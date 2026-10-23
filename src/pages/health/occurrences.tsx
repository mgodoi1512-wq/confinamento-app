import { locationName } from "@/lib/location-name";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Plus, Save, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
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
import { type HealthEvent } from "@/lib/domain";
import { isValidIsoDate, formatDate, formatNumber, todayIso } from "@/lib/format";

import { emptyHealthFilters, filterHealthEvents, hasHealthFilters } from "./health-list";
import { HealthListFilters, HealthMetricHelp } from "./health-list-tools";

import { HealthAnimalField } from "./health-form-fields";
import { validateDeathForm, type HealthFormErrors } from "./health-form";

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
        .sort((a, b) => b.event_date.localeCompare(a.event_date) || b.id.localeCompare(a.id)),
    [events],
  );

  const deaths = events.filter((event) => event.kind === "obito" && lots.some((lot) => lot.id === event.lot_id));
  const deathHead = deaths.reduce((sum, event) => sum + (event.head_count ?? 1), 0);
  const totalHead = lots.reduce((sum, lot) => sum + (lot.initial_head_count ?? lot.head_count), 0);
  const mortalityRate = totalHead > 0 ? (deathHead / totalHead) * 100 : null;

  const [filters, setFilters] = useState(emptyHealthFilters);
  const animalMap = useMemo(() => new Map(animals.map(animal => [animal.id, animal])), [animals]);
  const lotMap = useMemo(() => new Map(lots.map(lot => [lot.id, lot])), [lots]);
  const filtered = filterHealthEvents(occurrences, filters, animalMap, lotMap, "occurrences", today);
  const loading = eventsQuery.isLoading || animalsQuery.isLoading || lotsQuery.isLoading || pensQuery.isLoading;
  const failed = eventsQuery.isError || animalsQuery.isError || lotsQuery.isError || pensQuery.isError;
  const retry = () => void Promise.all([eventsQuery.refetch(), animalsQuery.refetch(), lotsQuery.refetch(), pensQuery.refetch()]);

  const [open, setOpen] = useState(false);
  const [animalId, setAnimalId] = useState("");
  const [cause, setCause] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [fieldErrors, setFieldErrors] = useState<HealthFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);

  const clearError = (field: keyof HealthFormErrors) => { setFieldErrors(current => ({ ...current, [field]: undefined })); setSubmitError(null); };
  const changeOpen = (next: boolean) => {
    if (savingRef.current) return;
    setOpen(next);
    setFieldErrors({});
    setSubmitError(null);
    if (!next) setConfirming(false);
  };

  const eligibleIds = animals.filter(animal => animal.status === "ativo" || animal.status === "tratamento").map(animal => animal.id);
  const selectedAnimal = animals.find(animal => animal.id === animalId);
  const validate = () => {
    const errors = validateDeathForm({ animalId, eligibleIds, date, today, cause });
    setFieldErrors(errors);
    setSubmitError(null);
    return Object.keys(errors).length === 0;
  };
  const prepareConfirmation = () => { if (!savingRef.current && validate()) setConfirming(true); };
  const submit = async () => {
    if (savingRef.current || saveEvent.isPending || !confirming) return;
    if (!validate()) { setConfirming(false); return; }
    const animal = selectedAnimal;
    savingRef.current = true;

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
      setConfirming(false);
      setAnimalId("");
      setCause("");
      setNotes("");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.error.generic");
      setSubmitError(message);
      toast.error(message);
    } finally {
      savingRef.current = false;
    }
  };

  const columns: Column<HealthEvent>[] = [
    { key: "date", headerKey: "field.date", render: event => <span className="num">{formatDate(event.event_date)}</span> },
    { key: "kind", headerKey: "field.kind", render: event => <StatusBadge tone={event.kind === "obito" ? "destructive" : "warning"} label={t(event.kind === "obito" ? "Óbito" : "Caso clínico")} size="sm" /> },
    { key: "animal", headerKey: "Animal / lote", render: event => <div className="space-y-1 py-2"><p className="font-semibold">{animalMap.get(event.animal_id)?.ear_tag ?? "—"}</p><p className="text-xs text-muted-foreground">{lotMap.get(event.lot_id)?.code ?? "—"}</p></div> },
    { key: "pen", headerKey: "field.pen", render: event => locationName(pens.find(pen => pen.id === event.pen_id), "—") },
    { key: "description", headerKey: "Descrição / causa", render: event => event.diagnosis ?? "—" },
    { key: "notes", headerKey: "field.notes", render: event => event.notes ?? "—" },
  ];

  if (failed) return <div className="space-y-4"><PageHeader titleKey="health.occurrences.title" /><div role="alert" className="rounded-lg border border-destructive/40 bg-card p-4"><p>{t("Não foi possível carregar os dados sanitários.")}</p><Button variant="outline" className="mt-3" onClick={retry}>{t("Tentar novamente")}</Button></div></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        titleKey="health.occurrences.title"
        subtitleKey="health.occurrences.subtitle"
        actions={
          <Button className="h-10 max-w-full shrink-0 gap-1.5 whitespace-nowrap px-4" onClick={() => changeOpen(true)}>
            <Plus />
            <span>{t("Nova ocorrência")}</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="relative">
          <StatCard className="h-full [&>div:first-child]:pr-7" loading={loading} labelKey="Taxa de mortalidade" value={mortalityRate !== null ? formatNumber(mortalityRate, 2) : "—"} unitKey="common.unit.percent" note={t("Acumulada · lotes cadastrados")} />
          <HealthMetricHelp label={t("Como a mortalidade é calculada?")}>{t("Óbitos vinculados aos lotes cadastrados ÷ total de cabeças de entrada desses lotes × 100. Inclui lotes ativos e encerrados, em todo o histórico. Usa a quantidade inicial do lote; quando ausente, usa a quantidade cadastrada. Sem base de animais, a taxa aparece como —. Os filtros abaixo não alteram esse cálculo.")}</HealthMetricHelp>
        </div>
        <StatCard className="h-full [&>div:first-child>svg]:shrink-0" loading={loading} labelKey="Óbitos registrados" value={formatNumber(deathHead, 0)} unitKey="common.unit.head" icon={AlertTriangle} variant={deathHead > 0 ? "agro" : "default"} note={t("Acumulados · lotes cadastrados")} />
        <StatCard className="h-full [&>div:first-child>svg]:shrink-0" loading={loading} labelKey="Ocorrências registradas" value={formatNumber(occurrences.length, 0)} icon={ClipboardList} note={t("Histórico completo · casos e óbitos")} />
        <StatCard className="h-full [&>div:first-child>svg]:shrink-0" loading={loading} labelKey="Animais confinados" value={formatNumber(lots.filter(lot => lot.status === "ativo").reduce((sum, lot) => sum + lot.head_count, 0), 0)} unitKey="common.unit.head" note={t("Situação atual · lotes ativos")} />
      </div>
      <p className="text-xs text-muted-foreground">{t("Indicadores gerais, independentes dos filtros da lista. Casos clínicos correspondem a registros com diagnóstico.")}</p>
      {(occurrences.length > 0 || hasHealthFilters(filters)) && !loading && (
        <HealthListFilters value={filters} onChange={setFilters} lots={lots} mode="occurrences" count={filtered.length} total={occurrences.length} />
      )}

      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(event) => event.id}
        loading={loading}
        className="[&_table]:table-fixed [&_th]:text-center [&_td]:text-center [&_td]:py-2 [&_td]:break-words [&_td]:[overflow-wrap:anywhere]"
        emptyState={
          <EmptyState className="min-h-0 gap-2 py-5" icon={ClipboardList}
            titleKey={occurrences.length > 0 ? "Nenhuma ocorrência encontrada" : "health.occurrences.empty.title"}
            descriptionKey={occurrences.length > 0 ? "Ajuste ou limpe os filtros para consultar outros registros." : "Registre casos clínicos e óbitos para acompanhar a saúde do rebanho."}
            action={occurrences.length > 0
              ? <Button variant="outline" className="h-10" onClick={() => setFilters(emptyHealthFilters())}>{t("Limpar filtros")}</Button>
              : <Button className="h-10 gap-1.5 whitespace-nowrap px-4" onClick={() => changeOpen(true)}><Plus />{t("Nova ocorrência")}</Button>}
          />
        }
        renderCard={event => (
          <article className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-display text-base font-semibold">{animalMap.get(event.animal_id)?.ear_tag ?? "—"}</p><p className="text-xs text-muted-foreground">{t("field.lot")}: {lotMap.get(event.lot_id)?.code ?? "—"}</p></div><StatusBadge tone={event.kind === "obito" ? "destructive" : "warning"} label={t(event.kind === "obito" ? "Óbito" : "Caso clínico")} size="sm" /></div>
            <p className="text-sm">{event.diagnosis ?? "—"}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="num">{formatDate(event.event_date)}</span><span>{t("field.pen")}: {locationName(pens.find(pen => pen.id === event.pen_id), "—")}</span></div>
            {event.notes && <p className="border-t border-border pt-2 text-xs text-muted-foreground">{event.notes}</p>}
          </article>
        )}
      />

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-[600px] flex-col gap-0 overflow-hidden p-0 dark:[color-scheme:dark]">
          <DialogHeader className="shrink-0 border-b border-border p-4 text-left sm:px-5">
            <DialogTitle>{t(confirming ? "Confirmar registro de óbito" : "Registrar óbito")}</DialogTitle>
            <DialogDescription>{confirming ? t("Confira o animal e a data antes de concluir.") : <>{t("Para casos clínicos, informe o diagnóstico em")} <Link to="/sanidade/tratamentos" className="underline">{t("health.treatments.title")}</Link>. {t("Campos com * são obrigatórios.")}</>}</DialogDescription>
          </DialogHeader>
          {confirming ? (
            <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:px-5">
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm [overflow-wrap:anywhere]">
                <div><dt className="text-xs text-muted-foreground">{t("Animal")}</dt><dd className="font-semibold">{selectedAnimal?.ear_tag ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t("field.date")}</dt><dd className="font-semibold num">{isValidIsoDate(date) ? formatDate(date) : "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t("field.lot")}</dt><dd>{lotMap.get(selectedAnimal?.lot_id)?.code ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{t("field.pen")}</dt><dd>{locationName(pens.find(pen => pen.id === selectedAnimal?.pen_id), "—")}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">{t("Causa informada")}</dt><dd>{cause}</dd></div>
                {notes.trim() && <div className="col-span-2"><dt className="text-xs text-muted-foreground">{t("field.notes")}</dt><dd className="whitespace-pre-wrap">{notes}</dd></div>}
              </dl>
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{t("Ao confirmar, o animal será marcado como morto. Se estiver em um lote, será registrada a saída de 1 cabeça e atualizado o saldo desse lote.")}</p>
            </div>
          ) : (
            <form noValidate id="health-death-form" className="min-h-0 overflow-y-auto p-4 sm:px-5" onSubmit={event => { event.preventDefault(); prepareConfirmation(); }}>
              <fieldset disabled={saveEvent.isPending} className="grid min-w-0 gap-4 [&>div]:min-w-0 [&_label]:text-sm [&_label]:font-medium">
                <HealthAnimalField animals={animals} lots={lots} pens={pens} value={animalId} onChange={value => { setAnimalId(value); clearError("animal"); }} error={fieldErrors.animal} />
                <div className="space-y-2">
                  <TextField label={t("Causa informada")} required placeholder={t("Informe a causa, quando conhecida")} value={cause} onChange={value => { setCause(value); clearError("cause"); }} error={fieldErrors.cause && t(fieldErrors.cause)} />
                  <label className="flex min-h-10 w-fit items-center gap-2 text-sm"><input className="size-4 accent-primary" type="checkbox" checked={cause === "Não determinada"} onChange={event => { setCause(event.target.checked ? "Não determinada" : ""); clearError("cause"); }} />{t("Causa não determinada")}</label>
                </div>
                <TextField label={t("field.date")} required type="date" value={date} onChange={value => { setDate(value); clearError("date"); }} error={fieldErrors.date && t(fieldErrors.date)} />
                <TextField label={t("field.notes")} textarea placeholder={t("Descreva as observações do registro, se houver")} value={notes} onChange={setNotes} />
              </fieldset>
            </form>
          )}
          {submitError && <p role="alert" className="shrink-0 border-t border-destructive/40 px-4 py-2 text-sm text-destructive">{submitError}</p>}
          <DialogFooter className="shrink-0 gap-2 border-t border-border p-4 sm:px-5">
            <Button type="button" variant="outline" disabled={saveEvent.isPending} onClick={() => confirming ? setConfirming(false) : changeOpen(false)}>{t(confirming ? "Voltar e revisar" : "action.cancel")}</Button>
            {confirming
              ? <Button type="button" disabled={saveEvent.isPending} onClick={() => void submit()}><Save />{t(saveEvent.isPending ? "Registrando…" : "Confirmar óbito")}</Button>
              : <Button type="submit" form="health-death-form"><Save />{t("Registrar óbito")}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Occurrences;
