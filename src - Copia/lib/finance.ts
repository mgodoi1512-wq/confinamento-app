export type FreightUnit = "bag" | "kg" | "ton" | "load";
export type Freight = { freight: number; freightUnit: FreightUnit; loadKg: number | null };
export type IngredientCost = Freight & { name: string; bagKg: number; bagPrice: number; sharePct: number };
export type SilageCost = Freight & { price: number; priceUnit: "kg" | "ton" };
export type FinanceInput = { energy: IngredientCost; protein: IngredientCost; nucleus: IngredientCost; silage: SilageCost | null };
export const ingredientKeys = ["energy", "protein", "nucleus"] as const;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Confira os dados do cálculo.");
  return value as Record<string, unknown>;
};
const valid = (value: unknown, min: number, max=1e9): value is number => typeof value==="number" && Number.isFinite(value) && value>=min && value<=max;
const checkFreight = (data: Record<string, unknown>, units: string[]) => {
  if (!valid(data.freight,0) || !units.includes(String(data.freightUnit))) throw new Error("Confira o valor e a unidade do frete.");
  if (data.loadKg!==null && !valid(data.loadKg,0.001)) throw new Error("O peso da carga deve ser informado em kg e ser positivo.");
  if (data.freightUnit==="load" && Number(data.freight)>0 && !valid(data.loadKg,0.001)) throw new Error("Informe o peso total da carga em kg para dividir o frete.");
};
export const validateIngredient = (value: unknown): IngredientCost => {
  const data=object(value);
  if (typeof data.name!=="string" || !data.name.trim() || data.name.trim().length>100) throw new Error("Informe o nome do ingrediente, até 100 caracteres.");
  if (!valid(data.bagKg,0.001,1e6)) throw new Error("Informe o peso da saca em kg.");
  if (!valid(data.bagPrice,0)) throw new Error("Informe o preço da saca (zero é aceito).");
  if (!valid(data.sharePct,0,100)) throw new Error("A participação de cada ingrediente deve estar entre 0 e 100%.");
  checkFreight(data,["bag","ton","load"]);
  return {...data,name:data.name.trim()} as IngredientCost;
};
export const validateSilage = (value: unknown): SilageCost => {
  const data=object(value);
  if (!valid(data.price,0) || !["kg","ton"].includes(String(data.priceUnit))) throw new Error("Informe o preço e a unidade da silagem.");
  checkFreight(data,["kg","ton","load"]);
  return data as SilageCost;
};
export const validateFinance = (value: unknown): FinanceInput => {
  const data=object(value);
  const result={energy:validateIngredient(data.energy),protein:validateIngredient(data.protein),nucleus:validateIngredient(data.nucleus),silage:data.silage===null ? null : validateSilage(data.silage)};
  const sum=ingredientKeys.reduce((total,key)=>total+result[key].sharePct,0);
  if (Math.abs(sum-100)>0.000001) throw new Error("A composição da ração deve somar 100%.");
  return result;
};
export const freightPerKg = (input: Freight, bagKg?: number): number => {
  checkFreight(input as unknown as Record<string,unknown>,bagKg ? ["bag","ton","load"] : ["kg","ton","load"]);
  if (input.freight===0) return 0;
  switch(input.freightUnit) {
    case "bag": if(!bagKg || !valid(bagKg,0.001,1e6)) throw new Error("Informe o peso da saca.");return input.freight/bagKg;
    case "ton": return input.freight/1000;
    case "load": return input.freight/input.loadKg!;
    case "kg": return input.freight;
  }
};
export const computeIngredient = (value: unknown) => {
  const input=validateIngredient(value), basePerKg=input.bagPrice/input.bagKg, freightKg=freightPerKg(input,input.bagKg);
  const pricePerKg=basePerKg+freightKg;
  return {basePerKg,freightPerKg:freightKg,pricePerKg,contribution:pricePerKg*input.sharePct/100,kgPer100Kg:input.sharePct};
};
export const computeSilage = (value: unknown) => {
  const input=validateSilage(value), basePerKg=input.price/(input.priceUnit==="ton" ? 1000 : 1), freightKg=freightPerKg(input);
  return {basePerKg,freightPerKg:freightKg,pricePerKg:basePerKg+freightKg};
};
export const computeFinance = (value: unknown) => {
  const input=validateFinance(value);
  const ingredients={energy:computeIngredient(input.energy),protein:computeIngredient(input.protein),nucleus:computeIngredient(input.nucleus)};
  const rationPerKg=ingredientKeys.reduce((sum,key)=>sum+ingredients[key].contribution,0);
  return {ingredients,rationPerKg,rationPerTon:rationPerKg*1000,costPer100Kg:rationPerKg*100,silage:input.silage ? computeSilage(input.silage) : null};
};
