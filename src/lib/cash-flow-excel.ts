import ExcelJS from "exceljs";
import type {ExportReport} from "./export-data";
export function createCashFlowWorkbook(report:ExportReport){
 const book=new ExcelJS.Workbook();book.creator="LiBen Agronegócios";
    if(report.cashRange&&report.cashRange.group!=="nenhum"){
      const range=report.cashRange,summary=book.addWorksheet("Resumo por intervalo",{pageSetup:{orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
      summary.mergeCells(1,1,1,7);summary.getCell(1,1).value=`${report.title} - resumo por ${range.group==="semana"?"semana":"mês"}`;summary.getCell(1,1).font={size:18,bold:true,color:{argb:"FF673721"}};
      summary.mergeCells(2,1,2,7);summary.getCell(2,1).value=report.filters??"";summary.getCell(2,1).alignment={wrapText:true,vertical:"middle"};summary.getRow(2).height=32;
      summary.mergeCells(3,1,3,7);summary.getCell(3,1).value=report.note??"";summary.getCell(3,1).alignment={wrapText:true,vertical:"middle"};summary.getRow(3).height=64;
      const head=summary.getRow(5);head.values=["Intervalo","Entradas recebidas (R$)","Saídas pagas (R$)","Saldo do intervalo (R$)","A receber (R$)","A pagar (R$)","Saldo realizado no fim (R$)"];head.height=30;
      head.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF673721"}};c.font={bold:true,color:{argb:"FFFFFFFF"}};c.alignment={vertical:"middle",wrapText:true};});
      summary.addRow(["Saldo de abertura",null,null,null,null,null,range.opening]).font={italic:true};
      range.intervals.forEach((item,index)=>{const row=summary.addRow([item.label,item.income,item.expenses,item.net,item.receivable,item.payable,item.balanceEnd]);if(index%2===0)row.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF7F2ED"}};});row.getCell(2).font={color:{argb:"FF157242"}};row.getCell(3).font={color:{argb:"FFB72828"}};});
      const totals=summary.addRow(["Total do período",range.income,range.expenses,range.net,range.receivable,range.payable,range.closing]);totals.font={bold:true};totals.eachCell(c=>{c.border={top:{style:"thin"}};});
      summary.getColumn(1).width=30;for(let col=2;col<=7;col++){summary.getColumn(col).width=21;summary.getColumn(col).numFmt="#,##0.00";}
      summary.views=[{state:"frozen",ySplit:5}];
    }
    const sheet=book.addWorksheet("Fluxo de caixa",{pageSetup:{orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
    sheet.mergeCells(1,1,1,report.columns.length);sheet.getCell(1,1).value=report.title;sheet.getCell(1,1).font={size:18,bold:true,color:{argb:"FF673721"}};
    for(const [row,value]of [[2,report.filters??""],[3,report.note??""]] as const){sheet.mergeCells(row,1,row,report.columns.length);sheet.getCell(row,1).value=value;sheet.getCell(row,1).alignment={wrapText:true,vertical:"middle"};sheet.getRow(row).height=row===3?48:32;}
    const header=sheet.getRow(5);header.values=report.columns.map(c=>c.title);header.height=26;header.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF673721"}};c.font={bold:true,color:{argb:"FFFFFFFF"}};c.alignment={vertical:"middle",wrapText:true};});
    report.rows.forEach((values,index)=>{const row=sheet.addRow(values);row.alignment={vertical:"top",wrapText:true};if(index%2===0)row.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF7F2ED"}};});const color=values[5]==="Saída"?"FFB72828":"FF157242";row.getCell(7).font={color:{argb:color},bold:true};});
    report.columns.forEach((col,index)=>{sheet.getColumn(index+1).width=index===2||index===8?42:19;if(typeof col.decimals==="number")sheet.getColumn(index+1).numFmt=col.decimals?`#,##0.${"0".repeat(col.decimals)}`:"#,##0";});
    sheet.views=[{state:"frozen",ySplit:5}];sheet.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,5+report.rows.length),column:report.columns.length}};
 return book;
}
