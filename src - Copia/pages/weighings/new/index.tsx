import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { NumericField } from "@/components/app/numeric-field";
import { PageHeader } from "@/components/app/page-header";
import { SelectField } from "@/components/form/select-field";
import { useAuth } from "@/hooks/use-auth";
import { PageLoading } from "@/components/app/page-loading";
import { readWeighingDraft, writeWeighingDraft, weighingDraftKey, type WeighingDraft } from "@/lib/weighing-draft";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAnimals } from "@/hooks/use-animals";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useSaveWeighing } from "@/hooks/use-weighings";
import { WEIGHING_KIND_OPTIONS } from "@/lib/constants";
import { computeLotMetrics, findWeightOutliers } from "@/lib/domain";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";
import { useWeighings } from "@/hooks/use-weighings";
import { IndividualWeighing } from "./individual-weighing";

const WeighingForm = ({ draftKey }: { draftKey: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const animalsQuery = useAnimals();
  const weighingsQuery = useWeighings();
  const saveWeighing = useSaveWeighing();

  const activeLots = (lotsQuery.data ?? []).filter((lot) => lot.status === "ativo");
  const pens = pensQuery.data ?? [];
  const weighings = weighingsQuery.data ?? [];

  const [form, setForm] = useState<WeighingDraft>(() => {
    let restored: WeighingDraft | null = null;
    try { restored = readWeighingDraft(window.localStorage, draftKey); } catch { /* Storage unavailable. */ }
    return restored ?? {
      lotId: "", kind: "amostral", date: todayIso(), headCount: "", avgWeight: "",
      weights: {}, inputs: {}, cursor: "", requestId: crypto.randomUUID(),
    };
  });
  const { lotId, kind, date, headCount, avgWeight, weights, inputs, cursor, requestId } = form;
  const [draftFailed, setDraftFailed] = useState(false);
  const [pendingWeight, setPendingWeight] = useState(false);
  useEffect(() => {
    if (!form.lotId) return;
    try { setDraftFailed(!writeWeighingDraft(window.localStorage, draftKey, form)); }
    catch { setDraftFailed(true); }
  }, [draftKey, form]);
  const [error, setError] = useState<string | null>(null);

  const lot = activeLots.find((item) => item.id === lotId) ?? null;
  const lotAnimals = useMemo(
    () => (animalsQuery.data ?? []).filter((animal) => animal.lot_id === lotId && (animal.status === "ativo" || animal.status === "tratamento")).sort((a, b) => a.ear_tag.localeCompare(b.ear_tag, "pt-BR", { numeric: true, sensitivity: "base" })),
    [animalsQuery.data, lotId],
  );

  const individualEntries = lotAnimals
    .map((animal) => ({ key: animal.id, weight: parseNumberInput(weights[animal.id] ?? "") }))
    .filter((entry): entry is { key: string; weight: number } => entry.weight !== null);

  const outlierKeys = findWeightOutliers(individualEntries);

  const computedAverage =
    individualEntries.length > 0
      ? individualEntries.reduce((sum, entry) => sum + entry.weight, 0) / individualEntries.length
      : null;

  const effectiveAverage =
    kind === "individual" && computedAverage !== null
      ? computedAverage
      : parseNumberInput(avgWeight);

  const metrics = lot ? computeLotMetrics(lot, weighings, todayIso()) : null;

  const submit = async () => {
    if (kind === "individual" && pendingWeight) {
      setError("Registre o peso do animal atual antes de salvar a pesagem.");
      return;
    }
    if (!lot) {
      setError(t("weighings.form.noLot"));
      return;
    }
    if (!effectiveAverage || effectiveAverage <= 0) {
      setError(t("toast.requiredFields"));
      return;
    }

    const head = kind === "individual" ? individualEntries.length : parseNumberInput(headCount);
    if (!head || head < 1 || !Number.isInteger(head) || head > lot.head_count ||
      (kind === "individual" && individualEntries.some((entry) => entry.weight <= 0)) ||
      (kind === "lote_completo" && head !== lot.head_count) || !date || date < lot.entry_date || date > todayIso()) {
      setError("Confira a data, a quantidade de cabeças e os pesos informados."); return;
    }
    try {
      await saveWeighing.mutateAsync({
        requestId,
        weighing: {
          lot_id: lot.id,
          pen_id: lot.pen_id,
          date,
          kind,
          head_count_weighed: kind === "individual" ? individualEntries.length : parseNumberInput(headCount) ?? 0,
          avg_weight_kg: effectiveAverage,
        },
        records:
          kind === "individual"
            ? individualEntries.map((entry) => ({
                animal_id: entry.key,
                weight_kg: entry.weight,
              }))
            : [],
      });

      try { window.localStorage.removeItem(draftKey); } catch { /* Save already succeeded. */ }
      toast.success(
        t("weighings.saved", { weight: formatNumber(effectiveAverage, 1) }),
      );
      navigate("/pesagens");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.error.generic"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="weighings.new"
        subtitleKey="weighings.subtitle"
        actions={
          <Button asChild variant="outline" className="h-10">
            <Link to="/pesagens">
              <ArrowLeft />
              {t("action.back")}
            </Link>
          </Button>
        }
      />

      <Card className="mx-auto w-full max-w-3xl">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <SelectField
            label={t("weighings.form.lot")}
            value={lotId}
            onChange={(value) => {
              setForm(current => ({ ...current, lotId: value, kind: "amostral", weights: {}, inputs: {},
                cursor: "", avgWeight: "", headCount: "", requestId: crypto.randomUUID() }));
              setPendingWeight(false);
              setError(null);
            }}
            placeholder={t("weighings.form.noLot")}
            options={activeLots.map((item) => ({
              value: item.id,
              labelKey: `${item.code} · ${pens.find((pen) => pen.id === item.pen_id)?.code ?? "—"}`,
            }))}
          />

          {lot ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("field.pen")}</span>
              <span className="font-display font-semibold">
                {pens.find((pen) => pen.id === lot.pen_id)?.code ?? "—"}
              </span>
              <span className="text-muted-foreground">
                · {t("field.currentWeight")}:
              </span>
              <span className="num font-medium">
                {metrics?.currentAvgWeight
                  ? `${formatNumber(metrics.currentAvgWeight, 1)} kg`
                  : "—"}
              </span>
              <span className="text-muted-foreground">· Animais no lote:</span>
              <span className="num font-medium">{lot.head_count}</span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label={t("weighings.form.kind")}
              value={kind}
              onChange={(value) => {
                setForm(current => ({ ...current, kind: value,
                  headCount: value === "lote_completo" && lot ? String(lot.head_count) : "" }));
                setPendingWeight(false);
                setError(null);
              }}
              options={WEIGHING_KIND_OPTIONS}
            />
            <div className="space-y-1.5">
              <label htmlFor="weighing-date" className="block text-sm font-medium">
                {t("field.date")}
              </label>
              <input
                id="weighing-date"
                type="date"
                min={lot?.entry_date}
                max={todayIso()}
                value={date}
                onChange={(event) => setForm(current => ({ ...current, date: event.target.value }))}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>
            <NumericField
              label={t("weighings.form.headCount")}
              unit="cab."
              inputMode="numeric"
              value={kind === "individual" ? String(individualEntries.length) : headCount}
              onValueChange={value => setForm(current => ({ ...current, headCount: value }))}
              readOnly={kind !== "amostral"}
              helper={lot && kind === "amostral" ? `Disponíveis: ${lot.head_count} animais.` : undefined}
              error={kind === "amostral" && lot && parseNumberInput(headCount) !== null &&
                (parseNumberInput(headCount)! < 1 || !Number.isInteger(parseNumberInput(headCount)) || parseNumberInput(headCount)! > lot.head_count)
                ? `Informe um número inteiro entre 1 e ${lot.head_count}.` : undefined}
            />
          </div>

          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {kind === "individual"
              ? "Informe o peso, registre e avance. Ao concluir, salve a pesagem."
              : kind === "lote_completo"
                ? "Informe a média de todos os animais do lote. Esta sessão atualiza a referência do lote, sem alterar os pesos individuais."
                : "Informe quantos animais foram pesados e a média da amostra. Esta sessão atualiza a referência do lote, sem alterar os pesos individuais."}
          </p>

          {kind === "individual" ? (
            lotAnimals.length === 0 ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {t("lots.detail.noAnimals")}
              </p>
            ) : (
              <div className="space-y-3">
                <IndividualWeighing key={`${lotId}:${kind}`} animals={lotAnimals} weights={weights}
                  inputs={inputs} cursor={cursor} average={computedAverage}
                  onRegister={(id, value) => setForm(current => ({ ...current,
                    weights: { ...current.weights, [id]: value }, inputs: { ...current.inputs, [id]: value } }))}
                  onInputChange={(id, value) => setForm(current => ({ ...current, inputs: { ...current.inputs, [id]: value } }))}
                  onCursorChange={value => setForm(current => ({ ...current, cursor: value }))}
                  onPendingChange={setPendingWeight} />

                {outlierKeys.length > 0 ? <p className="text-xs text-warning">{t("weighings.form.outlierHint")}</p> : null}
              </div>
            )
          ) : (
            <NumericField
              label={t("weighings.form.avgWeight")}
              unit="kg"
              value={avgWeight}
              onValueChange={value => setForm(current => ({ ...current, avgWeight: value }))}
              error={error ?? undefined}
            />
          )}

          {error && kind === "individual" ? (
            <p className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {lotId ? <p role="status" className={`text-xs ${draftFailed ? "text-warning" : "text-muted-foreground"}`}>
            {draftFailed ? "Não foi possível guardar o rascunho. Salve a pesagem antes de sair."
              : "Rascunho automático neste navegador. Clique em Salvar pesagem para concluir."}
          </p> : null}
          {lotId && !lotsQuery.isLoading && !lot ? <p className="text-xs text-warning">O lote do rascunho não está disponível. Selecione um lote ativo para iniciar outra pesagem.</p> : null}
          <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
            <Button variant="outline" className="h-10 w-40 max-w-full" onClick={() => navigate("/pesagens")}>
              {t("action.cancel")}
            </Button>
            <Button
              className="h-10 w-40 max-w-full"
              onClick={() => void submit()}
              disabled={saveWeighing.isPending || !lot || animalsQuery.isLoading || animalsQuery.isError || lotsQuery.isError || (kind === "individual" && (pendingWeight || individualEntries.length === 0))}
            >
              <Save />
              {kind === "individual" ? "Salvar pesagem" : t("action.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const NewWeighing = () => {
  const { user, tenant } = useAuth();
  if (!user || !tenant?.farmId) return <PageLoading />;
  const key = weighingDraftKey(user.id, tenant.farmId);
  return <WeighingForm key={key} draftKey={key} />;
};

export default NewWeighing;
