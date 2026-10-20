import type { Tone } from "./domain";
export const operationalPenStatus=(status:string)=>status==="manutencao"||status==="inativo"?status:"ativo";
export function operationalPenLabel(status:string){return operationalPenStatus(status)==="manutencao"?"Em manutenção":operationalPenStatus(status)==="inativo"?"Inativo":"Ativo";}
export function occupancyBadge(head:number,capacity:number):{label:string;tone:Tone}{
 if(head<=0)return {label:"Vazio",tone:"muted"};
 if(capacity<=0||head>capacity)return {label:"Acima da capacidade",tone:"destructive"};
 if(head===capacity)return {label:"Lotado",tone:"warning"};
 return {label:"Ocupado",tone:"success"};
}
