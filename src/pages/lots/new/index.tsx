import { locationName } from "@/lib/location-name";
import { useFarm } from "@/hooks/use-farm";
import { compatibleLocation, productionSystems, validSystems } from "@/lib/production-systems";
import { AnimalTagsEditor } from "@/components/lots/animal-tags-editor";
import { buildAnimalTags, emptyAnimalTagInput } from "@/lib/animal-registration";
import { useNextEarTag } from "@/hooks/use-animal-registration";
import { money } from "@/lib/financial-format";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft, ArrowRight, Beef, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { NumericField } from "@/components/app/numeric-field";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { StatusBadge } from "@/components/app/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { computePenOccupancy, dietTotalKg } from "@/lib/domain";
import { formatNumber, parseNumberInput, todayIso } from "@/lib/format";
import { mutateApp, DuplicateEarTagsError, type DuplicateEarTag } from "@/lib/mutations";
import { cn } from "@/lib/utils";

type AnimalDraft = { key: string; earTag: string; weight: string; purchasePrice: string };

const roundPrice = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

const STEPS = ["lots.new.step1", "lots.new.step2", "lots.new.step3"];

const NewLot = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const farmQuery=useFarm();
  const [selectedSystem,setSelectedSystem]=useState("");
  const effectiveSystem=selectedSystem||farmQuery.data?.default_production_system||"";
  const lotsQuery = useLots();
  const pensQuery = usePens();
  const dietsQuery = useDiets();
  const dietItemsQuery = useDietItems();
  const protocolsQuery = useProtocols();
  const createLot = useCreateLot();

  const pens = useMemo(() => pensQuery.data ?? [], [pensQuery.data]);
  const diets = useMemo(() => dietsQuery.data ?? [], [dietsQuery.data]);
  const dietItems = useMemo(() => dietItemsQuery.data ?? [], [dietItemsQuery.data]);
  const protocols = useMemo(() => (protocolsQuery.data ?? []).filter(protocol => protocol.is_active), [protocolsQuery.data]);

  const suggestion = useMemo(() => {
    const year = new Date().getFullYear();
    const sequential = String((lotsQuery.data?.length ?? 0) + 1).padStart(3, "0");
    return `L-${year}-${sequential}`;
  }, [lotsQuery.data]);

  const [penNoticeDismissed, setPenNoticeDismissed] = useState(false);
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
  const [applyProtocol, setApplyProtocol] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkingTags, setCheckingTags] = useState(false);
  const [confirmedTags, setConfirmedTags] = useState<string[]>([]);
  const [duplicateDialog, setDuplicateDialog] = useState<{ matches: DuplicateEarTag[]; action: "advance" | "save" } | null>(null);

  const [purchasePerHead, setPurchasePerHead] = useState("");

  const [registerAnimals, setRegisterAnimals] = useState(true);
  const [animalTags, setAnimalTags] = useState(emptyAnimalTagInput);
  const nextTag = useNextEarTag(mode === "avg" && registerAnimals);
  const generated = buildAnimalTags(parseNumberInput(headCount) ?? 0, animalTags, nextTag.data?.next);
  const selectedTags = mode === "individual" ? animals.map(animal => animal.earTag.trim()).filter(Boolean) : registerAnimals ? generated.tags : [];

  const occupancy = useMemo(() => computePenOccupancy(pens, lotsQuery.data ?? []), [pens, lotsQuery.data]);

  const usablePens = occupancy.filter((item) => !["manutencao","inativo"].includes(item.pen.status)&&compatibleLocation(effectiveSystem,item.pen.location_type));
  const requiredHead = Math.max(1, parseNumberInput(headCount) ?? 0);
  const availablePens = usablePens.filter((item) => item.free >= requiredHead);
  const requiredQueries = [farmQuery,pensQuery, lotsQuery];
  const canAdvance = validSystems(farmQuery.data?.production_systems??[],effectiveSystem)&&requiredQueries.every(query => query.isSuccess) && availablePens.length > 0 && !dietsQuery.isLoading && !protocolsQuery.isLoading;
  const activeDiets = diets.filter(diet => diet.is_active);
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

  const selectedDietTotal = dietItemsQuery.isSuccess
    ? dietTotalKg(dietItems.filter(item => item.diet_id === dietId), effectiveEntryWeight)
    : null;

  const priceValues = mode === "avg" ? [purchasePerHead] : animals.map(animal => animal.purchasePrice ?? "");
  const knownPrices = priceValues.filter(value => value.trim()).map(value => parseNumberInput(value));
  const purchaseTotal = mode === "avg" ? roundPrice(parseNumberInput(purchasePerHead) ?? 0) * (parseNumberInput(headCount) ?? 0) : knownPrices.reduce<number>((sum, value) => sum + roundPrice(value ?? 0), 0);
  const purchaseCount = mode === "avg" ? (purchasePerHead.trim() ? parseNumberInput(headCount) ?? 0 : 0) : knownPrices.length;
  const validateStep = (target: number) => {
    const next: Record<string, string> = {};
    if (!requiredQueries.every(query => query.isSuccess)) next.pen = "Aguarde a verificação dos locais. Se houver erro, tente carregar novamente.";
    else if (pens.length === 0) next.pen = "Cadastre pelo menos um local antes de criar o lote.";
    else if (usablePens.length === 0) next.pen = "Nenhum local compatível e disponível para o sistema selecionado.";
    else if (availablePens.length === 0) next.pen = "Nenhum local tem vagas suficientes para a quantidade de animais informada.";
    if (dietsQuery.isLoading || protocolsQuery.isLoading) next.setup = "Aguarde a verificação de dietas e protocolos.";
    if (target >= 2 && !selectedOccupancy) next.pen = "Selecione o local em que o lote ficará.";
    if (target >= 2 && selectedOccupancy && ["manutencao","inativo"].includes(selectedOccupancy.pen.status)) next.pen = "Escolha um local ativo, fora de manutenção.";
    if (target >= 2 && protocolId && protocolId!=="all" && !protocols.some(protocol => protocol.id === protocolId)) next.protocol = "O protocolo selecionado está inativo. Escolha um protocolo ativo ou deixe sem protocolo.";
    if (target >= 2 && applyProtocol && !protocols.some(protocol => protocol.id === protocolId)) next.protocol = "Selecione um protocolo para aplicá-lo ao lote.";

    if (target >= 0) {
      if (!(code || suggestion).trim()) next.code = t("toast.requiredFields");
      const head = parseNumberInput(headCount);
      if (!head || head <= 0 || !Number.isInteger(head)) next.headCount = t("toast.requiredFields");
      if (!effectiveEntryWeight || effectiveEntryWeight <= 0) next.entryWeight = t("toast.requiredFields");
    }

    if (target >= 1 && mode === "avg" && registerAnimals && generated.error) next.tags = generated.error;
    if (target >= 1 && mode === "individual") {
      const tags = animals.map((animal) => animal.earTag.trim()).filter(Boolean);
      const duplicates = tags.filter((tag, index) => tags.indexOf(tag) !== index);
      if (duplicates.length > 0) next.duplicate = t("lots.new.dupEarTag", { tag: duplicates[0] });
    }

    if (!entryDate || entryDate > todayIso()) next.code = "Informe uma data de entrada válida, até hoje.";
    if (!(parseNumberInput(targetWeight) > 0)) next.entryWeight = "Informe um peso alvo positivo.";
    if (target >= 1 && mode === "individual" && (animals.length !== parseNumberInput(headCount) || animals.some((animal) => !animal.earTag.trim() || !(parseNumberInput(animal.weight) > 0)))) next.duplicate = "Preencha um brinco e peso positivo para cada cabeça do lote.";
    if (target >= 2 && selectedOccupancy && (parseNumberInput(headCount) ?? 0) > selectedOccupancy.free) next.pen = "O curral não tem capacidade disponível para este lote.";
    if (target >= 1 && knownPrices.some(value => value === null || value < 0 || value > 999999999999)) next.purchase = "Informe preços de compra válidos, maiores ou iguais a zero.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = async () => {
    if (checkingTags || createLot.isPending || !validateStep(step)) return;
    if (step === 1 && selectedTags.length > 0) {
      setCheckingTags(true);
      try {
        const tags = selectedTags;
        const matches = await mutateApp<DuplicateEarTag[]>("check_lot_ear_tags", { tags }, crypto.randomUUID());
        if (!Array.isArray(matches) || !matches.every(item => typeof item?.earTag === "string" && typeof item?.lotCode === "string")) throw new Error("Não foi possível conferir os brincos. Tente novamente.");
        if (matches.some(item => !confirmedTags.includes(item.earTag))) {
          setDuplicateDialog({ matches, action: "advance" });
          return;
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível conferir os brincos.");
        return;
      } finally { setCheckingTags(false); }
    }
    setStep(current => Math.min(current + 1, STEPS.length - 1));
  };

  const submit = async (acceptedTags = confirmedTags) => {
    if (!validateStep(step)) return;

    const payload: NewLotAnimal[] = (mode === "individual" ? animals : registerAnimals ? generated.tags.map(earTag => ({ earTag, weight: entryWeight })) : [])
      .filter((animal) => animal.earTag.trim())
      .map((animal) => ({
        ear_tag: animal.earTag.trim(),
        entry_weight_kg: parseNumberInput(animal.weight),
        sisbov: null,
        sex,
      }));

    try {
      
      const lot = await createLot.mutateAsync({
        requestId,
        lot: {
          code: (code || suggestion).trim(),
          origin: origin.trim() || null,
          entry_date: entryDate,
          breed,
          category,
          head_count: parseNumberInput(headCount) ?? 0,
          entry_avg_weight_kg: effectiveEntryWeight ?? 0,
          target_weight_kg: parseNumberInput(targetWeight) ?? DEFAULT_TARGET_WEIGHT,
          pen_id: penId,
          production_system: effectiveSystem,
          diet_id: !dietId || dietId === "all" ? null : dietId,
          protocol_id: !protocolId || protocolId === "all" ? null : protocolId,
        },
        animals: payload,
        applyProtocol,
        confirmedDuplicateEarTags: acceptedTags,
        purchase: knownPrices.length ? {
          defaultPerHead: mode === "avg" ? roundPrice(parseNumberInput(purchasePerHead)!) : null,
          animals: mode === "individual" ? animals.filter(animal => (animal.purchasePrice ?? "").trim()).map(animal => ({ earTag: animal.earTag.trim(), amount: roundPrice(parseNumberInput(animal.purchasePrice)!) })) : [],
        } : undefined,
      });

      setRequestId(crypto.randomUUID());
      toast.success(
        t("lots.saved", { code: lot.code, head: formatNumber(lot.head_count, 0) }),
      );
      navigate(`/lotes/${lot.id}`);
    } catch (error) {
      if (error instanceof DuplicateEarTagsError) { setDuplicateDialog({ matches: error.matches, action: "save" }); return; }
      const message = error instanceof Error ? error.message : "";
      if (message.includes("duplicate")) {
        setErrors({ code: t("lots.new.dupEarTag", { tag: (code || suggestion).trim() }) });
        toast.error(t("lots.new.dupEarTag", { tag: (code || suggestion).trim() }));
        return;
      }
      toast.error(message || t("toast.error.generic"));
    }
  };

  const acceptDuplicates = () => {
    if (!duplicateDialog) return;
    const accepted = [...new Set([...confirmedTags, ...duplicateDialog.matches.map(item => item.earTag)])];
    const action = duplicateDialog.action;
    setConfirmedTags(accepted); setDuplicateDialog(null);
    if (action === "advance") setStep(2);
    else void submit(accepted);
  };

  return (
    <div className="space-y-5">
      <Dialog open={checkingTags || !!duplicateDialog} onOpenChange={open => { if (!open && !checkingTags) setDuplicateDialog(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-xl">
          <DialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">{checkingTags ? <Loader2 className="size-6 animate-spin" /> : <AlertTriangle className="size-6" />}</div>
            <DialogTitle>{checkingTags ? "Conferindo os brincos…" : "Estes brincos já estão em uso"}</DialogTitle>
            <DialogDescription>{checkingTags ? "Estamos verificando se os identificadores já aparecem em outros lotes da sua fazenda." : "Encontramos animais com os mesmos brincos em outros lotes. Confira os registros antes de continuar."}</DialogDescription>
          </DialogHeader>
          {!checkingTags && duplicateDialog ? <>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left font-semibold">Brinco</th><th className="px-3 py-2 text-left font-semibold">Já cadastrado em</th></tr></thead><tbody>{duplicateDialog.matches.map((item, index) => <tr key={`${item.earTag}-${item.lotCode}-${index}`} className="border-t border-border"><td className="break-words px-3 py-2 font-medium">{item.earTag}</td><td className="break-words px-3 py-2">{item.lotCode}</td></tr>)}</tbody></table>
            </div>
            <p className="rounded-lg bg-muted/40 p-3 text-sm">Você pode repetir o brinco em lotes diferentes. Ao continuar, os animais existentes serão mantidos e o novo lote terá seus próprios animais.</p>
            {duplicateDialog.action === "advance" ? <p className="text-xs text-muted-foreground">Nenhum animal será cadastrado agora. A próxima etapa é Sanidade e alocação.</p> : null}
            <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => { setDuplicateDialog(null); setStep(1); }}>Revisar brincos</Button><Button type="button" onClick={acceptDuplicates}>{duplicateDialog.action === "advance" ? "Continuar cadastro" : "Cadastrar mesmo assim"}<ArrowRight className="size-4" /></Button></DialogFooter>
          </> : null}
        </DialogContent>
      </Dialog>
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

      <Dialog open={pensQuery.isSuccess && pens.length===0 && !penNoticeDismissed} onOpenChange={open=>setPenNoticeDismissed(!open)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Cadastre um local para continuar</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">Sua fazenda ainda não possui locais cadastrados. O lote precisa de pelo menos um local para ficar. Cadastre o local antes de continuar.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={()=>navigate("/lotes")}>Voltar aos lotes</Button>
            <Button onClick={()=>navigate("/config/currais")}>Cadastrar local</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {requiredQueries.some(query=>query.isLoading) && <p role="status" className="text-sm text-muted-foreground">Verificando locais disponíveis...</p>}
        {requiredQueries.some(query=>query.isError) && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">Não foi possível verificar os locais. <Button variant="outline" onClick={()=>void Promise.all(requiredQueries.map(query=>query.refetch()))}>Tentar novamente</Button></div>}
        {pensQuery.isSuccess && pens.length===0 && <div className="flex flex-wrap items-center gap-3 text-sm"><p>Cadastre um local para liberar o cadastro do lote.</p><Button variant="outline" onClick={()=>setPenNoticeDismissed(false)}>Ver aviso</Button></div>}
        {pensQuery.isSuccess && pens.length>0 && usablePens.length===0 && <p role="alert" className="rounded-lg border border-destructive p-4 text-sm">Nenhum local compatível está disponível para este sistema. Cadastre ou configure um curral, piquete ou pasto apropriado antes de avançar.</p>}
        {requiredQueries.every(query => query.isSuccess) && usablePens.length > 0 && availablePens.length === 0 && <div role="alert" className="space-y-2 rounded-lg border border-warning p-4 text-sm"><p>Nenhum local tem vagas suficientes para {formatNumber(requiredHead, 0)} animais. Ajuste a quantidade, aumente a capacidade de um local ou cadastre outro para continuar.</p><Button asChild variant="outline"><Link to="/config/currais">Gerenciar locais</Link></Button></div>}
        {(dietsQuery.isLoading || protocolsQuery.isLoading) && <p role="status" className="text-sm text-muted-foreground">Verificando dietas e protocolos...</p>}
        {(dietsQuery.isError || protocolsQuery.isError) && <div role="status" className="space-y-2 rounded-lg border border-warning p-4 text-sm"><p>Não foi possível verificar {dietsQuery.isError && protocolsQuery.isError ? "dietas e protocolos" : dietsQuery.isError ? "as dietas" : "os protocolos"}. Você pode continuar e configurar depois.</p><Button variant="outline" onClick={()=>void Promise.all([dietsQuery.refetch(),protocolsQuery.refetch()])}>Verificar novamente</Button></div>}
        {((dietsQuery.isSuccess && activeDiets.length===0 && effectiveSystem!=="pasto") || (protocolsQuery.isSuccess && protocols.length===0)) && <div role="status" className="space-y-2 rounded-lg border border-warning p-4 text-sm"><p className="font-semibold">Antes de criar o lote</p>
          {dietsQuery.isSuccess && activeDiets.length===0 && effectiveSystem!=="pasto" && <p>Nenhuma dieta ativa cadastrada. Cadastre uma dieta para planejar o trato do lote. <Link className="underline" to="/config/dietas">Cadastrar dieta</Link></p>}
          {protocolsQuery.isSuccess && protocols.length===0 && <p>Nenhum protocolo ativo cadastrado. Cadastre ou ative um protocolo para organizar o manejo sanitário. <Link className="underline" to="/sanidade/protocolos">Cadastrar protocolo</Link></p>}
          <p>Você pode continuar agora e configurar esses itens depois.</p>
        </div>}
      </div>

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
                helper={`Sugestão: ${suggestion}. Deixe em branco para usar o código sugerido.`}
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
                        : "text-muted-foreground hover:text-[hsl(var(--muted-surface-foreground))]",
                    )}
                  >
                    {option === "avg" ? t("lots.new.modeAvg") : t("lots.new.modeIndividual")}
                  </button>
                ))}
              </div>

              {mode === "avg" ? (
               <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">
                <NumericField
                  label={t("field.entryWeight")}
                  unit="kg"
                  value={entryWeight}
                  onValueChange={setEntryWeight}
                  error={errors.entryWeight}
                />
                <NumericField label="Preço de compra por animal (opcional)" unit="R$/cabeça" value={purchasePerHead} onValueChange={setPurchasePerHead} error={errors.purchase}/>
               </div>
               <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={registerAnimals} onChange={event=>setRegisterAnimals(event.target.checked)}/>Cadastrar os animais automaticamente</label>
               {registerAnimals?<><AnimalTagsEditor count={parseNumberInput(headCount)??0} value={animalTags} onChange={setAnimalTags} suggested={nextTag.data?.next} loading={nextTag.isLoading} onRetry={()=>void nextTag.refetch()}/><p className="text-xs text-muted-foreground">Cada animal receberá o peso médio e usará o preço por cabeça do lote. A sequência identifica os animais; não representa uma pesagem individual.</p></>:<p className="rounded-lg bg-muted p-3 text-sm">Somente a quantidade e as médias serão salvas. O Estoque continuará mostrando referências sem cadastro individual até os brincos serem cadastrados.</p>}
               {errors.tags&&<p role="alert" className="text-sm text-destructive">{errors.tags}</p>}
               </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("lots.new.individualHint")}</p>

                  {animals.length > 0 ? (
                    <div className="space-y-2">
                      {animals.map((animal, index) => (
                        <div key={animal.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_2.75rem]">
                          <div className="col-span-3 min-w-0 sm:col-span-1"><TextField
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
                          </div><div className="min-w-0"><NumericField
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
                          </div><div className="min-w-0"><NumericField label="Preço unitário (opcional)" unit="R$" value={animal.purchasePrice ?? ""} onValueChange={value=>setAnimals(current=>current.map(item=>item.key===animal.key?{...item,purchasePrice:value}:item))}/></div>
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
                          purchasePrice: "",
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

          {step===0&&<SelectField label="Sistema de criação do lote" value={effectiveSystem} placeholder="Selecione o sistema" options={productionSystems.filter(s=>farmQuery.data?.production_systems?.includes(s.value)).map(s=>({value:s.value,labelKey:s.label}))} onChange={value=>{setSelectedSystem(value);setPenId("");setPenNoticeDismissed(false);}}/>}
          {step === 1 ? <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">Compra informada: {purchaseCount ? money(purchaseTotal) : "Não informada"}</p>
            <p className="text-xs text-muted-foreground">{purchaseCount} de {parseNumberInput(headCount) ?? 0} cabeça(s) com preço. Valores opcionais, salvos no Estoque/Animais. Não geram pagamento automático no Fluxo de caixa.</p>
            {errors.purchase && <p role="alert" className="text-destructive">{errors.purchase}</p>}
          </div> : null}

          {step === 2 ? (
            <>
              <SelectField
                label={`${t("field.protocol")} (opcional)`}
                value={protocols.some(protocol=>protocol.id===protocolId) ? protocolId : "all"}
                onChange={value=>{setProtocolId(value);if(value==="all")setApplyProtocol(false);}}
                allowEmpty
                emptyLabel="Sem protocolo"
                placeholder="Sem protocolo"
                disabled={protocolsQuery.isLoading}
                error={errors.protocol}
                options={protocols.map((protocol) => ({
                  value: protocol.id,
                  labelKey: protocol.name,
                }))}
              />

              <SelectField
                label={t("field.pen")}
                value={penId}
                onChange={setPenId}
                placeholder={availablePens.length ? "Selecione um local" : "Nenhum local com vagas suficientes"}
                disabled={!requiredQueries.every(query => query.isSuccess) || availablePens.length === 0}
                error={errors.pen}
                options={availablePens.slice().sort((a,b)=>a.pen.code.localeCompare(b.pen.code,"pt-BR",{numeric:true})).map((item) => ({
                  value: item.pen.id,
                  labelKey: `${locationName(item.pen)} · ${item.free} ${t("common.unit.head")} livres`,
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
                        code: locationName(selectedOccupancy.pen),
                        capacity: selectedOccupancy.capacity,
                      })}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{availablePens.length ? "Selecione o local em que o lote ficará. Este campo é obrigatório." : "Nenhum local com vagas suficientes para este lote."}</p>
              )}

              <SelectField
                label={`${t("field.diet")} (opcional)`}
                value={dietId || "all"}
                onChange={setDietId}
                allowEmpty
                emptyLabel="Sem dieta"
                placeholder="Sem dieta"
                disabled={dietsQuery.isLoading}
                options={activeDiets.map((diet) => ({ value: diet.id, labelKey: diet.name }))}
              />

              {dietId && dietId !== "all" ? (
                <p className="text-xs text-muted-foreground">
                  {selectedDietTotal === null ? "Carregue os ingredientes e informe um peso médio válido para calcular a oferta da dieta." : `${t("config.diets.totalOffered")}: ${formatNumber(selectedDietTotal, 2)} kg/cab/dia`}
                </p>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={applyProtocol}
                  disabled={!protocols.some(protocol=>protocol.id===protocolId)}
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
                <p className="mt-1 text-muted-foreground">Compra informada: {purchaseCount ? money(purchaseTotal) : "Não informada"} · {purchaseCount} cabeça(s) com preço.</p>
              </div>
            </>
          ) : null}

          {Object.values(errors).length > 0 && <p role="alert" className="text-sm text-destructive">{Object.values(errors).join(" ")}</p>}
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
              <Button type="button" className="h-11" onClick={goNext} disabled={!canAdvance || createLot.isPending || checkingTags}>
                {t("action.next")}
                <ArrowRight />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11"
                onClick={() => void submit()}
                disabled={createLot.isPending || !canAdvance || !availablePens.some(item => item.pen.id === penId)}
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
