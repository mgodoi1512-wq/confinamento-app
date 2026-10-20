import type { Lot } from "./domain";
export function selectLots<T extends Pick<Lot,"id"|"code"|"status"|"created_at"|"entry_date">>(lots:T[],status:string,search:string,order:string){
 const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
 const term=normalize(search);
 return lots.filter(lot=>(status==="all"||lot.status===status)&&normalize(lot.code).includes(term)).sort((a,b)=>
   (order==="recent"?(b.created_at||b.entry_date).localeCompare(a.created_at||a.entry_date):a.code.localeCompare(b.code,"pt-BR",{numeric:true,sensitivity:"base"}))||a.id.localeCompare(b.id));
}
