import { useFeedStock } from "@/hooks/use-feed-stock";
import { feedStockNeeds, stockItemFor } from "@/lib/feed-stock";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NumericField } from "@/components/app/numeric-field";
import { SelectField } from "@/components/form/select-field";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LockKeyhole } from "lucide-react";
import { useDietItems, useDiets } from "@/hooks/use-diets";
import { useFeedLogs } from "@/hooks/use-feed";
import { useDailyFeedPlans, useFarmFeedSettings, useRecordPlannedFeed } from "@/hooks/use-feed-planning";
import { useLots } from "@/hooks/use-lots";
import { usePens } from "@/hooks/use-pens";
import { useWeighings } from "@/hooks/use-weighings";
import { computeLotMetrics, dietItemKg } from "@/lib/domain";
import { defaultFeedSchedule, feedIngredientPortions, portionPerHead, splitFeedSchedule, type PlannedIngredient } from "@/lib/feed-planning";
import { daysBetween, formatDate, formatNumber, parseNumberInput, todayIso } from "@/lib/format";

const nameOrder = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const shiftName: Record<string,string>={manha:"Manhã",tarde:"Tarde",noite:"Noite"};

const LockedReference=({label,value,unit}:{label:string;value:string;unit:string})=><div className="space-y-1.5">
  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">{label}<LockKeyhole aria-hidden="true" className="size-3" /></p>
  <output aria-label={label} className="flex h-10 cursor-not-allowed items-center justify-end gap-2 rounded-md border border-[#cdb6a3] bg-[#eadbcf] px-3 text-sm text-[#735c4c] dark:border-[#574333] dark:bg-[#30251e] dark:text-[#c9b49d]">
    <span className="num font-medium">{value}</span><span className="text-xs">{unit}</span>
  </output>
</div>;

export const FeedFormDialog = ({ trigger }: { trigger: ReactNode }) => {
  const {t}=useTranslation();const today=todayIso();
  const lotsQuery=useLots(),pensQuery=usePens(),dietsQuery=useDiets(),itemsQuery=useDietItems(),weightsQuery=useWeighings(),logsQuery=useFeedLogs();
  const plansQuery=useDailyFeedPlans(today),settings=useFarmFeedSettings(),record=useRecordPlannedFeed();
  const [open,setOpen]=useState(false),[lotId,setLotId]=useState(""),[dietId,setDietId]=useState(""),[shift,setShift]=useState("manha");
  const [requestedCount,setRequestedCount]=useState<number|null>(null);
  const [override,setOverride]=useState<string|null>(null),[notes,setNotes]=useState(""),[error,setError]=useState<string|null>(null);
  const stockQuery=useFeedStock(open);
  const request=useRef<{key:string;id:string}|null>(null),busy=useRef(false);
  const pens=pensQuery.data??[],allDiets=dietsQuery.data??[];
  const lots=(lotsQuery.data??[]).filter(l=>l.status==="ativo"&&l.head_count>0&&pens.some(p=>p.id===l.pen_id&&!["manutencao","inativo"].includes(p.status)))
    .sort((a,b)=>nameOrder.compare(pens.find(p=>p.id===a.pen_id)?.code??"",pens.find(p=>p.id===b.pen_id)?.code??"")||nameOrder.compare(a.code,b.code)||a.id.localeCompare(b.id));
  const availableLots=lots.filter(item=>{
    const saved=(plansQuery.data??[]).find(plan=>plan.lot_id===item.id);
    const limit=saved?.meal_count??saved?.schedule.filter(slot=>slot.percent>0).length??3;
    const supplied=(logsQuery.data??[]).filter(log=>log.lot_id===item.id&&log.date===today&&log.total_kg>0);
    return new Set(supplied.map(log=>log.shift)).size<limit;
  });
  const lot=lots.find(l=>l.id===lotId),plan=(plansQuery.data??[]).find(p=>p.lot_id===lotId);
  const effectiveDietId=plan?.diet_id??dietId;
  const targetCount=plan?.meal_count??(plan?.schedule.filter(item=>item.percent>0).length??requestedCount??(settings.data?.schedule??defaultFeedSchedule()).filter(item=>item.percent>0).length);
  const schedule=plan?.schedule??splitFeedSchedule(targetCount);
  const referenceWeight=plan?.average_weight_kg??(lot&&weightsQuery.isSuccess?computeLotMetrics(lot,weightsQuery.data??[]).currentAvgWeight:null);
  const ingredients:PlannedIngredient[]=plan?.ingredients??(itemsQuery.data??[]).filter(i=>i.diet_id===effectiveDietId).map(i=>({name:i.ingredient,bodyWeightPct:i.body_weight_pct??null,dailyKgPerHead:dietItemKg(i,referenceWeight)??NaN}));
  const daily=plan?.daily_kg_per_head??ingredients.reduce((sum,item)=>sum+item.dailyKgPerHead,0);
  const head=lot?.head_count??0,dailyTotal=plan?.daily_total_kg??daily*head;
  const logs=(logsQuery.data??[]).filter(log=>log.lot_id===lotId&&log.date===today);
  const served=(value:string)=>logs.some(log=>log.shift===value);
  const completed=new Set(logs.filter(log=>log.total_kg>0).map(log=>log.shift)).size;
  const dayComplete=completed>=targetCount;
  const suggested=portionPerHead(daily,100/targetCount);
  const kgText=override??(Number.isFinite(suggested)&&suggested>0?String(suggested).replace(".",","):"");
  const actual=Math.round((parseNumberInput(kgText)??0)*1000)/1000,provided=logs.reduce((sum,log)=>sum+log.total_kg,0);
  const portions=feedIngredientPortions(ingredients,actual);
  const catalog=stockQuery.data??{items:[],links:[]};
  const stockNeeds=feedStockNeeds(catalog,effectiveDietId,portions.map(item=>({name:item.name,totalKg:item.kgPerHead*head})),Math.round(actual*head*100)/100,plan?.stock_mapping);
  const queries=[stockQuery,lotsQuery,pensQuery,dietsQuery,itemsQuery,weightsQuery,logsQuery,plansQuery,settings];
  const ready=queries.every(query=>query.isSuccess),queryError=queries.some(query=>query.isError);
  const pending=record.isPending;
  const canRecord=ready&&stockNeeds.valid&&!stockNeeds.insufficient&&!!lot&&!!effectiveDietId&&Number.isFinite(daily)&&daily>0&&ingredients.length>0&&!!shift&&!dayComplete&&!served(shift)&&actual>0&&actual<=99999.999;
  const resetForm=()=>{
    setLotId("");setDietId("");setShift("");setRequestedCount(null);setOverride(null);setNotes("");setError(null);request.current=null;
  };
  const selectLot=(value:string)=>{
    setLotId(value);setRequestedCount(null);const selected=lots.find(l=>l.id===value),saved=(plansQuery.data??[]).find(p=>p.lot_id===value);
    setDietId(saved?.diet_id??(allDiets.find(d=>d.id===selected?.diet_id&&d.is_active)?.id??""));setOverride(null);setError(null);request.current=null;
    setShift(["manha","tarde","noite"].find(period=>!(logsQuery.data??[]).some(log=>log.lot_id===value&&log.date===today&&log.shift===period))??"manha");
  };
  const selectCard=(period:string)=>{setShift(period);setOverride(null);setError(null);};
  const submit=async()=>{
    if(!canRecord||!lot||busy.current)return;
    busy.current=true;setError(null);
    const payload={date:today,lotId:lot.id,dietId:effectiveDietId,shift,mealCount:targetCount,schedule,referenceWeight:referenceWeight??0,headCount:head,dailyKgPerHead:daily,ingredients,actualKgPerHead:actual,notes:notes.trim()||null};
    const key=JSON.stringify(payload);if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
    try{
      await record.mutateAsync({payload,requestId:request.current.id});
      request.current=null;
      const [freshLogs,freshPlans]=await Promise.all([logsQuery.refetch(),plansQuery.refetch(),stockQuery.refetch()]);
      if(freshLogs.isError||freshPlans.isError){toast.info("Trato salvo. Recarregue a página para atualizar os turnos antes de registrar outro.");setOpen(false);return;}
      const registered=(freshLogs.data??[]).filter(log=>log.lot_id===lot.id&&log.date===today&&log.total_kg>0);
      const next=new Set(registered.map(log=>log.shift)).size<targetCount?["manha","tarde","noite"].find(period=>!registered.some(log=>log.shift===period)):undefined;
      if(next){setOverride(null);setNotes("");setShift(next);toast.success("Trato registrado. Próximo turno selecionado.");}
      else {resetForm();setOpen(false);toast.success("Tratos do lote concluídos. Você já pode registrar o próximo local.");}
    }catch(cause){setError(cause instanceof Error?cause.message:t("toast.error.generic"));}finally{busy.current=false;}
  };
  const dietOptions=allDiets.filter(d=>d.is_active||d.id===plan?.diet_id).map(d=>({value:d.id,labelKey:d.id===plan?.diet_id?plan.diet_name:d.name}));
  return <Dialog open={open} onOpenChange={value=>{if(!pending&&!busy.current){if(value)resetForm();setOpen(value);if(value){void Promise.all(queries.map(q=>q.refetch()));}}}}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>{t("feed.new")}</DialogTitle></DialogHeader>
      {queryError&&<div role="alert" className="text-sm text-destructive">Não foi possível carregar o planejamento. Confira se o SQL da atualização foi instalado. <Button variant="outline" onClick={()=>void Promise.all(queries.map(q=>q.refetch()))}>Tentar novamente</Button></div>}
      {ready&&availableLots.length===0&&<p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{lots.length?"Todos os lotes com local disponível já concluíram os tratos de hoje.":"Nenhum lote ativo com local disponível para registrar trato."}</p>}
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Local e lote" value={lotId} onChange={selectLot} disabled={!ready||pending||availableLots.length===0} placeholder="Selecione o local e o lote" options={availableLots.map(l=>({value:l.id,labelKey:`${pens.find(p=>p.id===l.pen_id)?.code??"—"} · ${l.code}`}))} />
          <SelectField label={t("feed.dietUsed")} value={effectiveDietId} onChange={value=>{setDietId(value);setOverride(null);setError(null);}} options={dietOptions} disabled={!ready||!!plan} placeholder="Selecione a dieta" />
        </div>
        {lot&&<div className="rounded-lg border bg-muted/40 p-3 text-sm"><p className="font-semibold">Dia {Math.max(daysBetween(lot.system_started_on??lot.entry_date,today),0)+1} no manejo atual · {formatDate(today)}</p><p className="text-xs text-muted-foreground">Início do manejo: {formatDate(lot.system_started_on??lot.entry_date)} (dia 1). {plan?"Referência do dia fixada no primeiro trato.":"Escolha a dieta de acordo com o dia de adaptação."}</p></div>}
        <div className="grid items-end gap-3 sm:grid-cols-3">
          <LockedReference label="Peso vivo de referência" unit="kg" value={referenceWeight?formatNumber(referenceWeight,3):"—"} />
          <LockedReference label={t("field.headCount")} unit="cab." value={head?String(head):"—"} />
          <SelectField label="Quantos tratos hoje?" triggerClassName="h-10" className="[&_label]:text-xs" value={String(targetCount)} onChange={value=>{setRequestedCount(Number(value));setShift("");setOverride(null);setError(null);}} options={[{value:"1",labelKey:"1 trato"},{value:"2",labelKey:"2 tratos"},{value:"3",labelKey:"3 tratos"}]} disabled={!!plan} />
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-semibold">Qual trato está fornecendo agora?</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Período do trato atual">{["manha","tarde","noite"].map(period=>{
            const done=served(period),current=shift===period;
            return <button key={period} type="button" aria-label={`Selecionar trato: ${shiftName[period]}`} aria-pressed={current}
              onClick={()=>selectCard(period)} disabled={pending}
              className={`min-w-0 rounded-lg border px-2 py-4 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${current?"border-primary bg-primary/10 ring-1 ring-primary":"border-border hover:bg-muted/50"}`}>
              <span className="flex flex-wrap items-center justify-center gap-2 font-medium"><span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${done?"bg-green-600 dark:bg-green-400":dayComplete?"bg-muted-foreground/40":"bg-red-600 dark:bg-red-400"}`} />{shiftName[period]}</span>
              <span className="mt-2 block text-xs text-muted-foreground">{done?"Fornecido":current?"Selecionado":""}</span>
            </button>;
          })}</div>
          <p className="text-xs text-muted-foreground">{completed} de {targetCount} tratos registrados hoje. Cada trato sugere {formatNumber(100/targetCount,2)}% da quantidade diária. Escolha livremente o período.</p>
          {plan&&<p className="text-xs text-muted-foreground">A quantidade de tratos e a referência da dieta foram fixadas no primeiro registro do dia.</p>}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-live="polite">{[["Previsto no dia",dailyTotal],["Já fornecido",provided],["Restante",Math.max(0,dailyTotal-provided)]].map(([label,value])=><div key={String(label)} className="rounded-lg border bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="num font-display text-xl">{formatNumber(Number(value),2)} kg</p></div>)}</div>
        {Number.isFinite(dailyTotal)&&provided>dailyTotal&&<p className="text-sm text-warning">O fornecimento está acima da recomendação diária em {formatNumber(provided-dailyTotal,2)} kg.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col justify-center gap-1 text-sm"><p className="text-xs text-muted-foreground">Trato selecionado</p><p className="font-semibold">{shiftName[shift]??"Selecione um cartão acima"}</p></div>
          <NumericField compact label="Oferta por animal neste trato" unit="kg" value={kgText} onValueChange={setOverride} disabled={served(shift)||dayComplete} helper="Parcela deste turno; ajuste a mistura realmente fornecida. Arredondamento em 3 casas decimais." />
        </div>
        {ingredients.length>0&&<div className="space-y-2 rounded-lg border p-3 text-sm" aria-live="polite"><p className="font-semibold">Ingredientes deste trato</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[400px] text-xs"><thead><tr className="text-muted-foreground"><th className="py-2 text-left font-medium">Ingrediente</th><th className="text-right font-medium">Diário / animal</th><th className="text-right font-medium">Trato / animal</th><th className="text-right font-medium">Trato / lote</th></tr></thead><tbody>{portions.map((item,index)=><tr key={index} className="border-t"><td className="py-2">{stockItemFor(catalog,effectiveDietId,item.name,plan?.stock_mapping)?.name??item.name}{item.bodyWeightPct!==null&&<span className="block text-muted-foreground">{formatNumber(item.bodyWeightPct,4)}% PV</span>}</td><td className="text-right num">{formatNumber(item.dailyKgPerHead,3)} kg</td><td className="text-right num">{formatNumber(item.kgPerHead,3)} kg</td><td className="text-right num">{formatNumber(item.kgPerHead*head,2)} kg</td></tr>)}</tbody></table></div>
          <p className="font-semibold">Total deste trato: {formatNumber(actual*head,2)} kg no lote</p>
          <p className="text-xs text-muted-foreground">Percentuais sobre o peso vivo, sem multiplicar por matéria seca. Ao ajustar a mistura, os ingredientes são rateados mantendo a proporção da dieta.</p>
        </div>}
        {ingredients.length>0&&ready&&<section className="space-y-2 rounded-lg border p-3 text-sm" aria-live="polite"><h3 className="font-semibold">Estoque para este trato</h3>
         {stockNeeds.missing.length>0&&<p role="alert" className="text-amber-800 dark:text-amber-300">Vincule os componentes ao estoque na dieta: {stockNeeds.missing.join(", ")}. O registro ficará bloqueado até configurar.</p>}
         {stockNeeds.rows.length>0&&<div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs"><thead><tr>{["Item do estoque","Disponível","Será descontado","Saldo após"].map(label=><th key={label} className="px-2 py-2 text-center">{label}</th>)}</tr></thead><tbody>{stockNeeds.rows.map(item=><tr key={item.id} className="border-t"><td className="px-2 py-2 text-center">{item.name}</td><td className="px-2 py-2 text-center">{formatNumber(item.quantity_kg,3)} kg</td><td className="px-2 py-2 text-center font-semibold">{formatNumber(item.required,3)} kg</td><td className={`px-2 py-2 text-center ${item.shortage>0?"font-semibold text-red-700 dark:text-red-400":"text-green-700 dark:text-green-400"}`}>{item.shortage>0?`Faltam ${formatNumber(item.shortage,3)} kg`:`${formatNumber(item.remaining,3)} kg`}</td></tr>)}</tbody></table></div>}
         {stockNeeds.insufficient&&<p role="alert" className="font-semibold text-red-700 dark:text-red-400">Estoque insuficiente. Reponha os itens indicados ou ajuste a quantidade realmente fornecida.</p>}
         <p className="text-xs text-muted-foreground">A confirmação desconta os itens acima. Ração pronta é baixada como produto; os ingredientes usados para fabricá-la já foram consumidos na produção. O saldo é validado novamente ao salvar.</p>
        </section>}
        {plan&&<p className="text-xs text-muted-foreground">Referência diária: {plan.head_count} animais · {formatNumber(plan.daily_kg_per_head,3)} kg/cab/dia. O trato usa os {head} animais atuais do lote.</p>}
        {dayComplete&&<p role="status" className="text-sm">Todos os {targetCount} tratos de hoje foram registrados.</p>}
        {served(shift)&&<p role="status" className="text-sm">Este turno já foi fornecido. Confira o histórico antes de qualquer correção.</p>}
        <TextField label={t("field.notes")} value={notes} onChange={setNotes} />
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      </fieldset>
      <DialogFooter><Button variant="outline" disabled={pending} onClick={()=>setOpen(false)}>Fechar</Button><Button disabled={!canRecord||pending} onClick={()=>void submit()}>{pending?"Salvando...":dayComplete?"Dia concluído":served(shift)?"Turno já registrado":"Registrar trato"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};
