import {useState} from "react";
import {Blend,Plus,Trash2} from "lucide-react";
import {toast} from "sonner";
import {useFeedProduction} from "@/hooks/use-feed-production";
import {previewFeedProduction,feedRoleLabel,type FeedRole} from "@/lib/feed-production";
import type {StockItem} from "@/lib/financial-workspace";
import {money,number} from "@/lib/financial-format";
import {formatNumber,todayIso} from "@/lib/format";
import {validCashDate} from "@/lib/loan-installments";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {NumericField} from "@/components/app/numeric-field";
import {TextField} from "@/components/form/text-field";
import {SelectField} from "@/components/form/select-field";
type DraftLine={key:string;role:FeedRole;item_id:string;percent:string};
const initialLines=():DraftLine[]=>[{key:"energia",role:"energia",item_id:"",percent:"80"},{key:"proteina",role:"proteina",item_id:"",percent:"15"},{key:"nucleo",role:"nucleo",item_id:"",percent:"5"}];
export default function FeedProduction({items}:{items:StockItem[]}){
 const[open,setOpen]=useState(false),[lines,setLines]=useState<DraftLine[]>(initialLines),[quantity,setQuantity]=useState(""),[date,setDate]=useState(todayIso),[notes,setNotes]=useState(""),[requestId,setRequestId]=useState(""),[selectedRecipe,setSelectedRecipe]=useState("");
 const{recipes,produce}=useFeedProduction(open),ingredients=items.filter(i=>i.category==="ingrediente").sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{numeric:true}));
 const change=()=>setRequestId(crypto.randomUUID());
 const patch=(index:number,value:Partial<DraftLine>)=>{setSelectedRecipe("");setLines(current=>current.map((l,i)=>i===index?{...l,...value}:l));change();};
 const totalPercent=lines.reduce((s,l)=>s+(number(l.percent)??0),0);
 let preview:ReturnType<typeof previewFeedProduction>|null=null,issue="";
 try{preview=previewFeedProduction(number(quantity)??0,lines.map(l=>({item_id:l.item_id,role:l.role,percent:number(l.percent)??0})),items,recipes.data??[]);}catch(e){issue=e instanceof Error?e.message:"Confira a composição.";}
 const validDate=validCashDate(date)&&date<=todayIso();
 const ready=!!preview&&!preview.insufficient&&recipes.isSuccess&&validDate&&notes.length<=2000;
 const show=()=>{setSelectedRecipe("");setLines(initialLines());setQuantity("");setDate(todayIso());setNotes("");change();setOpen(true);};
 const submit=async()=>{if(!ready||!preview||produce.isPending)return;try{await produce.mutateAsync({id:requestId,quantity_kg:preview.quantity_kg,production_date:date,notes,composition:preview.composition});setOpen(false);toast.success(`${formatNumber(preview.quantity_kg,3)} kg de ${preview.name} produzidos. Estoques atualizados.`);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível registrar a produção.");}};
 return <>
 <Button variant="outline" onClick={show}><Blend/>Criar ração</Button>
 <Dialog open={open} onOpenChange={v=>{if(!produce.isPending)setOpen(v);}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Criar ração pronta</DialogTitle><DialogDescription>Informe os kg da mistura e sua composição. Os ingredientes serão descontados e a ração pronta entrará no estoque ao confirmar.</DialogDescription></DialogHeader>
 <fieldset disabled={produce.isPending} className="space-y-4">
 <div className="grid gap-3 sm:grid-cols-2"><NumericField label="Quantidade de ração a produzir" unit="kg" value={quantity} onValueChange={v=>{setQuantity(v);change();}}/><TextField label="Data da produção" type="date" value={date} onChange={v=>{setDate(v);change();}}/></div>
 {recipes.isSuccess&&recipes.data.length>0&&<SelectField label="Usar composição salva" value={selectedRecipe} onChange={v=>{setSelectedRecipe(v);const recipe=recipes.data.find(r=>r.id===v);setLines(recipe?recipe.composition.map(c=>({key:c.item_id,role:c.role,item_id:c.item_id,percent:String(c.percent)})):initialLines());change();}} options={[{value:"",labelKey:"Nova composição"},...recipes.data.map(r=>({value:r.id,labelKey:r.name}))]}/>}
 {!ingredients.length&&<p role="alert" className="rounded-lg bg-amber-500/10 p-3 text-sm">Cadastre os insumos na categoria Ingrediente e registre suas entradas antes de produzir.</p>}
 <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Composição da ração</h3><span className={`text-sm font-semibold ${Math.abs(totalPercent-100)<.0000001?"text-green-700 dark:text-green-400":"text-amber-800 dark:text-amber-300"}`}>Total: {formatNumber(totalPercent,3)}%</span></div>
 <div className="space-y-2">{lines.map((line,index)=><div key={line.key} className="grid items-end gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"><SelectField label={feedRoleLabel[line.role]} value={line.item_id} onChange={v=>patch(index,{item_id:v})} options={[{value:"",labelKey:"Selecione o ingrediente"},...ingredients.map(i=>({value:i.id,labelKey:`${i.name} · ${formatNumber(i.quantity_kg,3)} kg disponíveis`}))]}/><NumericField label="Percentual" unit="%" value={line.percent} onValueChange={v=>patch(index,{percent:v})}/>{line.role==="outros"?<Button variant="ghost" size="icon" aria-label={`Remover ingrediente adicional ${index-2}`} onClick={()=>{setLines(lines.filter((_,i)=>i!==index));setSelectedRecipe("");change();}}><Trash2 className="size-4"/></Button>:<span className="hidden w-9 sm:block"/>}</div>)}</div>
 <Button variant="outline" disabled={lines.length>=10} onClick={()=>{setLines([...lines,{key:crypto.randomUUID(),role:"outros",item_id:"",percent:""}]);setSelectedRecipe("");change();}}><Plus/>Adicionar ingrediente</Button>
 {recipes.isError?<div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">Não foi possível carregar as composições. Confira se o SQL de produção foi instalado.<Button variant="ghost" onClick={()=>void recipes.refetch()}>Tentar novamente</Button></div>:recipes.isLoading?<p role="status" className="text-sm text-muted-foreground">Carregando composições…</p>:null}
 {preview?<section className="rounded-xl border bg-muted/40 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">Nome automático</p><h3 className="font-display text-lg font-semibold">{preview.name}</h3></div><strong className="text-green-700 dark:text-green-400">+ {formatNumber(preview.quantity_kg,3)} kg prontos</strong></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[500px] text-xs"><thead><tr>{["Ingrediente","Composição","Será usado","Saldo após"].map(h=><th key={h} className="px-2 py-2 text-center">{h}</th>)}</tr></thead><tbody>{preview.components.map(c=><tr key={c.item_id} className="border-t"><td className="px-2 py-2 text-center">{c.name}</td><td className="px-2 py-2 text-center">{formatNumber(c.percent,3)}%</td><td className="px-2 py-2 text-center font-semibold">{formatNumber(c.quantity_kg,3)} kg</td><td className={`px-2 py-2 text-center ${c.insufficient?"text-red-700 dark:text-red-400":""}`}>{c.insufficient?`Faltam ${formatNumber(c.quantity_kg-c.available,3)} kg`:`${formatNumber(c.available-c.quantity_kg,3)} kg`}</td></tr>)}</tbody></table></div><div className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-3 text-sm"><span>Custo estimado: <strong>{money(preview.totalCost)}</strong></span><span>Custo/kg: <strong>{money(preview.totalCost/preview.quantity_kg)}</strong></span></div><p className="mt-2 text-xs text-muted-foreground">O custo definitivo usa o saldo dos ingredientes ao confirmar. Composições diferentes com percentuais iguais recebem sufixos (2), (3)…</p>{preview.insufficient&&<p role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-400">Estoque insuficiente. Reponha os ingredientes indicados antes de produzir.</p>}</section>:<p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{issue}</p>}
 {!validDate&&<p role="alert" className="text-sm text-destructive">Informe uma data válida, até hoje.</p>}
 <TextField label="Observações da produção (opcional)" textarea value={notes} onChange={v=>{setNotes(v);change();}}/>
 <p className="text-xs text-muted-foreground">A produção transfere o custo dos ingredientes para a ração pronta e não gera lançamento no fluxo de caixa. Confira os vínculos dos tratos para consumir a ração pronta, evitando descontar novamente os ingredientes já usados.</p>
 <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button disabled={!ready||produce.isPending} onClick={()=>void submit()}>{produce.isPending?"Produzindo…":"Confirmar produção"}</Button></div>
 </fieldset></DialogContent></Dialog>
 </>;
}
