import { computeLotMetrics, type Lot, type Pen, type Weighing } from "./domain";
import { daysBetween, formatDate, formatNumber, isValidIsoDate, todayIso } from "./format";
import type { ExportReport } from "./export-data";

export const feedingGrade = [
  {lastDay:3,label:"1-3 dias",feedPct:.3,roughagePct:3},
  {lastDay:6,label:"4-6 dias",feedPct:.8,roughagePct:2.5},
  {lastDay:9,label:"7-9 dias",feedPct:1.3,roughagePct:2},
  {lastDay:12,label:"10-12 dias",feedPct:1.8,roughagePct:1.5},
  {lastDay:15,label:"13-15 dias",feedPct:2.3,roughagePct:1},
  {lastDay:Infinity,label:"16 dias ou mais",feedPct:2.5,roughagePct:.8},
] as const;
export const gradeForDay=(day:number)=>Number.isInteger(day)&&day>=1 ? feedingGrade.find(phase=>day<=phase.lastDay)! : null;
/** Centavos de kg: a última refeição absorve a diferença, sem perder o total do dia. */
export const splitDailyFeedKg=(kg:number):[number,number,number]=>{
  if(!Number.isFinite(kg)||kg<0)throw new Error("Quantidade diária inválida.");
  const cents=Math.round(kg*100),base=Math.round(cents/3);
  return [base/100,base/100,(cents-2*base)/100];
};
export type FeedingSuggestion={
  lotId:string;lotCode:string;penCode:string;head:number;day:number|null;weight:number|null;
  phase:typeof feedingGrade[number]|null;feedDaily:number|null;roughageDaily:number|null;
  meals:{period:string;feedKg:number;roughageKg:number}[];issue:string|null;
};
export const computeFeedingSuggestions=(lots:Lot[],pens:Pen[],weighings:Weighing[],date=todayIso()):FeedingSuggestion[]=>{
  if(!isValidIsoDate(date))throw new Error("Data de referência inválida.");
  const compare=new Intl.Collator("pt-BR",{numeric:true,sensitivity:"base"});
  return lots.filter(lot=>lot.status==="ativo").map(lot=>{
    const pen=pens.find(p=>p.id===lot.pen_id),head=lot.head_count;
    let issue:string|null=null,day:number|null=null,weight:number|null=null;
    if(!isValidIsoDate(lot.entry_date))issue="Confira a data de entrada";
    else if(lot.entry_date>date)issue="Entrada posterior à referência";
    else{
      day=daysBetween(lot.entry_date,date)+1;
      weight=computeLotMetrics(lot,weighings,date).currentAvgWeight;
      if(!Number.isFinite(weight)||!weight||weight<=0)issue="Peso médio inválido";
    }
    if(!Number.isInteger(head)||head<=0)issue="Quantidade de animais inválida";
    const phase=day!==null?gradeForDay(day):null;
    const feedRaw=!issue&&phase&&weight ? weight*phase.feedPct/100*head : null;
    const roughageRaw=!issue&&phase&&weight ? weight*phase.roughagePct/100*head : null;
    const feeds=feedRaw!==null?splitDailyFeedKg(feedRaw):null,roughages=roughageRaw!==null?splitDailyFeedKg(roughageRaw):null;
    return {lotId:lot.id,lotCode:lot.code,penCode:pen?.code??"Sem curral",head,day,weight,phase,
      feedDaily:feedRaw!==null?Math.round(feedRaw*100)/100:null,roughageDaily:roughageRaw!==null?Math.round(roughageRaw*100)/100:null,
      meals:feeds&&roughages?["Manhã","Tarde","Noite"].map((period,i)=>({period,feedKg:feeds[i],roughageKg:roughages[i]})):[],issue};
  }).sort((a,b)=>compare.compare(a.penCode,b.penCode)||compare.compare(a.lotCode,b.lotCode)||a.lotId.localeCompare(b.lotId));
};
const pair=(feed:number|null,roughage:number|null)=>feed===null||roughage===null?"—":`R: ${formatNumber(feed,2)} kg\nV: ${formatNumber(roughage,2)} kg`;
export const feedingSuggestionReport=(suggestions:FeedingSuggestion[],farmName:string,date=todayIso()):ExportReport=>{
  const valid=suggestions.filter(item=>!item.issue);
  const feed=valid.reduce((sum,item)=>sum+(item.feedDaily??0),0),roughage=valid.reduce((sum,item)=>sum+(item.roughageDaily??0),0);
  const mealTotals=[0,1,2].map(i=>({feed:valid.reduce((s,item)=>s+item.meals[i].feedKg,0),roughage:valid.reduce((s,item)=>s+item.meals[i].roughageKg,0)}));
  return {title:"Sugestão diária de fornecimento",filename:"sugestao-trato",recordCount:suggestions.length,filters:`${farmName} | Referência: ${formatDate(date)} | ${suggestions.length} lotes ativos | 3 refeições iguais`,
    note:`R = ração; V = volumoso. Valores em kg por lote. Peso vivo da última pesagem; sem pesagem, peso médio de entrada. Entrada conta como dia 1. Grade % PV (R/V): 1-3 dias: 0,3/3; 4-6: 0,8/2,5; 7-9: 1,3/2; 10-12: 1,8/1,5; 13-15: 2,3/1; a partir do dia 16: 2,5/0,8. Divisão em três refeições, com diferença de centavos ajustada na noite. Sugestão pela grade fixa, sem descontar tratos registrados nem alterar planos.${valid.length!==suggestions.length?` ${suggestions.length-valid.length} lote(s) precisa(m) de revisão; totais incluem apenas cálculos válidos.`:""}`,
    pdf:{format:"a4",fontSize:7.5,embeddedFont:true,columnWidths:[26,24,10,10,18,21,24,35,35,35,35]},
    columns:[{title:"Curral"},{title:"Lote"},{title:"Dia",decimals:0},{title:"Nº",decimals:0},{title:"Peso médio (kg)",decimals:2},{title:"Etapa"},{title:"% do peso vivo"},{title:"Total diário\nRação / Volumoso"},{title:"Manhã\nRação / Volumoso"},{title:"Tarde\nRação / Volumoso"},{title:"Noite\nRação / Volumoso"}],
    rows:[...suggestions.map(item=>[item.penCode,item.lotCode,item.day,Number.isFinite(item.head)?item.head:null,item.weight,
      item.issue??item.phase?.label??"Revisar",item.phase?`R: ${formatNumber(item.phase.feedPct,1)}%\nV: ${formatNumber(item.phase.roughagePct,1)}%`:null,
      pair(item.feedDaily,item.roughageDaily),...[0,1,2].map(i=>item.meals[i]?pair(item.meals[i].feedKg,item.meals[i].roughageKg):null)]),
      ...(suggestions.length?[["TOTAL",`${valid.length} lotes válidos`,null,valid.reduce((sum,item)=>sum+item.head,0),null,null,null,pair(feed,roughage),...mealTotals.map(item=>pair(item.feed,item.roughage))]]:[])],
  };
};
