import type { AnimalStockRow, StockItem } from "./financial-workspace";
export type Equipment={id:string;farm_id:string;name:string;quantity:number;acquisition_date:string;unit_value:number;manufacture_year:number|null;invoice_number:string;status:"ativo"|"baixado";notes:string;updated_at:string};
export type AssetRow={key:string;label:string;quantity:number;unit:"cabeças"|"kg"|"unidades";value:number|null;partial:boolean};
export function assetOverview(herd:AnimalStockRow[],items:StockItem[],equipment:Equipment[],arrobaPrice:number|null){
 const heads=herd.reduce((sum,row)=>sum+row.head,0),unknown=herd.reduce((sum,row)=>sum+row.unknown,0);
 const animalsValue=heads===0?0:arrobaPrice===null?null:herd.reduce((sum,row)=>sum+row.carcassArrobas*arrobaPrice,0);
 const rows:AssetRow[]=[{key:"animals",label:"Animais",quantity:heads,unit:"cabeças",value:animalsValue,partial:heads>0&&(arrobaPrice===null||unknown>0)}];
 for(const [category,label]of [["racao","Ração pronta"],["ingrediente","Insumos (ingredientes)"],["volumoso","Volumoso"]] as const){
  const selected=items.filter(item=>item.category===category);
  if(category==="volumoso"&&!selected.some(item=>item.quantity_kg>0||item.stock_value>0))continue;
  rows.push({key:category,label,quantity:selected.reduce((sum,item)=>sum+item.quantity_kg,0),unit:"kg",value:selected.reduce((sum,item)=>sum+item.stock_value,0),partial:false});
 }
 const active=equipment.filter(item=>item.status==="ativo");
 rows.push({key:"equipment",label:"Máquinas/equipamentos",quantity:active.reduce((sum,item)=>sum+item.quantity,0),unit:"unidades",value:active.reduce((sum,item)=>sum+item.quantity*item.unit_value,0),partial:false});
 return{rows,total:rows.reduce((sum,row)=>sum+(row.value??0),0),partial:rows.some(row=>row.partial),unknownAnimals:unknown};
}
