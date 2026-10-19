import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { PageLoading } from "@/components/app/page-loading";
import { NumericField } from "@/components/app/numeric-field";
import { ExportButtons } from "@/components/app/export-buttons";
import { StatCard } from "@/components/app/stat-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { TextField } from "@/components/form/text-field";
import { SelectField } from "@/components/form/select-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useCostSheet, useSaveCostSheet, type CostSheet } from "@/hooks/use-finance";
import { computeFinance, computeIngredient, computeSilage, ingredientKeys, validateFinance, type FinanceInput, type IngredientCost, type SilageCost, type FreightUnit } from "@/lib/finance";
import type { ExportReport } from "@/lib/export-data";
import { formatDateTime, formatNumber, parseNumberInput } from "@/lib/format";

type IngredientKey = typeof ingredientKeys[number];
type FreightDraft = { freight: string; freightUnit: FreightUnit; loadKg: string };
type IngredientDraft = FreightDraft & { name: string; bagKg: string; bagPrice: string; sharePct: string };
type Draft = Record<IngredientKey,IngredientDraft> & { silage: FreightDraft & { price: string; priceUnit: "kg"|"ton" } };
const initialDraft=():Draft=>({energy:{name:"Milho",bagKg:"50",bagPrice:"",sharePct:"80",freight:"0",freightUnit:"bag",loadKg:""},protein:{name:"Torta de Algodão",bagKg:"30",bagPrice:"",sharePct:"15",freight:"0",freightUnit:"bag",loadKg:""},nucleus:{name:"Núcleo",bagKg:"25",bagPrice:"",sharePct:"5",freight:"0",freightUnit:"bag",loadKg:""},silage:{price:"",priceUnit:"kg",freight:"0",freightUnit:"ton",loadKg:""}});
const titles:Record<IngredientKey,string>={energy:"Energia",protein:"Proteína",nucleus:"Núcleo"};
const hints:Record<IngredientKey,string>={energy:"Milho ou sorgo",protein:"Torta de algodão ou casquinha de soja",nucleus:"Núcleo da composição da ração"};
const number=(value:string)=>parseNumberInput(value)??NaN;
const freightInput=(data:FreightDraft)=>({freight:number(data.freight),freightUnit:data.freightUnit,loadKg:data.freightUnit==="load" && data.loadKg.trim() ? number(data.loadKg) : null});
const ingredientInput=(data:IngredientDraft):IngredientCost=>({...freightInput(data),name:data.name,bagKg:number(data.bagKg),bagPrice:number(data.bagPrice),sharePct:number(data.sharePct)});
const silageInput=(data:Draft["silage"]):SilageCost|null=>{
  if(!data.price.trim()) {
    if(number(data.freight)===0)return null;
    throw new Error("Informe o preço da silagem; use zero se quiser considerar somente o frete.");
  }
  return {...freightInput(data),price:number(data.price),priceUnit:data.priceUnit};
};
const inputFromDraft=(data:Draft):FinanceInput=>validateFinance({energy:ingredientInput(data.energy),protein:ingredientInput(data.protein),nucleus:ingredientInput(data.nucleus),silage:silageInput(data.silage)});
const draftFromInput=(input:FinanceInput):Draft=>{
  const result=initialDraft();
  for(const key of ingredientKeys){const item=input[key];result[key]={name:item.name,bagKg:String(item.bagKg),bagPrice:String(item.bagPrice),sharePct:String(item.sharePct),freight:String(item.freight),freightUnit:item.freightUnit,loadKg:item.loadKg===null?"":String(item.loadKg)};}
  if(input.silage){const item=input.silage;result.silage={price:String(item.price),priceUnit:item.priceUnit,freight:String(item.freight),freightUnit:item.freightUnit,loadKg:item.loadKg===null?"":String(item.loadKg)};}
  return result;
};
const attempt=<T,>(compute:()=>T):{value:T|null;error:string|null}=>{try{return{value:compute(),error:null};}catch(error){return{value:null,error:error instanceof Error?error.message:"Confira os valores."};}};
const money=(value:number,digits=4)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const freightOptions=[{value:"bag",labelKey:"Por saca (R$/saca)"},{value:"ton",labelKey:"Por tonelada (R$/t)"},{value:"load",labelKey:"Total da carga (R$)"}];
const silageFreightOptions=[{value:"kg",labelKey:"Por kg (R$/kg)"},...freightOptions.filter(item=>item.value!=="bag")];
const resultPanelClass="border-[#d69220] bg-[#f4b334] bg-[linear-gradient(135deg,#ffd58a_0%,#f4b334_55%,#e99a22_100%)] text-[#3b230f] [&_p]:text-[#3b230f]";
const statClass=`${resultPanelClass} min-w-0 [&_.font-display]:break-words [&_.font-display]:text-2xl`;

export default function Finance(){
  const {tenant,isGestor}=useAuth();
  const farmId=tenant?.farmId??null;
  const query=useCostSheet(),save=useSaveCostSheet();
  const [draft,setDraft]=useState<Draft>(initialDraft);
  const [loadedFarm,setLoadedFarm]=useState<string|null>(null);
  const [version,setVersion]=useState<string|null>(null);
  const [baseline,setBaseline]=useState("");
  const [loadError,setLoadError]=useState<string|null>(null);
  useEffect(()=>{
    if(!isGestor || !farmId || loadedFarm===farmId || (!query.isSuccess && !query.isError))return;
    let next=initialDraft(),error:string|null=null;
    if(query.data){try{next=draftFromInput(validateFinance(query.data.parameters));}catch{error="Os valores salvos precisam ser revistos. Informe os valores novamente antes de salvar.";}}
    setDraft(next);setVersion(query.data?.updated_at??null);setBaseline(error?"":JSON.stringify(next));setLoadError(error);setLoadedFarm(farmId);
  },[farmId,isGestor,loadedFarm,query.isSuccess,query.isError,query.data]);
  const dirty=baseline!==JSON.stringify(draft);
  const results=useMemo(()=>({energy:attempt(()=>computeIngredient(ingredientInput(draft.energy))),protein:attempt(()=>computeIngredient(ingredientInput(draft.protein))),nucleus:attempt(()=>computeIngredient(ingredientInput(draft.nucleus)))}),[draft]);
  const ration=useMemo(()=>attempt(()=>computeFinance({...Object.fromEntries(ingredientKeys.map(key=>[key,ingredientInput(draft[key])])),silage:null})),[draft]);
  const silage=useMemo(()=>attempt(()=>{const input=silageInput(draft.silage);return input ? computeSilage(input) : null;}),[draft.silage]);
  const full=useMemo(()=>attempt(()=>inputFromDraft(draft)),[draft]);
  const sum=ingredientKeys.reduce((total,key)=>total+number(draft[key].sharePct),0);
  const change=(key:IngredientKey,field:keyof IngredientDraft,value:string)=>setDraft(current=>({...current,[key]:{...current[key],[field]:value}}));
  const changeSilage=(field:keyof Draft["silage"],value:string)=>setDraft(current=>({...current,silage:{...current.silage,[field]:value}}));
  const load=(row:CostSheet|null)=>{
    try{const next=row?draftFromInput(validateFinance(row.parameters)):initialDraft();setDraft(next);setVersion(row?.updated_at??null);setBaseline(JSON.stringify(next));setLoadError(null);}
    catch(error){toast.error(error instanceof Error?error.message:"Não foi possível abrir os valores salvos.");}
  };
  const reload=async()=>{
    if(dirty && !window.confirm("Descartar as alterações da simulação e recarregar os valores salvos?"))return;
    const result=await query.refetch();if(result.isError){toast.error("Não foi possível carregar os custos salvos.");return;}load(result.data??null);
  };
  const saveValues=async()=>{
    if(!full.value || !query.isSuccess || !isGestor || save.isPending)return;
    const submitted=JSON.stringify(draft);
    try{const row=await save.mutateAsync({parameters:full.value,expectedUpdatedAt:version});setVersion(row.updated_at);setBaseline(submitted);toast.success("Custos salvos para esta fazenda.");}
    catch(error){toast.error(error instanceof Error?error.message:"Não foi possível salvar os custos.");}
  };
  type Row={key:IngredientKey;name:string;share:number;price:number|null;contribution:number|null};
  const rows:Row[]=ingredientKeys.map(key=>({key,name:draft[key].name,share:number(draft[key].sharePct),price:results[key].value?.pricePerKg??null,contribution:results[key].value?.contribution??null}));
  const columns:Column<Row>[]=[{key:"ingredient",headerKey:"Ingrediente",render:row=>row.name},{key:"share",headerKey:"Composição",numeric:true,render:row=>`${formatNumber(row.share,2)}%`},{key:"kg",headerKey:"Custo entregue (R$/kg)",numeric:true,render:row=>row.price===null?"—":money(row.price)},{key:"contribution",headerKey:"Participação no custo (R$/kg)",numeric:true,render:row=>row.contribution===null?"—":money(row.contribution)}];
  const report=():ExportReport=>{
    if(!full.value)throw new Error(full.error??"Confira os valores.");
    const input=full.value,result=computeFinance(input);
    const freightLabel:Record<FreightUnit,string>={bag:"R$/saca",kg:"R$/kg",ton:"R$/t",load:"R$ por carga"};
    return{title:"Alimentação — Custos",filename:"financeiro-alimentacao",filters:"Composição da ração e custos entregues na fazenda",note:"Valores informados na simulação. Frete rateado pela unidade escolhida; sem arredondamento nos cálculos intermediários. Composição da ração soma 100%. Silagem calculada separadamente.",columns:[{title:"Item"},{title:"Unidade de compra"},{title:"Preço de compra (R$)",decimals:4},{title:"Frete informado (R$)",decimals:4},{title:"Unidade do frete"},{title:"Peso da carga (kg)",decimals:3},{title:"Composição (%)",decimals:4},{title:"Compra (R$/kg)",decimals:6},{title:"Frete (R$/kg)",decimals:6},{title:"Custo entregue (R$/kg)",decimals:6},{title:"Participação na ração (R$/kg)",decimals:6}],rows:[...ingredientKeys.map(key=>{const item=input[key],cost=result.ingredients[key];return[item.name,`Saca ${formatNumber(item.bagKg,3)} kg`,item.bagPrice,item.freight,freightLabel[item.freightUnit],item.loadKg,item.sharePct,cost.basePerKg,cost.freightPerKg,cost.pricePerKg,cost.contribution];}),["Ração pronta","kg",null,null,null,null,100,null,null,result.rationPerKg,result.rationPerKg],["Ração pronta — custo por tonelada","t",result.rationPerTon,null,null,null,null,null,null,null,null],...(input.silage && result.silage ? [["Silagem",input.silage.priceUnit,input.silage.price,input.silage.freight,freightLabel[input.silage.freightUnit],input.silage.loadKg,null,result.silage.basePerKg,result.silage.freightPerKg,result.silage.pricePerKg,null]] : [])]};
  };
  if(!isGestor || !farmId)return <p className="p-6">Acesso aos custos de alimentação disponível aos gestores da fazenda.</p>;
  if(query.isLoading || loadedFarm!==farmId)return <PageLoading />;
  return <div className="space-y-3">
    <Button variant="outline" asChild><Link to="/gestao/financeiro"><ArrowLeft className="size-4" />Voltar ao Financeiro</Link></Button>
    <PageHeader titleKey="nav.feedingCosts" subtitleKey="Calcule o custo da ração e da silagem, incluindo o frete." actions={<><ExportButtons getReport={report} disabled={!full.value} /><Button className="h-10" disabled={save.isPending || !query.isSuccess || !full.value || !dirty} onClick={()=>void saveValues()}><Save />{save.isPending?"Salvando...":"Salvar custos"}</Button></>} />
    {query.isError && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm">Não foi possível carregar os custos salvos. Você pode simular; recarregue antes de salvar. <Button variant="outline" onClick={()=>void reload()}>Tentar novamente</Button></div>}
    {loadError && <p role="alert" className="rounded-lg border border-warning p-3 text-sm">{loadError}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">{version?`Último salvamento: ${formatDateTime(version)}.`:"Nenhum custo salvo para esta fazenda."}{dirty?" Alterações ainda não salvas.":""}</p><Button variant="outline" size="sm" disabled={save.isPending || query.isFetching} onClick={()=>void reload()}><RefreshCw />Recarregar valores salvos</Button></div>
    <fieldset disabled={save.isPending} className="min-w-0 space-y-3 [&_label]:flex [&_label]:min-h-6 [&_label]:items-end [&_label]:text-sm [&_label]:font-medium [&_label]:text-foreground [&_input]:h-11 sm:[&_input]:h-10 [&_button[role=combobox]]:h-11 sm:[&_button[role=combobox]]:h-10">
      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-3">{ingredientKeys.map(key=>{const item=draft[key],cost=results[key];return <Card key={key} className="min-w-0"><CardHeader className="px-4 pb-3 pt-4"><CardTitle className="text-xl leading-snug">{titles[key]}</CardTitle><p className="text-sm text-muted-foreground xl:min-h-10">{hints[key]}</p></CardHeader><CardContent className="space-y-3 px-4 pb-4 pt-0">
        <TextField label="Ingrediente" value={item.name} onChange={value=>change(key,"name",value)} />
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2"><NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Preço da saca" unit="R$" value={item.bagPrice} onValueChange={value=>change(key,"bagPrice",value)} /><NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Peso da saca" unit="kg" value={item.bagKg} onValueChange={value=>change(key,"bagKg",value)} /></div>
        <SelectField label="Como o frete é cobrado?" value={item.freightUnit} onChange={value=>change(key,"freightUnit",value)} options={freightOptions} />
        <NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Valor do frete" unit={item.freightUnit==="bag"?"R$/saca":item.freightUnit==="ton"?"R$/t":"R$"} value={item.freight} onValueChange={value=>change(key,"freight",value)} helper="Use 0 se não houver frete." />
        {item.freightUnit==="load" && <NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Peso total da carga" unit="kg" value={item.loadKg} onValueChange={value=>change(key,"loadKg",value)} helper="Peso total transportado deste ingrediente para ratear o frete." />}
        <NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Participação na ração" unit="%" value={item.sharePct} onValueChange={value=>change(key,"sharePct",value)} />
        <div className={`${resultPanelClass} space-y-1 rounded-lg border p-3 text-sm`}><p className="text-muted-foreground">Preço entregue por kg</p><p className="break-words font-display text-2xl font-semibold num">{cost.value?money(cost.value.pricePerKg):"—"}</p>{cost.value && <p className="text-xs text-muted-foreground">Compra {money(cost.value.basePerKg)} + frete {money(cost.value.freightPerKg)} por kg</p>}</div>
        {item.bagPrice.trim() && cost.error && <p role="status" className="text-sm text-destructive">{cost.error}</p>}
      </CardContent></Card>;})}</div>
      <Card><CardHeader className="px-4 pb-3 pt-4"><CardTitle>Composição e preço da ração</CardTitle></CardHeader><CardContent className="space-y-3 px-4 pb-4 pt-0">
        <p className="text-sm">Composição total: <strong>{formatNumber(sum,2)}%</strong> · Energia × {formatNumber(number(draft.energy.sharePct),2)}% + proteína × {formatNumber(number(draft.protein.sharePct),2)}% + núcleo × {formatNumber(number(draft.nucleus.sharePct),2)}%.</p>
        {Number.isFinite(sum) && Math.abs(sum-100)>0.000001 && <p role="alert" className="rounded-lg border border-warning p-3 text-sm">Ajuste a composição para somar 100%.</p>}
        <div className="overflow-x-auto"><DataTable rows={rows} columns={columns} getRowKey={row=>row.key} renderCard={row=><div className="space-y-2 text-sm"><p className="font-semibold">{row.name} · {formatNumber(row.share,2)}%</p><p>Custo entregue: {row.price===null?"—":money(row.price)} por kg</p><p>Participação no custo da ração: {row.contribution===null?"—":money(row.contribution)} por kg</p></div>} /></div>
        <div className="grid gap-3 sm:grid-cols-3"><StatCard className={statClass} labelKey="Preço da ração por kg" value={ration.value?money(ration.value.rationPerKg):"—"} /><StatCard className={statClass} labelKey="Custo por 100 kg de ração" value={ration.value?money(ration.value.costPer100Kg,2):"—"} /><StatCard className={statClass} labelKey="Custo por tonelada de ração" value={ration.value?money(ration.value.rationPerTon,2):"—"} /></div>
        {!ration.value && <p className="text-sm text-muted-foreground">{ration.error} Preencha o preço das três sacas para obter o custo da mistura.</p>}
      </CardContent></Card>
      <Card><CardHeader className="px-4 pb-3 pt-4"><CardTitle>Silagem</CardTitle></CardHeader><CardContent className="space-y-3 px-4 pb-4 pt-0"><p className="text-sm text-muted-foreground">Custo calculado separadamente da ração. Deixe o preço vazio se ainda não quiser incluir a silagem.</p>
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:[&_label]:min-h-10"><NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Preço de compra da silagem" unit={draft.silage.priceUnit==="ton"?"R$/t":"R$/kg"} value={draft.silage.price} onValueChange={value=>changeSilage("price",value)} /><SelectField label="Unidade do preço" value={draft.silage.priceUnit} onChange={value=>changeSilage("priceUnit",value)} options={[{value:"kg",labelKey:"Por kg"},{value:"ton",labelKey:"Por tonelada (1.000 kg)"}]} /><NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Frete da silagem" unit={draft.silage.freightUnit==="kg"?"R$/kg":draft.silage.freightUnit==="ton"?"R$/t":"R$"} value={draft.silage.freight} onValueChange={value=>changeSilage("freight",value)} /><SelectField label="Unidade do frete" value={draft.silage.freightUnit} onChange={value=>changeSilage("freightUnit",value)} options={silageFreightOptions} />{draft.silage.freightUnit==="load" && <NumericField compact className="[&>div]:h-11 sm:[&>div]:h-10" label="Peso total da carga de silagem" unit="kg" value={draft.silage.loadKg} onValueChange={value=>changeSilage("loadKg",value)} />}</div>
        {silage.error && <p role="status" className="text-sm text-destructive">{silage.error}</p>}
        <div className="grid gap-3 sm:grid-cols-2"><StatCard className={statClass} labelKey="Silagem entregue por kg" value={silage.value?money(silage.value.pricePerKg):"—"} /><StatCard className={statClass} labelKey="Silagem entregue por tonelada" value={silage.value?money(silage.value.pricePerKg*1000,2):"—"} /></div>
      </CardContent></Card>
    </fieldset>
  </div>;
}
