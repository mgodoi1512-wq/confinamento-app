/** Nome de exibição; mantém o código original para edição e gravação. */
export function locationName(location: {code?: string | null; location_type?: string | null} | null | undefined, fallback = "—"): string {
  const code = location?.code?.trim();
  if (!code) return fallback;
  const type = ({curral:"Curral",piquete:"Piquete",pasto:"Pasto"} as Record<string,string>)[location?.location_type ?? "curral"] ?? "Local";
  if (code.toLocaleLowerCase("pt-BR") === type.toLocaleLowerCase("pt-BR")) return type;
  const prefix = new RegExp(`^${type}(?:\\s|[-·:])`, "i");
  return prefix.test(code) ? code.replace(new RegExp(`^${type}\\s*[-·:]?\\s*`, "i"), `${type} `).trim() : `${type} ${code}`;
}
