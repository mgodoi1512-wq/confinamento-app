export type AnimalTagInput = { kind: "sequence" | "list"; start: string | null; list: string };
export const emptyAnimalTagInput = (): AnimalTagInput => ({ kind: "sequence", start: null, list: "" });
export function buildAnimalTags(count: number, input: AnimalTagInput, suggested?: string): { tags: string[]; error: string | null } {
 if (!Number.isSafeInteger(count) || count < 1 || count > 10000) return { tags: [], error: "Informe entre 1 e 10.000 animais por cadastro." };
 let tags: string[];
 if (input.kind === "sequence") {
  const start = (input.start ?? suggested ?? "").trim();
  if (!/^[0-9]{1,30}$/.test(start)) return { tags: [], error: "Informe o brinco inicial com até 30 dígitos." };
  // Strings preservam zeros à esquerda; BigInt evita perda de precisão em brincos longos.
  const initial = BigInt(start);
  tags = Array.from({ length: count }, (_, index) => (initial + BigInt(index)).toString().padStart(start.length, "0"));
  if (tags[tags.length - 1].length > 30) return { tags: [], error: "A sequência ultrapassa o limite de 30 dígitos." };
 } else {
  tags = input.list.split(/[\n\r;,\t]+/).map(tag => tag.trim()).filter(Boolean);
  if (tags.length !== count) return { tags: [], error: `Informe exatamente ${count} brincos. Foram encontrados ${tags.length}.` };
  if (tags.some(tag => tag.length > 100)) return { tags: [], error: "Cada brinco deve ter no máximo 100 caracteres." };
 }
 if (new Set(tags).size !== tags.length) return { tags: [], error: "Não repita o mesmo brinco dentro do lote." };
 return { tags, error: null };
}
