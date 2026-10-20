import type { Animal, Lot, Weighing, WeightRecord } from "./domain";
export type AnimalMeasurementInfo={weightDate:string|null;weightSource:"individual"|"entry"|"unverified";gain:number|null;gainReason:string};
export function animalMeasurements(animals:Animal[],lots:Lot[],weighings:Weighing[],records:WeightRecord[],today:string){
 const sessions=new Map(weighings.filter(w=>w.date<=today).map(w=>[w.id,w]));
 const latest=new Map<string,{record:WeightRecord;session:Weighing;rank:string}>();
 for(const record of records){const session=sessions.get(record.weighing_id);if(!session)continue;const rank=`${session.date}|${session.created_at}|${session.id}|${record.id}`;if(rank>(latest.get(record.animal_id)?.rank??""))latest.set(record.animal_id,{record,session,rank});}
 const lotMap=new Map(lots.map(l=>[l.id,l]));
 return new Map(animals.map(animal=>{
  const lot=animal.lot_id?lotMap.get(animal.lot_id):undefined,point=latest.get(animal.id);
  const matched=!!point&&point.record.weight_kg===animal.current_weight_kg;
  const entry=!!lot&&lot.entry_date<=today&&animal.current_weight_kg===animal.entry_weight_kg&&animal.entry_weight_kg!==null;
  const compatible=matched&&!!lot&&point.session.lot_id===lot.id&&point.session.date>lot.entry_date;
  const gain=compatible&&animal.entry_weight_kg!==null&&animal.current_weight_kg!==null?animal.current_weight_kg-animal.entry_weight_kg:null;
  return [animal.id,{weightDate:matched?point.session.date:entry?lot.entry_date:null,weightSource:matched?"individual":entry?"entry":"unverified",gain,
   gainReason:gain!==null?`Comparação entre o peso de entrada e a pesagem individual de ${point!.session.date}.`:!lot?"Sem lote de referência para definir o período do ganho.":"Aguardando pesagem individual após a entrada, compatível com o lote e com o peso registrado."} satisfies AnimalMeasurementInfo] as const;
 }));
}
