import {useState} from "react";
import {Download,FileSpreadsheet} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {supabase} from "@/integrations/supabase/client";
import {todayIso} from "@/lib/format";
import type {ExportReport} from "@/lib/export-data";
import type {CashPdfData} from "@/lib/cash-flow-pdf";
async function logoData(){try{const response=await fetch("/assets/liben-cash-report-logo.png");if(!response.ok)return undefined;const blob=await response.blob();return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Logo indisponível"));reader.readAsDataURL(blob);});}catch{return undefined;}}
async function reportFonts(){const read=async(name:string)=>{const r=await fetch(`/assets/cash-report-fonts/${name}.ttf`);if(!r.ok)throw new Error("Não foi possível carregar a fonte do relatório. Confira os arquivos da atualização.");const bytes=new Uint8Array(await r.arrayBuffer());let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);};const[regular,bold]=await Promise.all([read("regular"),read("bold")]);return{regular,bold};}
export function CashFlowExportButtons({getReport,getData,farmId}:{getReport:()=>ExportReport;getData:()=>CashPdfData;farmId:string}){
 const[busy,setBusy]=useState<"pdf"|"excel"|null>(null);
 const run=async(kind:"pdf"|"excel")=>{
  if(busy)return;setBusy(kind);
  try{
   const report=getReport();
   if(kind==="pdf"){
    const data=getData();
    const [{createCashFlowPdf},logo,fonts,farm]=await Promise.all([import("@/lib/cash-flow-pdf"),logoData(),reportFonts(),supabase.from("farms").select("name").eq("id",farmId).maybeSingle()]);
    createCashFlowPdf({...data,fonts,logoDataUrl:logo,farmName:farm.data?.name??undefined}).save(`liben-${report.filename}-${todayIso()}.pdf`);
   }else{
    const {createCashFlowWorkbook}=await import("@/lib/cash-flow-excel");const book=createCashFlowWorkbook(report);
    const bytes=await book.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})),a=document.createElement("a");a.href=url;a.download=`liben-${report.filename}-${todayIso()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   }
  }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível exportar o relatório.");}finally{setBusy(null);}
 };
 return <><Button variant="outline" disabled={!!busy} onClick={()=>void run("pdf")}><Download className="size-4"/>{busy==="pdf"?"Gerando PDF…":"Exportar PDF"}</Button><Button variant="outline" disabled={!!busy} onClick={()=>void run("excel")}><FileSpreadsheet className="size-4"/>{busy==="excel"?"Gerando Excel…":"Exportar Excel"}</Button></>;
}
