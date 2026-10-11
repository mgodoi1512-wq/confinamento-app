import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Beef, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { NumericField } from "@/components/app/numeric-field";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateLot, useLots, type NewLotAnimal } from "@/hooks/use-lots";
import { useDietItems, useDiets } from "@/hooks/use-diets";
import { usePens } from "@/hooks/use-pens";
import { useProtocols } from "@/hooks/use-protocols";
import {
  BREED_OPTIONS,
  CATEGORY_OPTIONS,
  SEX_OPTIONS,
  DEFAULT_TARGET_WEIGHT,
} from "@/lib/constants";
import { computePenOccupancy } from "@/lib/domain";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

type AnimalDraft = { key: string; earTag: string; weight: string };

const STEPS = ["lots.new.step1", "lots.new.step2", "lots.new.step3"];

const NewLot = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const lotsQuery = useLots();
  const pensQuery = usePens();
  const dietsQuery = useDiets();
  const dietItemsQuery = useDietItems();
  const protocolsQuery = useProtocols();
  const createLot = useCreateLot();

  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const diets = useMemo(() => dietsQuery.data ?? [], [dietsQuery.data]);
  const dietItems = useMemo(() => dietItemsQuery.data ?? [], [dietItemsQuery.data]);
  const protocols = useMemo(() => protocolsQuery.data ?? [], [protocolsQuery.data]);

  const suggestion = useMemo(() => {
    const year = new Date().getFullYear();
    const sequential = String((lotsQuery.data?.length ?? 0) + 1).padStart(3, "0");
    return `L-${year}-${sequential}`;
  }, [lotsQuery.data]);

  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [breed, setBreed] = useState(BREED_OPTIONS[0].value);
  const [category, setCategory] = useState("garrote");
  const [sex, setSex] = useState("macho");
  const [headCount, setHeadCount] = useState("");
  const [entryWeight, setEntryWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState(String(DEFAULT_TARGET_WEIGHT));
  const [mode, setMode] = useState<"avg" | "individual">("avg");
  const [animals, setAnimals] = useState<AnimalDraft[]>([]);
  const [penId, setPenId] = useState("");
  const [dietId, setDietId] = useState("");
  const [protocolId, setProtocolId] = useState("");
  const [applyProtocol, setApplyProtocol] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const occupancy = useMemo(() => computePenOccupancy(pens, lotsQuery.data ?? []), [pens, lotsQuery.data]);

  const availablePens = occupancy.filter((item) => item.pen.status !== "manutencao");
  const selectedOccupancy = occupancy.find((item) => item.pen.id === penId);

  const individualWeights = animals
    .map((animal) => parseNumberInput(animal.weight))
    .filter((weight): weight is number => weight !== null && weight > 0);

  const individualAverage =
    individualWeights.length > 0
      ? individualWeights.reduce((sum, weight) => sum + weight, 0) / individualWeights.length
      : null;

  const effectiveEntryWeight =
    mode === "individual" && individualAverage !== null
      ? individualAverage
      : parseNumberInput(entryWeight);

  const selectedDietTotal = dietItems
    .filter((item) => item.diet_id === dietId)
    .reduce((sum, item) => sum + item.kg_per_head_day, 0);

  const validateStep = (target: number) => {
    const next: Record<string, string> = {};

    if (target >= 0) {
      if (!(code || suggestion).trim()) next.code = t("toast.requiredFields");
      const head = parseNumberInput(headCount);
      if (!head || head <= 0) next.headCount = t("toast.requiredFields");
      if (!parseNumberInput(entryWeight)) next.entryWeight = t("toast.requiredFields");
    }

    if (target >= 1 && mode === "individual") {
      const tags = animals.map((animal) => animal.earTag.trim()).filter(Boolean);
      const duplicates = tags.filter((tag, index) => tags.indexOf(tag) !== index);
      if (duplicates.length > 0) next.duplicate = t("lots.new.dupEarTag", { tag: duplicates[0] });
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const submit = async () => {
    if (!validateStep(step)) return;

    const payload: NewLotAnimal[] = animals
      .filter((animal) => animal.earTag.trim())
      .map((animal) => ({
        ear_tag: animal.earTag.trim(),
        entry_weight_kg: parseNumberInput(animal.weight),
        sisbov: null,
        sex,
      }));

    try {
      const lot = await createLot.mutateAsync({
        lot: {
          code: (code || suggestion).trim(),
          origin: origin.trim() || null,
          entry_date: entryDate,
          breed,
          category,
          head_count: parseNumberInput(headCount) ?? 0,
          entry_avg_weight_kg: effectiveEntryWeight ?? 0,
          target_weight_kg: parseNumberInput(targetWeight) ?? DEFAULT_TARGET_WEIGHT,
          pen_id: penId || null,
          diet_id: dietId || null,
          protocol_id: protocolId || null,
        },
        animals: payload,
        applyProtocol,
      });

      toast.success(
        t("lots.saved", { code: lot.code, head: formatNumber(lot.head_count, 0) }),
      );
      navigate(`/lotes/${lot.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("duplicate")) {
        setErrors({ code: t("lots.new.dupEarTag", { tag: (code || suggestion).trim() }) });
        toast.error(t("lots.new.dupEarTag", { tag: (code || suggestion).trim() }));
        return;
      }
      toast.error(t("toast.error.generic"));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titleKey="lots.new"
        subtitleKey="lots.subtitle"
        actions={
          <Button variant="outline" className="h-10" onClick={() => navigate("/lotes")}>
            <ArrowLeft />
            {t("action.back")}
          </Button>
        }
      />

      {/* Passos */}
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((labelKey, index) => (
          <li key={labelKey} className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                index === step
                  ? "border-primary bg-primary text-primary-foreground"
                  : index < step
                    ? "border-success/40 bg-success/12 text-success"
                    : "border-border text-muted-foreground",
              )}
            >
              {index < step ? <Check className="size-3.5" /> : <span className="num">{index + 1}</span>}
              {t(labelKey)}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="hidden h-px w-6 bg-border sm:block" />
            ) : null}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="max-w-2xl space-y-4 pt-6">
          {step === 0 ? (
            <>
              <TextField
                label={t("field.code")}
                value={code}
                onChange={setCode}
                placeholder={suggestion}
                helper={`${t("field.code")}: ${suggestion}`}
                error={errors.code}
                required
              />
              <TextField
                label={t("field.origin")}
                value={origin}
                onChange={setOrigin}
                placeholder="Fazenda / leilão de origem"
              />
              <TextField
                label={t("field.entryDate")}
                type="date"
                value={entryDate}
                onChange={setEntryDate}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label={t("field.breed")}
                  value={breed}
                  onChange={setBreed}
                  options={BREED_OPTIONS}
                />
                <SelectField
                  label={t("field.category")}
                  value={category}
                  onChange={setCategory}
                  options={CATEGORY_OPTIONS}
                />
                <SelectField
                  label={t("field.sex")}
                  value={sex}
                  onChange={setSex}
                  options={SEX_OPTIONS}
                />
                <NumericField
                  label={t("field.headCount")}
                  unit="cab."
                  inputMode="numeric"
                  value={headCount}
                  onValueChange={setHeadCount}
                  error={errors.headCount}
                  helper={t("lots.new.headCountHint")}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumericField
                  label={t("field.entryWeight")}
                  unit="kg"
                  value={entryWeight}
                  onValueChange={setEntryWeight}
                  error={errors.entryWeight}
                />
                <NumericField
                  label={t("field.targetWeight")}
                  unit="kg"
                  value={targetWeight}
                  onValueChange={setTargetWeight}
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1.5">
                {(["avg", "individual"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={cn(
                      "h-10 rounded-md text-sm font-medium transition-colors",
                      mode === option
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option === "avg" ? t("lots.new.modeAvg") : t("lots.new.modeIndividual")}
                  </button>
                ))}
              </div>

              {mode === "avg" ? (
                <NumericField
                  label={t("field.entryWeight")}
                  unit="kg"
                  value={entryWeight}
                  onValueChange={setEntryWeight}
                  error={errors.entryWeight}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("lots.new.individualHint")}</p>

                  {animals.length > 0 ? (
                    <div className="space-y-2">
                      {animals.map((animal, index) => (
                        <div key={animal.key} className="flex items-end gap-2">
                          <TextField
                            className="flex-1"
                            label={`${t("field.earTag")} ${index + 1}`}
                            value={animal.earTag}
                            onChange={(value) =>
                              setAnimals((current) =>
                                current.map((item) =>
                                  item.key === animal.key ? { ...item, earTag: value } : item,
                                ),
                              )
                            }
                          />
                          <NumericField
                            className="w-32"
                            label={t("field.weight")}
                            unit="kg"
                            value={animal.weight}
                            onValueChange={(value) =>
                              setAnimals((current) =>
                                current.map((item) =>
                                  item.key === animal.key ? { ...item, weight: value } : item,
                                ),
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mb-1 h-11 w-11 text-muted-foreground"
                            aria-label={t("action.delete")}
                            onClick={() =>
                              setAnimals((current) =>
                                current.filter((item) => item.key !== animal.key),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {errors.duplicate ? (
                    <p className="rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive">
                      {errors.duplicate}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() =>
                      setAnimals((current) => [
                        ...current,
                        {
                          key: crypto.randomUUID(),
                          earTag: "",
                          weight: entryWeight,
                        },
                      ])
                    }
                  >
                    <Plus />
                    {t("weighings.form.addAnimal")}
                  </Button>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {t("lots.new.animalProgress", {
                        count: individualWeights.length,
                        total: parseNumberInput(headCount) ?? 0,
                      })}
                    </span>
                    {individualAverage !== null ? (
                      <StatusBadge
                        tone="agro"
                        label={`${t("weighings.form.computedAvg")}: ${formatNumber(individualAverage, 1)} kg`}
                        size="sm"
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("lots.new.individualWarning")}</p>
                </div>
              )}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <SelectField
                label={t("field.protocol")}
                value={protocolId}
                onChange={setProtocolId}
                allowEmpty
                emptyLabel={t("common.noData")}
                options={protocols.map((protocol) => ({
                  value: protocol.id,
                  labelKey: protocol.name,
                }))}
              />

              <SelectField
                label={t("field.pen")}
                value={penId}
                onChange={setPenId}
                placeholder={t("field.pen")}
                options={availablePens.map((item) => ({
                  value: item.pen.id,
                  labelKey: `${item.pen.code} · ${item.free} ${t("common.unit.head")} livres`,
                }))}
              />

              {selectedOccupancy ? (
                <p className="text-xs text-muted-foreground">
                  {t("pens.occupancy", {
                    head: selectedOccupancy.head,
                    capacity: selectedOccupancy.capacity,
                  })}
                  {parseNumberInput(headCount) &&
                  Number(parseNumberInput(headCount)) > selectedOccupancy.free ? (
                    <span className="ml-1 font-semibold text-warning">
                      {t("lots.new.penCapacityWarning", {
                        code: selectedOccupancy.pen.code,
                        capacity: selectedOccupancy.capacity,
                      })}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("lots.new.noPenAvailable")}</p>
              )}

              <SelectField
                label={t("field.diet")}
                value={dietId}
                onChange={setDietId}
                allowEmpty
                emptyLabel={t("common.noData")}
                options={diets.map((diet) => ({ value: diet.id, labelKey: diet.name }))}
              />

              {dietId ? (
                <p className="text-xs text-muted-foreground">
                  {t("config.diets.totalOffered")}: {formatNumber(selectedDietTotal, 2)} kg/cab/dia
                </p>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={applyProtocol}
                  onChange={(event) => setApplyProtocol(event.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                {t("health.applyProtocol")}
              </label>

              <div className="rounded-lg border border-border bg-surface p-4 text-sm">
                <p className="font-display text-base font-semibold">
                  {(code || suggestion).trim()} · {formatNumber(parseNumberInput(headCount) ?? 0, 0)}{" "}
                  {t("common.unit.head")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t("field.entryWeight")}:{" "}
                  {effectiveEntryWeight ? `${formatNumber(effectiveEntryWeight, 1)} kg` : "—"} ·{" "}
                  {t("field.targetWeight")}:{" "}
                  {formatNumber(parseNumberInput(targetWeight) ?? 0, 0)} kg
                </p>
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => (step === 0 ? navigate("/lotes") : setStep(step - 1))}
            >
              <ArrowLeft />
              {t("action.back")}
            </Button>

            {step < STEPS.length - 1 ? (
              <Button type="button" className="h-11" onClick={goNext}>
                {t("action.next")}
                <ArrowRight />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11"
                onClick={() => void submit()}
                disabled={createLot.isPending}
              >
                <Beef />
                {t("lots.new.create")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewLot;
