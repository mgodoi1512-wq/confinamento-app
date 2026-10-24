/** Acrescenta o tipo somente na apresentação; não altera o código cadastrado. */
export function lotName(code?: string | null): string {
  const name = code?.trim();
  if (!name) return "Lote";
  if (/^lote(?:\s|[-:·]|$)/i.test(name)) {
    return name.replace(/^lote\s*[-:·]?\s*/i, "Lote ").trim();
  }
  return `Lote ${name}`;
}
