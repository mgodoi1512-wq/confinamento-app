/**
 * Formatação pt-BR de números e datas usada em todo o sistema.
 */

const numberFormatter = (decimals: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const formatNumber = (value: number | null | undefined, decimals = 1): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFormatter(decimals).format(value);
};

export const formatInteger = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
};

/** Converte uma string de input ("512,4" ou "512.4") em número. */
export const parseNumberInput = (raw: string): number | null => {
  let value = raw.trim().replace(/\s/g, "").replace(/(?:kg|@|%)$/i, "");
  if (!value) return null;
  if (value.includes(",")) {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(value)) return null;
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (!/^[+-]?\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const FARM_TIME_ZONE = import.meta.env?.VITE_FARM_TIME_ZONE || "America/Sao_Paulo";

export const todayIso = (now = new Date(), timeZone = FARM_TIME_ZONE): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const isValidIsoDate = (iso: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso;
};

export const parseIsoDate = (iso: string): Date => {
  if (!isValidIsoDate(iso)) throw new Error("Data inválida");
  return new Date(`${iso}T00:00:00Z`);
};

/** Diferença entre datas civis: aritmética em UTC evita horário de verão. */
export const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 86_400_000);

export const addDays = (iso: string, days: number): string => {
  if (!Number.isInteger(days) || days < 0) throw new Error("Número de dias inválido");
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** "10/10/2026" */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(parseIsoDate(iso));
};

/** "10 out" */
export const formatDateShort = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
    .format(parseIsoDate(iso))
    .replace(".", "");
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
};
