import { locationName } from "./location-name";
import { animalMeasurements } from "./animal-measurements";
import { DEFAULT_CARCASS_YIELD } from "./constants";
import { computeGmd, computeLotMetrics, currentHealthStatus, liveWeightToArroba, type Animal, type Lot, type Pen, type Weighing, type WeightRecord } from "./domain";
import { daysBetween, formatDate, todayIso } from "./format";

export type ExportColumn = { title: string; decimals?: number };
export type ExportReport = {
  title: string;
  farmName?: string;
  feedingSuggestion?: { suggestions: import("./feed-suggestion").FeedingSuggestion[]; farmName: string; date: string };
  adaptation?: { input: import("./adaptation").AdaptationInput; lotName: string };
  pdf?: { format: "a4" | "a3"; fontSize?: number; embeddedFont?: boolean; columnWidths?: number[]; centerColumns?: boolean; compactHeader?: boolean; summary?: string };
  filename: string;
  recordCount?: number;
  filters: string;
  note: string;
  columns: ExportColumn[];
  rows: (string | number | null)[][];
};
type Translate = (key: string) => string;

export function animalReport(animals: Animal[], lots: Lot[], pens: Pen[], weighings: Weighing[], records: WeightRecord[], translate: Translate, filters: string, today = todayIso()): ExportReport {
  const measurementInfo=animalMeasurements(animals,lots,weighings,records,today);
  const lotMap = new Map(lots.map(lot => [lot.id, lot]));
  const penMap = new Map(pens.map(pen => [pen.id, locationName(pen)]));
  const weighingMap = new Map(weighings.filter(w => w.date <= today).map(w => [w.id, w]));
  const latest = new Map<string, { record: WeightRecord; weighing: Weighing }>();
  for (const record of records) {
    const weighing = weighingMap.get(record.weighing_id);
    if (!weighing) continue;
    const previous = latest.get(record.animal_id);
    const rank = `${weighing.date}|${weighing.created_at}|${weighing.id}|${record.id}`;
    const previousRank = previous ? `${previous.weighing.date}|${previous.weighing.created_at}|${previous.weighing.id}|${previous.record.id}` : "";
    if (rank > previousRank) latest.set(record.animal_id, { record, weighing });
  }
  return {
    title: "Relatório de animais", filename: "animais", filters,
    pdf: { format: "a3", centerColumns: true, compactHeader:true, embeddedFont:true, fontSize:8, summary: animals.some(a=>a.current_weight_kg===null)?`${animals.filter(a=>a.current_weight_kg===null).length} animal(is) sem peso individual informado.`:undefined },
    note: `Arrobas: estimativa de carcaça (peso vivo x ${DEFAULT_CARCASS_YIELD}% / 15). Ganho e GMD: entrada do lote atual até a última pesagem individual compatível. Sem base: traço. Sem nova pesagem, o último peso pode ser o de entrada. Pesos em kg; GMD em kg/dia.`,
    columns: [
      { title: "Brinco" }, { title: "SISBOV" }, { title: "Lote" }, { title: "Local" },
      { title: "Entrada do lote" }, { title: "Peso de entrada (kg)", decimals: 1 },
      { title: "Último peso registrado (kg)", decimals: 1 }, { title: "Última pesagem" },
      { title: "Ganho (kg)", decimals: 1 }, { title: "GMD (kg/dia)", decimals: 2 },
      { title: "Arrobas", decimals: 2 }, { title: "Status" }, { title: "Situação sanitária" },
    ],
    rows: animals.map(animal => {
      const lot = animal.lot_id ? lotMap.get(animal.lot_id) : undefined;
      const measurement = latest.get(animal.id);
      const compatible = lot && measurement && measurement.weighing.lot_id === lot.id
        && measurement.weighing.date >= lot.entry_date
        && measurement.record.weight_kg === animal.current_weight_kg;
      const gmd = compatible ? computeGmd(animal.entry_weight_kg, animal.current_weight_kg, daysBetween(lot.entry_date, measurement.weighing.date)) : null;
      return [
        animal.ear_tag, animal.sisbov, lot?.code ?? null, animal.pen_id ? penMap.get(animal.pen_id) ?? null : null,
        lot ? formatDate(lot.entry_date) : null, animal.entry_weight_kg, animal.current_weight_kg,
        measurementInfo.get(animal.id)?.weightSource==="individual"?formatDate(measurementInfo.get(animal.id)!.weightDate):null,
        measurementInfo.get(animal.id)?.gain??null,
        gmd, liveWeightToArroba(animal.current_weight_kg), translate(`status.animal.${animal.status}`),
        animal.status === "ativo" || animal.status === "tratamento" ? translate(`status.health.${currentHealthStatus(animal, today)}`) : null,
      ];
    }),
  };
}

export function lotReport(lots: Lot[], pens: Pen[], weighings: Weighing[], translate: Translate, filters: string, today = todayIso()): ExportReport {
  const penMap = new Map(pens.map(pen => [pen.id, locationName(pen)]));
  return {
    title: "Relatório de lotes", filename: "lotes", filters,
    note: "Pesos e ganho por cabeça, em kg. GMD em kg/dia, calculado até a última pesagem do lote, conforme os indicadores da plataforma. Sem pesagem, o peso atual corresponde ao peso médio de entrada.",
    columns: [
      { title: "Lote" }, { title: "Local" }, { title: "Categoria" }, { title: "Cabeças", decimals: 0 },
      { title: "Entrada" }, { title: "Peso médio de entrada (kg)", decimals: 1 },
      { title: "Peso médio atual (kg)", decimals: 1 }, { title: "Última pesagem" },
      { title: "Ganho médio (kg)", decimals: 1 }, { title: "GMD (kg/dia)", decimals: 2 },
      { title: "Dias no lote", decimals: 0 }, { title: "Status" },
    ],
    rows: lots.map(lot => {
      const metrics = computeLotMetrics(lot, weighings, today);
      return [lot.code, lot.pen_id ? penMap.get(lot.pen_id) ?? null : null,
        lot.category ? translate(`status.category.${lot.category}`) : null, lot.head_count,
        formatDate(lot.entry_date), metrics.entryAvgWeight, metrics.currentAvgWeight,
        metrics.latestWeighing ? formatDate(metrics.latestWeighing.date) : null,
        metrics.totalGain, metrics.gmd, metrics.daysOnFeed, translate(`status.lot.${lot.status}`)];
    }),
  };
}
