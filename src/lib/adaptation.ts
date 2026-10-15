import { addDays, isValidIsoDate } from "./format";

export type AdaptationPhase = { days: number; feedPct: number; roughagePct: number };
export type AdaptationInput = {
  startDate: string;
  headCount: number;
  averageWeightKg: number;
  feedPriceKg: number;
  roughagePriceKg: number;
  totalDays: number;
  phases: AdaptationPhase[];
  postFeedPct: number;
  postRoughagePct: number;
};

// ADAPTAÇÃO!D13:E17 e A22:B22. Percentuais exibidos, não frações de Excel.
export const defaultAdaptationPhases = (): AdaptationPhase[] => [
  { days: 3, feedPct: 0.3, roughagePct: 3 },
  { days: 3, feedPct: 0.8, roughagePct: 2.5 },
  { days: 3, feedPct: 1.3, roughagePct: 2 },
  { days: 3, feedPct: 1.8, roughagePct: 1.5 },
  { days: 3, feedPct: 2.3, roughagePct: 1 },
];

/** Valida parâmetros recebidos do formulário ou de um plano salvo. */
export function validateAdaptation(input: unknown): AdaptationInput {
  if (!input || typeof input !== "object") throw new Error("Preencha os dados do plano.");
  const data = input as AdaptationInput;
  if (typeof data.startDate !== "string" || !isValidIsoDate(data.startDate)) throw new Error("Informe uma data de início válida.");
  const validNumber = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  if (!validNumber(data.headCount, 1, 1_000_000) || !Number.isInteger(data.headCount)) throw new Error("Informe uma quantidade inteira de animais maior que zero.");
  if (!validNumber(data.averageWeightKg, 0.001, 100_000)) throw new Error("Informe o peso médio do lote em kg.");
  if (!validNumber(data.feedPriceKg, 0, 1_000_000) || !validNumber(data.roughagePriceKg, 0, 1_000_000)) throw new Error("Informe os custos por kg de ração e volumoso (zero é permitido).");
  if (!Array.isArray(data.phases) || data.phases.length !== 5) throw new Error("O plano precisa das cinco etapas de adaptação.");
  for (const phase of data.phases) {
    if (!phase || phase.days !== 3 || !validNumber(phase.feedPct, 0, 100) || !validNumber(phase.roughagePct, 0, 100)) throw new Error("Cada etapa deve ter 3 dias e percentuais entre 0 e 100.");
  }
  if (!validNumber(data.totalDays, 15, 3650) || !Number.isInteger(data.totalDays)) throw new Error("O confinamento deve ter de 15 a 3.650 dias, incluindo a adaptação.");
  if (!validNumber(data.postFeedPct, 0, 100) || !validNumber(data.postRoughagePct, 0, 100)) throw new Error("Os percentuais após a adaptação devem estar entre 0 e 100.");
  return data;
}

export function computeAdaptation(raw: unknown) {
  const input = validateAdaptation(raw);
  // H5 da planilha representa o peso vivo TOTAL: média por cabeça × animais.
  const totalLiveWeight = input.averageWeightKg * input.headCount;
  let elapsed = 0;
  const phases = input.phases.map((phase, index) => {
    const startDay = elapsed + 1;
    const startDate = addDays(input.startDate, elapsed);
    elapsed += phase.days;
    const feedDailyKg = totalLiveWeight * phase.feedPct / 100;
    const roughageDailyKg = totalLiveWeight * phase.roughagePct / 100;
    const feedPeriodKg = feedDailyKg * phase.days;
    const roughagePeriodKg = roughageDailyKg * phase.days;
    const cost = feedPeriodKg * input.feedPriceKg + roughagePeriodKg * input.roughagePriceKg;
    return { ...phase, index, startDay, endDay: elapsed, startDate, endDate: addDays(input.startDate, elapsed - 1), feedDailyKg, roughageDailyKg, feedPeriodKg, roughagePeriodKg, cost };
  });
  const adaptationFeedKg = phases.reduce((sum, phase) => sum + phase.feedPeriodKg, 0);
  const adaptationRoughageKg = phases.reduce((sum, phase) => sum + phase.roughagePeriodKg, 0);
  const adaptationCost = phases.reduce((sum, phase) => sum + phase.cost, 0);
  const postDays = input.totalDays - elapsed;
  const postFeedDailyKg = totalLiveWeight * input.postFeedPct / 100;
  const postRoughageDailyKg = totalLiveWeight * input.postRoughagePct / 100;
  const postDailyCost = postFeedDailyKg * input.feedPriceKg + postRoughageDailyKg * input.roughagePriceKg;
  const totalFeedKg = adaptationFeedKg + postDays * postFeedDailyKg;
  const totalRoughageKg = adaptationRoughageKg + postDays * postRoughageDailyKg;
  const totalCost = totalFeedKg * input.feedPriceKg + totalRoughageKg * input.roughagePriceKg;
  return { phases, totalLiveWeight, adaptationDays: elapsed, adaptationFeedKg, adaptationRoughageKg, adaptationCost, adaptationCostPerHead: adaptationCost / input.headCount,
    postDays, postStartDate: addDays(input.startDate, elapsed), endDate: addDays(input.startDate, input.totalDays - 1), postFeedDailyKg, postRoughageDailyKg, postDailyCost, postDailyCostPerHead: postDailyCost / input.headCount,
    totalFeedKg, totalRoughageKg, totalCost, totalCostPerHead: totalCost / input.headCount };
}
