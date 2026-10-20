import { stockAnimalDetails, stockProjectionSummary } from "./stock-animal-detail";
import { type Animal, type Lot, type Weighing, type WeightRecord } from "./domain";
import { todayIso } from "./format";

export type CashEntry = { id:string; farm_id:string; direction:"entrada"|"saida"; description:string; category:string; amount:number; due_date:string; settled_on:string|null; lot_id:string|null; notes:string; updated_at:string; loan_id?:string|null; loan_kind?:"principal"|"installment"|"amortization"|null; installment_index?:number|null; installment_count?:number|null };
export type StockItem = { id:string; name:string; category:"racao"|"volumoso"|"ingrediente"; minimum_kg:number; quantity_kg:number; stock_value:number; updated_at:string };
export type StockMovement = { id:string; item_id:string; kind:"entrada"|"saida"|"perda"|"trato"|"estorno"; quantity_kg:number; unit_cost:number; movement_date:string; notes:string; source_feed_id:string|null; created_at:string };
export type StockLink = { diet_id:string; ingredient:string; item_id:string };
export type WorkspaceSettings = { cash_configured?:boolean; opening_date:string; opening_balance:number; carcass_yield:number; arroba_price:number|null; updated_at:string };
export type Workspace = { settings:WorkspaceSettings|null; entries:CashEntry[]; items:StockItem[]; movements:StockMovement[]; links:StockLink[] };
export const stockCategory = {racao:"Ração pronta",volumoso:"Volumoso",ingrediente:"Ingrediente"};
export const movementLabel = {entrada:"Entrada",saida:"Saída",perda:"Perda",trato:"Trato",estorno:"Estorno de trato"};
export const cashCategories = ["Venda de animais","Compra de animais","Alimentação","Sanidade","Fretes","Mão de obra","Manutenção","Empréstimos","Outras receitas","Outras despesas"];
export function cashSummary(entries:CashEntry[], settings:WorkspaceSettings|null, month:string, today=todayIso()) {
  if(settings?.cash_configured===false)settings=null;
  const start=month+"-01", end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
  const openingDate=settings?.opening_date??start;
  const eligible=entries.filter(e=>e.settled_on&&e.settled_on>=openingDate);
  const signed=(e:CashEntry)=>e.direction==="entrada"?e.amount:-e.amount;
  const opening=(openingDate<=end?(settings?.opening_balance??0):0)+eligible.filter(e=>e.settled_on!<start).reduce((s,e)=>s+signed(e),0);
  const realized=eligible.filter(e=>e.settled_on!>=start&&e.settled_on!<=end);
  const income=realized.filter(e=>e.direction==="entrada").reduce((s,e)=>s+e.amount,0);
  const expenses=realized.filter(e=>e.direction==="saida").reduce((s,e)=>s+e.amount,0);
  const cutoff=end<today?end:today;
  const actual=(openingDate<=cutoff?(settings?.opening_balance??0):0)+eligible.filter(e=>e.settled_on!<=cutoff).reduce((s,e)=>s+signed(e),0);
  const pending=entries.filter(e=>(!e.settled_on||e.settled_on>end)&&e.due_date<=end);
  const payable=pending.filter(e=>e.direction==="saida").reduce((s,e)=>s+e.amount,0),receivable=pending.filter(e=>e.direction==="entrada").reduce((s,e)=>s+e.amount,0);
  const chart=Array.from({length:5},(_,i)=>({label:`${i*7+1}–${Math.min(i*7+7,Number(end.slice(8)))}`,income:0,expenses:0})).filter((_,i)=>i*7<Number(end.slice(8)));
  for(const e of realized){const i=Math.floor((Number(e.settled_on!.slice(8))-1)/7);chart[i][e.direction==="entrada"?"income":"expenses"]+=e.amount;}
  return {start,end,opening,income,expenses,actual,payable,receivable,projected:actual+receivable-payable,chart,realized};
}
export type AnimalStockRow = { id:string; code:string; head:number; average:number|null; totalKg:number; liveArrobas:number; carcassArrobas:number; date:string|null; estimated:boolean; projected:boolean; projectionLabel:string; projectionDescription:string; unknown:number; warning:string };
export function animalStock(lots:Lot[], animals:Animal[], weighings:Weighing[], records:WeightRecord[], yieldPct:number, project=false, today=todayIso()):AnimalStockRow[] {
  if(!Number.isFinite(yieldPct)||yieldPct<=0||yieldPct>100)throw new Error("Informe rendimento entre 0 e 100%.");
  const present=animals.filter(a=>a.status==="ativo"||a.status==="tratamento");
  const sessions=new Map(weighings.filter(w=>w.date<=today).map(w=>[w.id,w]));
  const latest=new Map<string,{weight:number;date:string;lotId:string|null;rank:string}>();
  for(const r of records){const w=sessions.get(r.weighing_id);if(!w)continue;const rank=`${w.date}|${w.created_at}|${w.id}|${r.id}`;if(rank>(latest.get(r.animal_id)?.rank??""))latest.set(r.animal_id,{weight:r.weight_kg,date:w.date,lotId:w.lot_id,rank});}
  const active=lots.filter(l=>l.status==="ativo"&&l.head_count>0&&l.entry_date<=today);
  const rows:AnimalStockRow[]=active.map(l=>{
    const members=present.filter(a=>a.lot_id===l.id);
    const detail=stockAnimalDetails(l,animals,weighings,records,{start:l.entry_date,end:today,yieldPct,arrobaPrice:null,project,asOf:today});
    const kg=detail.reduce((sum,a)=>sum+(a.end?.weight??0),0),head=detail.length,unknown=detail.filter(a=>!a.end).length;
    const projection=stockProjectionSummary(detail,project,today);
    const dates=detail.map(a=>a.end?.referenceDate).filter((d):d is string=>!!d).sort();
    return{id:l.id,code:l.code,head,average:unknown?null:kg/head,totalKg:kg,liveArrobas:kg/30,carcassArrobas:kg*yieldPct/100/15,date:dates[dates.length-1]??null,estimated:detail.some(a=>!a.end?.individual||a.end.projected||!a.registered),projected:detail.some(a=>a.end?.projected),projectionLabel:projection.label,projectionDescription:projection.description,unknown,warning:members.length!==l.head_count?`Cadastro individual incompleto ou divergente: ${members.length} presentes; ${l.head_count} cabeças no lote. Revise.`:""};
  });
  const activeIds=new Set(active.map(l=>l.id));
  const unallocated=present.filter(a=>!a.lot_id||!activeIds.has(a.lot_id));
  if(unallocated.length){let kg=0,unknown=0;for(const a of unallocated){const r=latest.get(a.id);const weight=r&&r.lotId===a.lot_id?r.weight:a.current_weight_kg??a.entry_weight_kg; if(weight&&weight>0)kg+=weight;else unknown++;}rows.push({id:"unallocated",code:"Fora de lotes ativos",head:unallocated.length,average:unknown?null:kg/unallocated.length,totalKg:kg,liveArrobas:kg/30,carcassArrobas:kg*yieldPct/100/15,date:null,estimated:true,projected:false,projectionLabel:project?"Sem GMD disponível":"Referência individual",projectionDescription:"Animais fora de lotes ativos mantêm seus pesos cadastrados, sem projeção pelo histórico do lote.",unknown,warning:"Animais presentes sem vínculo com um lote ativo. Revise os cadastros."});}
  return rows.sort((a,b)=>a.code.localeCompare(b.code,"pt-BR",{numeric:true}));
}
