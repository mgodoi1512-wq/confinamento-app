import { parseNumberInput } from "./format";
export const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
export const number=parseNumberInput;
