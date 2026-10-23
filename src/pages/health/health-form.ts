import { isValidIsoDate } from "@/lib/format";

export type HealthFormErrors = Partial<Record<"animal" | "product" | "date" | "withdrawal" | "cause", string>>;
type BaseForm = { animalId: string; eligibleIds: string[]; date: string; today: string };

const validateBase = ({ animalId, eligibleIds, date, today }: BaseForm): HealthFormErrors => {
  const errors: HealthFormErrors = {};
  if (!eligibleIds.includes(animalId)) errors.animal = "Selecione um animal ativo ou em tratamento.";
  if (!isValidIsoDate(date) || date > today) errors.date = "Informe uma data válida, até hoje.";
  return errors;
};

/** Vazio não é zero; rejeita decimais, sinais e texto misturado ao prazo. */
export const parseWithdrawalDays = (raw: string): number | null => {
  if (!/^\d+$/.test(raw.trim())) return null;
  const days = Number(raw.trim());
  return Number.isSafeInteger(days) && days <= 36500 ? days : null;
};

export const validateTreatmentForm = (form: BaseForm & { product: string; withdrawal: string }): HealthFormErrors => {
  const errors = validateBase(form);
  if (!form.product.trim()) errors.product = "Informe o produto aplicado.";
  if (parseWithdrawalDays(form.withdrawal) === null) errors.withdrawal = "Informe a carência em dias inteiros, de 0 a 36500.";
  return errors;
};

export const validateDeathForm = (form: BaseForm & { cause: string }): HealthFormErrors => {
  const errors = validateBase(form);
  if (!form.cause.trim()) errors.cause = "Informe a causa ou marque Não determinada.";
  return errors;
};
