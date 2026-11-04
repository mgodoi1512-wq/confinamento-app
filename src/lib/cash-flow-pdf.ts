import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CashEntry } from "./financial-workspace";
export type CashPdfEntry=CashEntry&{lotLabel:string};
export type CashPdfData={month:string;farmName?:string;filters:string;summary:{opening:number;income:number;expenses:number;actual:number};entries:CashPdfEntry[];generatedAt?:Date;logoDataUrl?:string;fonts?:{regular:string;bold:string}};
const brown:[number,number,number]=[103,55,33],ink:[number,number,number]=[40,34,30],green:[number,number,number]=[21,114,66],red:[number,number,number]=[183,40,40],muted:[number,number,number]=[113,102,94];
const brl=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n).replace(/\u00a0/g," ");
const clean=(s:string)=>s.replace(/[\u2010-\u2015]/g,"-");
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:s;
const monthLabel=(s:string)=>new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(s+"-01T12:00:00Z"));
export function createCashFlowPdf(data:CashPdfData){
 const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true,putOnlyUsedFonts:true});
 const font=data.fonts?"LiBenSans":"helvetica";
 if(data.fonts){doc.addFileToVFS("liben-regular.ttf",data.fonts.regular);doc.addFont("liben-regular.ttf",font,"normal");doc.addFileToVFS("liben-bold.ttf",data.fonts.bold);doc.addFont("liben-bold.ttf",font,"bold");}
 doc.setProperties({title:"Fluxo de caixa - LiBen",subject:`Resumo financeiro - ${data.month}`,author:"LiBen Agronegócios",creator:"LiBen"});
 const W=210,H=297,M=14,C=W-M*2,generated=data.generatedAt??new Date(),today=generated.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}),stamp=generated.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"});
 const text=(value:string,x:number,y:number,size=9,color=ink,bold=false,align:"left"|"right"="left")=>{doc.setFont(font,bold?"bold":"normal");doc.setFontSize(size);doc.setTextColor(...color);doc.text(clean(value),x,y,{align});};
 const fitted=(value:string,x:number,y:number,width:number,size:number,color:[number,number,number],align:"left"|"right"="left")=>{doc.setFont(font,"bold");while(size>9){doc.setFontSize(size);if(doc.getTextWidth(value)<=width)break;size-=.5;}text(value,x,y,size,color,true,align);};
 const header=()=>{
  let titleX=M;
  if(data.logoDataUrl){doc.addImage(data.logoDataUrl,"PNG",M,10,16,16,undefined,"FAST");titleX=M+20;}
  text("LIBEN AGRONEGÓCIOS",titleX,14,7,brown,true);
  text("Fluxo de caixa",titleX,23,17,ink,true);
  text(monthLabel(data.month),W-M,15,9,brown,true,"right");text(`Emitido em ${stamp}`,W-M,22,7,muted,false,"right");
  doc.setFontSize(9);
  const farm=doc.splitTextToSize(clean(data.farmName||"Relatório financeiro da fazenda"),C);
  text(farm[0]??"",M,31,8,muted);
  doc.setDrawColor(...brown);doc.setLineWidth(.55);doc.line(M,35,W-M,35);
 };
 header();
 doc.setFillColor(...brown);doc.roundedRect(M,40,C,20,3,3,"F");text("SALDO REALIZADO DO MÊS",M+4,46,7,[247,231,216],true);
 fitted(brl(data.summary.actual),M+4,55,101,18,[255,255,255]);
 const change=data.summary.income-data.summary.expenses;text("MOVIMENTAÇÃO LÍQUIDA",W-M-4,46,6.5,[247,231,216],true,"right");fitted(`${change>=0?"+ ":"- "}${brl(Math.abs(change))}`,W-M-4,55,65,12,change>=0?[185,236,201]:[255,196,188],"right");
 const cards=[{label:"Saldo de abertura",value:data.summary.opening,color:ink,fill:[246,240,234]},{label:"Entradas recebidas",value:data.summary.income,color:green,fill:[237,247,241]},{label:"Saídas pagas",value:data.summary.expenses,color:red,fill:[253,239,237]}];
 const cardW=(C-8)/3;
 cards.forEach((card,index)=>{const x=M+index*(cardW+4);doc.setFillColor(card.fill[0],card.fill[1],card.fill[2]);doc.roundedRect(x,63,cardW,16,2,2,"F");text(card.label,x+3,68.5,7,muted);fitted(brl(card.value),x+3,75.5,cardW-6,12,card.color as [number,number,number]);});
 text("Resumo mensal de toda a fazenda. A tabela abaixo segue os filtros da consulta.",M,83,7,muted);
 text("Movimentação do período",M,90,9,ink,true);
 doc.setFillColor(249,247,244);doc.roundedRect(M,93,C,18,2,2,"F");
 const max=Math.max(data.summary.income,data.summary.expenses,1);
 [{label:"Entradas recebidas",value:data.summary.income,color:green},{label:"Saídas pagas",value:data.summary.expenses,color:red}].forEach((bar,index)=>{const y=99.5+index*7;text(bar.label,M+4,y,8,muted);doc.setFillColor(233,226,218);doc.roundedRect(67,y-2.5,78,3,1,1,"F");if(bar.value>0){doc.setFillColor(...bar.color);doc.roundedRect(67,y-2.5,Math.max(.6,78*bar.value/max),3,Math.min(1,78*bar.value/max/2),1,"F");}text(brl(bar.value),W-M-4,y,9,bar.color,true,"right");});
 text("Lançamentos da consulta",M,119,10,ink,true);text(`${data.entries.length} registro(s)`,W-M,119,8,muted,false,"right");
 doc.setFont(font,"normal");doc.setFontSize(7.5);
 const filterLines=doc.splitTextToSize(clean(data.filters),C);let y=124;
 for(const line of filterLines){if(y>270){doc.addPage();header();y=41;}text(line,M,y,7.5,muted);y+=3.5;}
 if(y>253){doc.addPage();header();y=41;}
 const body=data.entries.map(e=>[
  `${date(e.due_date)}\n${e.settled_on?`Realizado ${date(e.settled_on)}`:"Ainda não realizado"}`,
  [e.description,[e.category,e.lotLabel?`Lote: ${e.lotLabel}`:""].filter(Boolean).join(" · "),e.notes?`Obs.: ${e.notes}`:""].filter(Boolean).map(clean).join("\n"),
  e.settled_on?(e.direction==="entrada"?"Recebido":"Pago"):(e.due_date<today?"Em atraso":"Pendente"),
  `${e.direction==="entrada"?"+":"-"} ${brl(e.amount)}`,
 ]);
 autoTable(doc,{startY:y+3,head:[["Data / realização","Lançamento e observações","Situação","Valor"]],body:body.length?body:[["-","Nenhum lançamento nesta consulta.","-","-"]],theme:"plain",margin:{left:M,right:M,top:41,bottom:16},rowPageBreak:"avoid",styles:{font,fontSize:8.2,textColor:ink,cellPadding:2,lineColor:[232,224,216],lineWidth:{bottom:.2},overflow:"linebreak"},headStyles:{fillColor:brown,textColor:[255,255,255],fontStyle:"bold",fontSize:8.3},alternateRowStyles:{fillColor:[249,247,244]},columnStyles:{0:{cellWidth:29,fontSize:7.6},1:{cellWidth:88},2:{cellWidth:24,halign:"center",valign:"middle",fontSize:8},3:{cellWidth:41,halign:"right",valign:"middle",fontStyle:"bold",fontSize:9}},didParseCell:cell=>{if(cell.section==="body"&&data.entries[cell.row.index]){const e=data.entries[cell.row.index];if(cell.column.index===3)cell.cell.styles.textColor=e.direction==="entrada"?green:red;if(cell.column.index===2){cell.cell.styles.textColor=e.settled_on?green:[148,86,16];cell.cell.styles.fontStyle="bold";}}},didDrawPage:page=>{if(page.pageNumber>1)header();}});
 for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);doc.setDrawColor(225,216,207);doc.setLineWidth(.2);doc.line(M,H-14,W-M,H-14);text("LiBen Agronegócios | Controle financeiro",M,H-9,7,muted);text(`Página ${i} de ${doc.getNumberOfPages()}`,W-M,H-9,7,muted,false,"right");}
 return doc;
}
