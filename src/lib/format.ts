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
  const normalized = raw.replace(/\s|kg|@|%/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const parseIsoDate = (iso: string): Date => new Date(`${iso}T00:00:00`);

/** Diferença em dias inteiros entre duas datas ISO (b - a). */
export const daysBetween = (fromIso: string, toIso: string): number => {
  const from = parseIsoDate(fromIso).getTime();
  const to = parseIsoDate(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
};

export const addDays = (iso: string, days: number): string => {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** "10/10/2026" */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parseIsoDate(iso));
};

/** "10 out" */
export const formatDateShort = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(parseIsoDate(iso))
    .replace(".", "");
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
};
