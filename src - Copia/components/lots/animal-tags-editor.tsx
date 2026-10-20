import type { AnimalTagInput } from "@/lib/animal-registration";
import { buildAnimalTags } from "@/lib/animal-registration";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
export function AnimalTagsEditor({count,value,onChange,suggested,loading=false,onRetry}:{count:number;value:AnimalTagInput;onChange:(v:AnimalTagInput)=>void;suggested?:string;loading?:boolean;onRetry?:()=>void}){
 const result=buildAnimalTags(count,value,suggested);
 return <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
  <div className="flex flex-wrap gap-2">{(["sequence","list"] as const).map(kind=><Button key={kind} type="button" variant={value.kind===kind?"default":"outline"} size="sm" aria-pressed={value.kind===kind} onClick={()=>onChange({...value,kind})}>{kind==="sequence"?"Gerar sequência":"Colar lista"}</Button>)}</div>
  {value.kind==="sequence"?<><TextField label="Brinco inicial" value={value.start??suggested??""} onChange={start=>onChange({...value,start})}/><p className="text-xs text-muted-foreground">{loading?"Consultando a numeração da fazenda…":"Sugerimos o próximo número após o maior brinco exclusivamente numérico da fazenda, inclusive de animais que já saíram. Confira os brincos físicos antes de salvar."}</p>{!loading&&!suggested&&value.start===null&&onRetry&&<Button type="button" variant="outline" size="sm" onClick={onRetry}>Tentar consultar novamente</Button>}</>:<TextField label={`Lista de brincos — ${count} animais`} textarea value={value.list} onChange={list=>onChange({...value,list})}/>}
  {value.kind==="list"&&<p className="text-xs text-muted-foreground">Separe por linha, vírgula ou ponto e vírgula. Os identificadores devem corresponder aos brincos físicos.</p>}
  {result.error?<p role="status" className="text-sm text-muted-foreground">{result.error}</p>:<p className="break-words text-sm"><strong>Prévia — {result.tags.length} animais:</strong> {result.tags.slice(0,6).join(", ")}{result.tags.length>6?`… ${result.tags[result.tags.length-1]}`:""}</p>}
 </div>;
}
