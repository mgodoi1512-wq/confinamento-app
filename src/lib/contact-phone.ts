/** Telefone brasileiro de contato; não altera a autenticação por e-mail. */
export function normalizeContactPhone(value: string): string | null {
  if (/[^\d\s()+.-]/.test(value)) return null;
  if (value.trim().startsWith("+") && !value.trim().startsWith("+55")) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (!/^[1-9]\d[2-9]\d{7,8}$/.test(digits)) return null;
  return `+55${digits}`;
}

export function formatContactPhone(value: string | null | undefined): string {
  const phone = value ? normalizeContactPhone(value) : null;
  if (!phone) return "Não informado";
  const digits = phone.slice(3);
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`;
}
