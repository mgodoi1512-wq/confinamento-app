import type { Animal, Lot, Weighing, WeightRecord } from "./domain";
import { daysBetween, todayIso } from "./format";
export type PurchaseDefault={amount_per_head:number;updated_at:string};
export type AnimalPurchase={animal_id:string;amount:number;updated_at:string};
export type PurchaseValues={default:PurchaseDefault|null;animals:AnimalPurchase[]};
type Point={weight:number;date:string;individual:boolean;rank:string};
export type StockWeight={weight:number;referenceDate:string;valueDate:string;gmd:number|null;projected:boolean;individual:boolean};
export type StockAnimalDetail={id:string;earTag:string;registered:boolean;start:StockWeight|null;end:StockWeight|null;gain:number|null;periodGmd:number|null;carcassArrobas:number|null;purchase:number|null;purchaseSource:"individual"|"default"|"missing";sale:number|null;difference:number|null};
const positive=(v:number|null|undefined):v is number=>Number.isFinite(v)&&v!>0;
export function stockWeightAt(lot:Lot,animal:Animal|null,date:string,weighings:Weighing[],records:WeightRecord[],project:boolean):StockWeight|null{
 if(date<lot.entry_date)return null;
 const individualEntry=animal&&positive(animal.entry_weight_kg)?animal.entry_weight_kg:null;
 const entry=individualEntry??lot.entry_avg_weight_kg;
 const points:Point[]=positive(entry)?[{weight:entry,date:lot.entry_date,individual:individualEntry!==null,rank:""}]:[];
 const sessions=weighings.filter(w=>w.lot_id===lot.id&&w.date>=lot.entry_date&&w.date<=date);
 for(const w of sessions){if(positive(w.avg_weight_kg)&&(w.kind!=="individual"||w.head_count_weighed>=lot.head_count))points.push({weight:w.avg_weight_kg,date:w.date,individual:false,rank:`${w.created_at}|${w.id}`});}
 if(animal){const map=new Map(sessions.map(w=>[w.id,w]));for(const r of records){const w=map.get(r.weighing_id);if(r.animal_id===animal.id&&w&&positive(r.weight_kg))points.push({weight:r.weight_kg,date:w.date,individual:true,rank:`${w.created_at}|${w.id}|${r.id}`});}}
 points.sort((a,b)=>a.date.localeCompare(b.date)||Number(a.individual)-Number(b.individual)||a.rank.localeCompare(b.rank));
 const last=points[points.length-1];if(!last)return null;
 let gmd:number|null=null;
 const first=last.individual?points.find(p=>p.individual&&p.date<last.date):positive(lot.entry_avg_weight_kg)&&last.date>lot.entry_date?{weight:lot.entry_avg_weight_kg,date:lot.entry_date}:null;
 if(first){const days=daysBetween(first.date,last.date);if(days>0)gmd=(last.weight-first.weight)/days;}
 const projected=project&&gmd!==null&&gmd>=0&&date>last.date;
 return{weight:projected?last.weight+gmd!*daysBetween(last.date,date):last.weight,referenceDate:last.date,valueDate:projected?date:last.date,gmd,projected,individual:last.individual};
}
export function stockAnimalDetails(lot:Lot,animals:Animal[],weighings:Weighing[],records:WeightRecord[],options:{start:string;end:string;yieldPct:number;arrobaPrice:number|null;project:boolean;asOf?:string},purchase:PurchaseValues={default:null,animals:[]}):StockAnimalDetail[]{
 const {start,end,yieldPct,arrobaPrice,project,asOf=todayIso()}=options;
 if(start<lot.entry_date||start>end||end>asOf)throw new Error("Confira o período: da entrada do lote até hoje.");
 if(!Number.isFinite(yieldPct)||yieldPct<=0||yieldPct>100||arrobaPrice!==null&&(!Number.isFinite(arrobaPrice)||arrobaPrice<0))throw new Error("Confira rendimento e preço da arroba.");
 const members=animals.filter(a=>a.lot_id===lot.id&&(a.status==="ativo"||a.status==="tratamento")).sort((a,b)=>a.ear_tag.localeCompare(b.ear_tag,"pt-BR",{numeric:true})||a.id.localeCompare(b.id));
 const head=lot.status==="ativo"?Math.max(lot.head_count,members.length):members.length;
 const population:(Animal|null)[]=[...members,...Array.from({length:Math.max(0,head-members.length)},()=>null)];
 const values=new Map(purchase.animals.map(p=>[p.animal_id,p.amount]));
 return population.map((animal,index)=>{
  const first=stockWeightAt(lot,animal,start,weighings,records,project),last=stockWeightAt(lot,animal,end,weighings,records,project);
  const hasProgress=first&&last&&last.valueDate>first.valueDate;
  const gain=hasProgress?last.weight-first.weight:null;
  const periodGmd=gain!==null?gain/daysBetween(first!.valueDate,last!.valueDate):null;
  const own=animal?values.get(animal.id):undefined,paid=own??purchase.default?.amount_per_head??null;
  const carcassArrobas=last?last.weight*yieldPct/100/15:null;
  const sale=carcassArrobas!==null&&arrobaPrice!==null?carcassArrobas*arrobaPrice:null;
  return{id:animal?.id??`unregistered:${lot.id}:${index}`,earTag:animal?.ear_tag??`Sem cadastro individual ${index-members.length+1}`,registered:!!animal,start:first,end:last,gain,periodGmd,carcassArrobas,purchase:paid,purchaseSource:own!==undefined?"individual":purchase.default?"default":"missing",sale,difference:sale!==null&&paid!==null?sale-paid:null};
 });
}
export function stockDetailTotals(rows:StockAnimalDetail[]){
 const purchaseKnown=rows.filter(r=>r.purchase!==null),saleKnown=rows.filter(r=>r.sale!==null);
 return{heads:rows.length,weight:rows.reduce((s,r)=>s+(r.end?.weight??0),0),arrobas:rows.reduce((s,r)=>s+(r.carcassArrobas??0),0),purchase:purchaseKnown.reduce((s,r)=>s+r.purchase!,0),purchaseCount:purchaseKnown.length,sale:saleKnown.reduce((s,r)=>s+r.sale!,0),saleCount:saleKnown.length,difference:rows.length>0&&rows.every(r=>r.difference!==null)?rows.reduce((s,r)=>s+r.difference!,0):null};
}

export type ProjectionInfo={label:string;description:string};
export function stockProjectionInfo(weight:StockWeight|null,enabled:boolean,target=todayIso()):ProjectionInfo {
 if(!weight)return{label:"Sem peso disponível",description:"Não há um peso de referência válido para projetar."};
 if(!enabled)return{label:weight.individual?"Pesagem individual":"Referência do lote",description:"Projeção desativada: exibindo o peso de referência disponível."};
 if(weight.referenceDate>=target)return{label:target===todayIso()?"Peso atualizado hoje":"Peso na data final",description:"A referência de peso já é da data consultada. Não há dias adicionais para projetar."};
 if(weight.gmd===null)return{label:"Sem GMD disponível",description:"Faltam referências de peso compatíveis em datas diferentes para calcular o GMD."};
 if(weight.gmd===0)return{label:"GMD igual a zero",description:"O GMD calculado é zero; a projeção mantém o mesmo peso."};
 if(weight.gmd<0)return{label:"GMD negativo",description:"O histórico indica perda de peso. A regra atual mantém a referência sem extrapolar essa perda."};
 if(weight.projected)return{label:"Projeção por GMD",description:"Peso projetado a partir da referência e do GMD histórico válido até a data consultada."};
 return{label:"Sem projeção aplicada",description:"O peso de referência foi mantido; confira as datas e o histórico do animal."};
}
export function stockProjectionSummary(rows:Pick<StockAnimalDetail,"end">[],enabled:boolean,target=todayIso()):ProjectionInfo {
 if(!rows.length)return{label:"Sem animais disponíveis",description:"Não há animais nesta consulta."};
 if(!enabled){if(rows.every(r=>!r.end))return stockProjectionInfo(null,false,target);return{label:rows.every(r=>r.end?.individual)?"Pesagem individual":"Referência do lote",description:"Projeção desativada: usando as referências individuais e médias compatíveis disponíveis."};}
 const counts=new Map<string,number>();let projected=0;
 for(const row of rows){const info=stockProjectionInfo(row.end,true,target);counts.set(info.label,(counts.get(info.label)??0)+1);if(info.label==="Projeção por GMD")projected++;}
 if(counts.size===1)return stockProjectionInfo(rows[0].end,true,target);
 const detail=[...counts].map(([label,count])=>`${label}: ${count}`).join("; ");
 return{label:projected>0?"Projeção parcial":"Sem projeção aplicada",description:`${projected} de ${rows.length} cabeça(s) com peso acrescido pela projeção. ${detail}.`};
}
