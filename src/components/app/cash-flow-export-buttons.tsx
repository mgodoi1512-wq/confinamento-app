import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from "@/components/ui/dropdown-menu";
import {useState} from "react";
import {Download,FileSpreadsheet,ChevronDown,FileDown,CalendarRange} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {supabase} from "@/integrations/supabase/client";
import {todayIso} from "@/lib/format";
import {isNativeApp,savePdf,shareFileNative} from "@/lib/native-share";
import type {ExportReport} from "@/lib/export-data";
import type {CashPdfData} from "@/lib/cash-flow-pdf";
import type {CashEntry,WorkspaceSettings} from "@/lib/financial-workspace";
import {buildCashFlowRange,checkRange,type RangeGroup} from "@/lib/cash-flow-range";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import {DateField} from "@/components/form/date-field";
import {SelectField} from "@/components/form/select-field";
async function logoData(){try{const response=await fetch("/assets/liben-cash-report-logo.png");if(!response.ok)return undefined;const blob=await response.blob();return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Logo indisponível"));reader.readAsDataURL(blob);});}catch{return undefined;}}
async function reportFonts(){const read=async(name:string)=>{const r=await fetch(`/assets/cash-report-fonts/${name}.ttf`);if(!r.ok)throw new Error("Não foi possível carregar a fonte do relatório. Confira os arquivos da atualização.");const bytes=new Uint8Array(await r.arrayBuffer());let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);};const[regular,bold]=await Promise.all([read("regular"),read("bold")]);return{regular,bold};}
export type CashRangeSource={entries:CashEntry[];settings:WorkspaceSettings|null;lotName:(id:string|null)=>string;month:string};
const endOfMonth=(month:string)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
type Source={report:ExportReport;data:CashPdfData};
export function CashFlowExportButtons({getReport,getData,getRangeSource,farmId}:{getReport:()=>ExportReport;getData:()=>CashPdfData;getRangeSource?:()=>CashRangeSource;farmId:string}){
 const[busy,setBusy]=useState<"pdf"|"excel"|null>(null);
 const[open,setOpen]=useState(false),[from,setFrom]=useState(""),[to,setTo]=useState(""),[group,setGroup]=useState<RangeGroup>("semana");
 const deliverPdf=async(report:ExportReport,data:CashPdfData)=>{
  const [{createCashFlowPdf},logo,fonts,farm]=await Promise.all([import("@/lib/cash-flow-pdf"),logoData(),reportFonts(),supabase.from("farms").select("name").eq("id",farmId).maybeSingle()]);
  await savePdf(createCashFlowPdf({...data,fonts,logoDataUrl:logo,farmName:farm.data?.name??undefined}),`liben-${report.filename}-${todayIso()}.pdf`);
 };
 const deliverExcel=async(report:ExportReport)=>{
  const {createCashFlowWorkbook}=await import("@/lib/cash-flow-excel");const book=createCashFlowWorkbook(report);
  const bytes=await book.xlsx.writeBuffer();
  if(isNativeApp()){await shareFileNative(`liben-${report.filename}-${todayIso()}.xlsx`,new Uint8Array(bytes as ArrayBuffer));return;}
  const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})),a=document.createElement("a");a.href=url;a.download=`liben-${report.filename}-${todayIso()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 /** Gera o arquivo escolhido; devolve true quando terminou sem erro. */
 const execute=async(kind:"pdf"|"excel",source:()=>Source):Promise<boolean>=>{
  if(busy)return false;setBusy(kind);
  try{
   const {report,data}=source();
   if(kind==="pdf")await deliverPdf(report,data);else await deliverExcel(report);
   return true;
  }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível exportar o relatório.");return false;}finally{setBusy(null);}
 };
 const run=(kind:"pdf"|"excel")=>void execute(kind,()=>({report:getReport(),data:getData()}));
 const openRange=()=>{const month=getRangeSource?.().month??todayIso().slice(0,7);setFrom(`${month}-01`);setTo(endOfMonth(month));setGroup("semana");setOpen(true);};
 const problem=open?checkRange(from,to):null;
 const runRange=async(kind:"pdf"|"excel")=>{
  const source=getRangeSource?.();if(!source||checkRange(from,to))return;
  const done=await execute(kind,()=>{const built=buildCashFlowRange(source.entries,source.settings,{from,to,group},{lotName:source.lotName});return {report:built.report,data:built.pdf};});
  if(done)setOpen(false);
 };
 return <>
  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={!!busy}><Download className="size-4"/>{busy?"Exportando…":"Exportar"}<ChevronDown className="size-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!!busy} onSelect={()=>run("pdf")}><FileDown className="mr-2 size-4"/>Exportar PDF</DropdownMenuItem><DropdownMenuItem disabled={!!busy} onSelect={()=>run("excel")}><FileSpreadsheet className="mr-2 size-4"/>Exportar Excel</DropdownMenuItem>{getRangeSource&&<DropdownMenuItem disabled={!!busy} onSelect={()=>{window.setTimeout(openRange,0);}}><CalendarRange className="mr-2 size-4"/>Exportar período com intervalos…</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
  <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Exportar período com intervalos</DialogTitle><DialogDescription>Escolha a data inicial e a final. O relatório traz a lista de lançamentos e, se quiser, subtotais por semana ou por mês, considerando toda a fazenda.</DialogDescription></DialogHeader>
   <div className="grid gap-3 sm:grid-cols-2"><DateField label="Data inicial" value={from} onChange={setFrom}/><DateField label="Data final" value={to} onChange={setTo}/></div>
   <SelectField label="Subtotais por" value={group} onChange={value=>setGroup(value==="mes"?"mes":value==="nenhum"?"nenhum":"semana")} options={[{value:"semana",labelKey:"Semana"},{value:"mes",labelKey:"Mês"},{value:"nenhum",labelKey:"Sem subtotais"}]}/>
   {problem&&<p role="alert" className="text-sm text-destructive">{problem}</p>}
   <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={!!busy||!!problem} onClick={()=>void runRange("excel")}><FileSpreadsheet className="mr-2 size-4"/>{busy==="excel"?"Gerando…":"Exportar Excel"}</Button><Button disabled={!!busy||!!problem} onClick={()=>void runRange("pdf")}><FileDown className="mr-2 size-4"/>{busy==="pdf"?"Gerando…":"Exportar PDF"}</Button></div>
  </DialogContent></Dialog>
 </>;
}
