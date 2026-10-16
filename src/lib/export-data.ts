import { computeGmd, computeLotMetrics, currentHealthStatus, liveWeightToArroba, type Animal, type Lot, type Pen, type Weighing, type WeightRecord } from "./domain";
import { daysBetween, formatDate, todayIso } from "./format";

export type ExportColumn = { title: string; decimals?: number };
export type ExportReport = {
  title: string;
  pdf?: { format: "a4" | "a3"; fontSize?: number; embeddedFont?: boolean; columnWidths?: number[] };
  filename: string;
  recordCount?: number;
  filters: string;
  note: string;
  columns: ExportColumn[];
  rows: (string | number | null)[][];
};
type Translate = (key: string) => string;

export function animalReport(animals: Animal[], lots: Lot[], pens: Pen[], weighings: Weighing[], records: WeightRecord[], translate: Translate, filters: string, today = todayIso()): ExportReport {
  const lotMap = new Map(lots.map(lot => [lot.id, lot]));
  const penMap = new Map(pens.map(pen => [pen.id, pen.code]));
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
    note: "GMD individual = (peso atual - peso de entrada) / dias entre a entrada do lote atual e a última pesagem individual. Sem base compatível, o GMD fica em branco. Pesos em kg; GMD em kg/dia. A data de entrada é a do lote.",
    columns: [
      { title: "Brinco" }, { title: "SISBOV" }, { title: "Lote" }, { title: "Curral" },
      { title: "Entrada do lote" }, { title: "Peso de entrada (kg)", decimals: 1 },
      { title: "Peso atual (kg)", decimals: 1 }, { title: "Última pesagem" },
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
        measurement ? formatDate(measurement.weighing.date) : null,
        animal.entry_weight_kg != null && animal.current_weight_kg != null ? animal.current_weight_kg - animal.entry_weight_kg : null,
        gmd, liveWeightToArroba(animal.current_weight_kg), translate(`status.animal.${animal.status}`),
        animal.status === "ativo" || animal.status === "tratamento" ? translate(`status.health.${currentHealthStatus(animal, today)}`) : null,
      ];
    }),
  };
}

export function lotReport(lots: Lot[], pens: Pen[], weighings: Weighing[], translate: Translate, filters: string, today = todayIso()): ExportReport {
  const penMap = new Map(pens.map(pen => [pen.id, pen.code]));
  return {
    title: "Relatório de lotes", filename: "lotes", filters,
    note: "Pesos e ganho por cabeça, em kg. GMD em kg/dia, calculado até a última pesagem do lote, conforme os indicadores da plataforma. Sem pesagem, o peso atual corresponde ao peso médio de entrada.",
    columns: [
      { title: "Lote" }, { title: "Curral" }, { title: "Categoria" }, { title: "Cabeças", decimals: 0 },
      { title: "Entrada" }, { title: "Peso médio de entrada (kg)", decimals: 1 },
      { title: "Peso médio atual (kg)", decimals: 1 }, { title: "Última pesagem" },
      { title: "Ganho médio (kg)", decimals: 1 }, { title: "GMD (kg/dia)", decimals: 2 },
      { title: "Dias de cocho", decimals: 0 }, { title: "Status" },
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
