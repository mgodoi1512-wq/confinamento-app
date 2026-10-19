import ExcelJS from "exceljs";
import type {ExportReport} from "./export-data";
export function createCashFlowWorkbook(report:ExportReport){
 const book=new ExcelJS.Workbook();book.creator="LiBen Agronegócios";
    const sheet=book.addWorksheet("Fluxo de caixa",{pageSetup:{orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
    sheet.mergeCells(1,1,1,report.columns.length);sheet.getCell(1,1).value=report.title;sheet.getCell(1,1).font={size:18,bold:true,color:{argb:"FF673721"}};
    for(const [row,value]of [[2,report.filters??""],[3,report.note??""]] as const){sheet.mergeCells(row,1,row,report.columns.length);sheet.getCell(row,1).value=value;sheet.getCell(row,1).alignment={wrapText:true,vertical:"middle"};sheet.getRow(row).height=row===3?48:32;}
    const header=sheet.getRow(5);header.values=report.columns.map(c=>c.title);header.height=26;header.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF673721"}};c.font={bold:true,color:{argb:"FFFFFFFF"}};c.alignment={vertical:"middle",wrapText:true};});
    report.rows.forEach((values,index)=>{const row=sheet.addRow(values);row.alignment={vertical:"top",wrapText:true};if(index%2===0)row.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF7F2ED"}};});const color=values[5]==="Saída"?"FFB72828":"FF157242";row.getCell(7).font={color:{argb:color},bold:true};});
    report.columns.forEach((col,index)=>{sheet.getColumn(index+1).width=index===2||index===8?42:19;if(typeof col.decimals==="number")sheet.getColumn(index+1).numFmt=col.decimals?`#,##0.${"0".repeat(col.decimals)}`:"#,##0";});
    sheet.views=[{state:"frozen",ySplit:5}];sheet.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,5+report.rows.length),column:report.columns.length}};
 return book;
}
