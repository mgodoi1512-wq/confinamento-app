/**
 * Cálculos do domínio: GMD, arrobas, projeção de abate, ocupação de curral,
 * carência e indicadores do rebanho. Nenhuma regra de privilégio aqui — isso é RLS.
 */
import type { Database } from "@/integrations/supabase/types";
import {
  ARROBA_KG,
  DEFAULT_CARCASS_YIELD,
  HEAVY_ANIMAL_DAYS_WITHOUT_WEIGHING,
  type WeightScenario,
} from "./constants";
import { addDays, daysBetween, todayIso } from "./format";

type Tables = Database["public"]["Tables"];

export type Farm = Tables["farms"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type Pen = Tables["pens"]["Row"];
export type Diet = Tables["diets"]["Row"];
export type DietItem = Tables["diet_items"]["Row"];
export type Protocol = Tables["protocols"]["Row"];
export type ProtocolItem = Tables["protocol_items"]["Row"];
export type Lot = Tables["lots"]["Row"];
export type Animal = Tables["animals"]["Row"];
export type Weighing = Tables["weighings"]["Row"];
export type WeightRecord = Tables["weight_records"]["Row"];
export type FeedLog = Tables["feed_logs"]["Row"];
export type TroughReading = Tables["trough_readings"]["Row"];
export type HealthEvent = Tables["health_events"]["Row"];

export type Role = "gestor" | "operador";
export type LotStatus = "ativo" | "encerrado";
export type PenStatus = "ativo" | "vazio" | "manutencao" | "adaptacao";
export type AnimalStatus = "ativo" | "tratamento" | "abatido" | "vendido" | "morto";
export type HealthStatus = "saudavel" | "tratamento" | "observacao" | "carencia";
export type WeighingKind = "amostral" | "lote_completo" | "individual";
export type FeedShift = "manha" | "tarde" | "noite";
export type HealthEventKind = "protocolo" | "vacina" | "tratamento" | "obito";

/** Peso vivo -> arrobas de carcaça. */
export const liveWeightToArroba = (
  weightKg: number | null | undefined,
  carcassYield = DEFAULT_CARCASS_YIELD,
): number | null => {
  if (!weightKg) return null;
  return (weightKg * (carcassYield / 100)) / ARROBA_KG;
};

export const computeGmd = (
  fromWeight: number | null | undefined,
  toWeight: number | null | undefined,
  days: number | null | undefined,
): number | null => {
  if (!fromWeight || !toWeight || !days || days <= 0) return null;
  return (toWeight - fromWeight) / days;
};

export const latestWeighingOfLot = (
  weighings: Weighing[],
  lotId: string,
): Weighing | null => {
  const list = weighings
    .filter((w) => w.lot_id === lotId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return list[0] ?? null;
};

export type Projection = {
  days: number;
  date: string;
  arroba: number | null;
  ready: boolean;
};

export const computeProjection = (
  currentAvgWeight: number | null,
  gmd: number | null,
  targetWeight: number,
  options: { today?: string; scenario?: WeightScenario; carcassYield?: number } = {},
): Projection | null => {
  const { today = todayIso(), scenario = "realistic", carcassYield = DEFAULT_CARCASS_YIELD } =
    options;
  if (!currentAvgWeight || !targetWeight) return null;

  const factor =
    scenario === "conservative" ? 0.9 : scenario === "optimistic" ? 1.1 : 1;
  const projectedGmd = (gmd ?? 0) * factor;

  const arroba = liveWeightToArroba(targetWeight, carcassYield);

  if (currentAvgWeight >= targetWeight) {
    return { days: 0, date: today, arroba, ready: true };
  }
  if (projectedGmd <= 0) return null;

  const days = Math.ceil((targetWeight - currentAvgWeight) / projectedGmd);
  return { days, date: addDays(today, days), arroba, ready: false };
};

export type LotMetrics = {
  latestWeighing: Weighing | null;
  entryAvgWeight: number;
  currentAvgWeight: number | null;
  daysOnFeed: number;
  daysSinceWeighing: number | null;
  gmd: number | null;
  totalGain: number | null;
  arroba: number | null;
};

export const computeLotMetrics = (
  lot: Lot,
  weighings: Weighing[],
  today = todayIso(),
): LotMetrics => {
  const latest = latestWeighingOfLot(weighings, lot.id);
  const entryAvgWeight = lot.entry_avg_weight_kg;
  const currentAvgWeight = latest ? latest.avg_weight_kg : entryAvgWeight;
  const daysOnFeed = Math.max(daysBetween(lot.entry_date, today), 0);
  const daysSinceWeighing = latest ? Math.max(daysBetween(latest.date, today), 0) : null;

  // GMD acumulado do lote: ganho desde a entrada dividido pelos dias de confinamento.
  const gmd =
    daysOnFeed > 0 ? (currentAvgWeight - entryAvgWeight) / daysOnFeed : null;

  const totalGain =
    currentAvgWeight && entryAvgWeight ? currentAvgWeight - entryAvgWeight : null;

  return {
    latestWeighing: latest,
    entryAvgWeight,
    currentAvgWeight,
    daysOnFeed,
    daysSinceWeighing,
    gmd,
    totalGain,
    arroba: liveWeightToArroba(currentAvgWeight),
  };
};

export type PenOccupancy = {
  pen: Pen;
  head: number;
  capacity: number;
  percent: number;
  free: number;
  lot: Lot | null;
  overCapacity: boolean;
};

export const computePenOccupancy = (pens: Pen[], lots: Lot[]): PenOccupancy[] =>
  pens.map((pen) => {
    const activeLots = lots.filter(
      (lot) => lot.pen_id === pen.id && lot.status === "ativo",
    );
    const head = activeLots.reduce((sum, lot) => sum + lot.head_count, 0);
    const capacity = pen.capacity_head;
    const percent = capacity > 0 ? Math.round((head / capacity) * 100) : 0;
    return {
      pen,
      head,
      capacity,
      percent,
      free: Math.max(capacity - head, 0),
      lot: activeLots[0] ?? null,
      overCapacity: head > capacity,
    };
  });

/** Ajuste de oferta recomendado por score de leitura de cocho (0-5). */
export const TROUGH_ADJUSTMENT: Record<number, number> = {
  0: 6,
  1: 2,
  2: 0,
  3: -3,
  4: -8,
  5: -15,
};

export type Tone = "success" | "warning" | "info" | "destructive" | "muted" | "primary" | "agro";

export const troughScoreTone = (score: number): Tone => {
  if (score <= 0) return "warning";
  if (score <= 2) return "success";
  if (score === 3) return "info";
  if (score === 4) return "warning";
  return "destructive";
};

export const healthTone = (status: string): Tone => {
  switch (status) {
    case "saudavel":
      return "success";
    case "tratamento":
      return "warning";
    case "observacao":
      return "info";
    case "carencia":
      return "agro";
    default:
      return "muted";
  }
};

export const healthEventTone = (kind: string): Tone => {
  switch (kind) {
    case "protocolo":
    case "vacina":
      return "info";
    case "tratamento":
      return "warning";
    case "obito":
      return "destructive";
    default:
      return "muted";
  }
};

export const animalStatusTone = (status: string): Tone => {
  switch (status) {
    case "ativo":
      return "success";
    case "tratamento":
      return "warning";
    case "morto":
      return "destructive";
    default:
      return "muted";
  }
};

export const penStatusTone = (status: string): Tone => {
  switch (status) {
    case "ativo":
      return "success";
    case "adaptacao":
      return "info";
    case "manutencao":
      return "warning";
    default:
      return "muted";
  }
};

/** Dias restantes de carência (0 quando já venceu). */
export const withdrawalDaysLeft = (
  animal: Pick<Animal, "withdrawal_until">,
  today = todayIso(),
): number => {
  if (!animal.withdrawal_until) return 0;
  const days = daysBetween(today, animal.withdrawal_until);
  return days > 0 ? days : 0;
};

export const isUnderWithdrawal = (
  entity: { withdrawal_until: string | null },
  today = todayIso(),
): boolean => withdrawalDaysLeft(entity, today) > 0;

export const animalGain = (animal: Animal): number | null => {
  if (!animal.entry_weight_kg || !animal.current_weight_kg) return null;
  return animal.current_weight_kg - animal.entry_weight_kg;
};

export type HerdSummary = {
  confinedHead: number;
  activeLots: number;
  totalLots: number;
  avgGmd: number | null;
  avgDaysOnFeed: number | null;
  mortalityRate: number | null;
  deaths: number;
  avgWeight: number | null;
  avgArroba: number | null;
  occupancyPercent: number;
  capacity: number;
  inTreatment: number;
  underWithdrawal: number;
  readyForSlaughter: number;
};

export const computeHerdSummary = (
  lots: Lot[],
  animals: Animal[],
  weighings: Weighing[],
  pens: Pen[],
  healthEvents: HealthEvent[],
  today = todayIso(),
): HerdSummary => {
  const activeLots = lots.filter((lot) => lot.status === "ativo");
  const confinedHead = activeLots.reduce((sum, lot) => sum + lot.head_count, 0);

  const metrics = activeLots.map((lot) => computeLotMetrics(lot, weighings, today));

  const weightSum = metrics.reduce(
    (acc, metric, index) => acc + (metric.currentAvgWeight ?? 0) * activeLots[index].head_count,
    0,
  );

  const gmdEntries = metrics
    .map((metric, index) => ({ gmd: metric.gmd, head: activeLots[index].head_count }))
    .filter((entry): entry is { gmd: number; head: number } => entry.gmd !== null && entry.gmd > 0);

  const gmdHead = gmdEntries.reduce((sum, entry) => sum + entry.head, 0);

  const deaths = healthEvents.filter((event) => event.kind === "obito").length;
  const totalEntered = lots.reduce((sum, lot) => sum + lot.head_count, 0) + deaths;

  const capacity = pens.reduce((sum, pen) => sum + pen.capacity_head, 0);

  const inTreatment = animals.filter((animal) => animal.health_status === "tratamento").length;
  const underWithdrawal = animals.filter((animal) => isUnderWithdrawal(animal, today)).length;

  const readyForSlaughter = activeLots.reduce((sum, lot) => {
    const metric = metrics[activeLots.indexOf(lot)];
    if (!metric.currentAvgWeight) return sum;
    return metric.currentAvgWeight >= lot.target_weight_kg ? sum + lot.head_count : sum;
  }, 0);

  const avgWeight = confinedHead > 0 && weightSum > 0 ? weightSum / confinedHead : null;

  return {
    confinedHead,
    activeLots: activeLots.length,
    totalLots: lots.length,
    avgGmd:
      gmdHead > 0
        ? gmdEntries.reduce((sum, entry) => sum + entry.gmd * entry.head, 0) / gmdHead
        : null,
    avgDaysOnFeed:
      confinedHead > 0
        ? metrics.reduce(
            (sum, metric, index) => sum + metric.daysOnFeed * activeLots[index].head_count,
            0,
          ) / confinedHead
        : null,
    mortalityRate: totalEntered > 0 ? (deaths / totalEntered) * 100 : null,
    deaths,
    avgWeight,
    avgArroba: liveWeightToArroba(avgWeight),
    occupancyPercent: capacity > 0 ? Math.round((confinedHead / capacity) * 100) : 0,
    capacity,
    inTreatment,
    underWithdrawal,
    readyForSlaughter,
  };
};

export const lotsWithoutRecentWeighing = (
  lots: Lot[],
  weighings: Weighing[],
  today = todayIso(),
): Lot[] =>
  lots.filter((lot) => {
    if (lot.status !== "ativo") return false;
    const latest = latestWeighingOfLot(weighings, lot.id);
    if (!latest) return daysBetween(lot.entry_date, today) >= 7;
    return daysBetween(latest.date, today) > HEAVY_ANIMAL_DAYS_WITHOUT_WEIGHING;
  });

/** Pesos que variam mais de 15% da média (revisão antes de salvar). */
export const findWeightOutliers = (
  entries: { key: string; weight: number }[],
  tolerance = 0.15,
): string[] => {
  if (entries.length < 3) return [];
  const avg = entries.reduce((sum, entry) => sum + entry.weight, 0) / entries.length;
  return entries
    .filter((entry) => Math.abs(entry.weight - avg) / avg > tolerance)
    .map((entry) => entry.key);
};

export const dietTotalKg = (items: Pick<DietItem, "kg_per_head_day">[]): number =>
  items.reduce((sum, item) => sum + item.kg_per_head_day, 0);
