/** Telefone brasileiro de contato; não altera a autenticação por e-mail. */
export function formatContactPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const local = digits.slice(2);
  const prefix = local.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, prefix)}${local.length > prefix ? `-${local.slice(prefix)}` : ""}`;
}

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
