import { useState } from "react";
import { toast } from "sonner";
import { AnimalTagsEditor } from "./animal-tags-editor";
import { buildAnimalTags, emptyAnimalTagInput } from "@/lib/animal-registration";
import { useNextEarTag, useRegisterMissingLotAnimals } from "@/hooks/use-animal-registration";
import { DuplicateEarTagsError, type DuplicateEarTag } from "@/lib/mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export function RegisterMissingAnimalsDialog({lotId,lotCode,count,onClose}:{lotId:string;lotCode:string;count:number;onClose:()=>void}){
 const [expectedMissing]=useState(count),[input,setInput]=useState(emptyAnimalTagInput),[requestId]=useState(()=>crypto.randomUUID()),[conflicts,setConflicts]=useState<DuplicateEarTag[]|null>(null);
 const next=useNextEarTag(),save=useRegisterMissingLotAnimals(),result=buildAnimalTags(expectedMissing,input,next.data?.next);
 const submit=async(confirmed:string[]=[])=>{
  if(result.error){toast.error(result.error);return;}
  try{await save.mutateAsync({lot_id:lotId,tags:result.tags,expected_missing:expectedMissing,confirmedDuplicateEarTags:confirmed,requestId});toast.success(`${expectedMissing} animais identificados. A quantidade de cabeças do lote foi mantida.`);onClose();}
  catch(e){if(e instanceof DuplicateEarTagsError){setConflicts(e.matches);return;}toast.error(e instanceof Error?e.message:"Não foi possível cadastrar os animais.");}
 };
 return <Dialog open onOpenChange={open=>{if(!open&&!save.isPending)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Cadastrar animais faltantes — {lotCode}</DialogTitle><DialogDescription>Identifique as {expectedMissing} cabeças já contabilizadas que ainda não possuem cadastro individual. A quantidade do lote não será aumentada.</DialogDescription></DialogHeader>
 <fieldset disabled={save.isPending} className="space-y-4">{conflicts?<>
 <p className="font-semibold">Estes brincos já estão em uso em outros lotes</p><div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-3 text-sm">{conflicts.map((m,i)=><p key={i}>{m.earTag} — {m.lotCode}</p>)}</div><p className="text-sm text-muted-foreground">Os animais existentes serão mantidos. Deseja cadastrar estes identificadores também neste lote?</p>
 <div className="flex flex-wrap gap-2"><Button onClick={()=>void submit([...new Set(conflicts.map(m=>m.earTag))])} disabled={save.isPending}>{save.isPending?"Cadastrando…":"Cadastrar mesmo assim"}</Button><Button variant="outline" onClick={()=>setConflicts(null)}>Revisar brincos</Button></div>
 </>:<><AnimalTagsEditor count={expectedMissing} value={input} onChange={setInput} suggested={next.data?.next} loading={next.isLoading} onRetry={()=>void next.refetch()}/><p className="text-sm text-muted-foreground">As referências de peso e o preço padrão de compra continuam sendo os do lote. Este cadastro não registra pesagens individuais nem movimenta o caixa.</p><div className="flex flex-wrap gap-2"><Button disabled={save.isPending||!!result.error} onClick={()=>void submit()}>{save.isPending?"Cadastrando…":`Cadastrar ${expectedMissing} animais`}</Button><Button variant="outline" onClick={onClose}>Cancelar</Button></div></>}
 </fieldset></DialogContent></Dialog>;
}
