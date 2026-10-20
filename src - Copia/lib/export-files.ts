import type { ExportReport } from "./export-data";
import { formatNumber, todayIso } from "./format";

const filename = (report: ExportReport, extension: string) =>
  `liben-${report.filename.replace(/[^a-z0-9-]/gi, "-")}-${todayIso()}.${extension}`;

export async function exportExcel(report: ExportReport) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LiBen Agronegócios";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Dados", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = report.columns.map((column, index) => ({
    header: column.title, key: String(index), width: Math.max(16, Math.min(column.title.length + 3, 30)),
    style: column.decimals === undefined ? { numFmt: "@" } : { numFmt: column.decimals ? `#,##0.${"0".repeat(column.decimals)}` : "#,##0" },
  }));
  for (const row of report.rows) sheet.addRow(row);
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF653B27" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.getRow(1).height = 34;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: report.rows.length + 1, column: report.columns.length } };
  const info = workbook.addWorksheet("Informações");
  info.columns = [{ width: 24 }, { width: 110 }];
  info.addRows([
    ["Relatório", report.title], ["Emitido em", new Date().toLocaleString("pt-BR")],
    ["Filtros", report.filters], ["Registros", report.rows.length], ["Observações", report.note],
  ]);
  info.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  info.getRow(3).height = 48;
  info.getRow(5).height = 72;
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename(report, "xlsx");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportPdf(report: ExportReport) {
  if (report.feedingSuggestion) {
    const { buildFeedingSuggestionPdf } = await import("./feed-suggestion-pdf");
    const base = import.meta.env?.BASE_URL ?? "/";
    const files = await Promise.all(["logo-liben-2.png", "fonts/liben-report-regular.ttf", "fonts/liben-report-bold.ttf"].map(async file => {
      const response = await fetch(`${base}${file}`);
      if (!response.ok) throw new Error("Não foi possível carregar a logo ou as fontes do relatório.");
      return new Uint8Array(await response.arrayBuffer());
    }));
    const data = report.feedingSuggestion;
    buildFeedingSuggestionPdf(data.suggestions, data.farmName, data.date, files[0], { regular: files[1], bold: files[2] }).save(filename(report, "pdf"));
    return;
  }
  if (report.adaptation) {
    const { buildAdaptationPdf } = await import("./adaptation-pdf");
    const response = await fetch(`${import.meta.env?.BASE_URL ?? "/"}logo-liben-2.png`);
    if (!response.ok) throw new Error("Não foi possível carregar a logo do relatório.");
    const fontBytes = await Promise.all(["regular", "bold"].map(async style => {
      const font = await fetch(`${import.meta.env?.BASE_URL ?? "/"}fonts/liben-report-${style}.ttf`);
      if (!font.ok) throw new Error("Não foi possível carregar a fonte do relatório.");
      return new Uint8Array(await font.arrayBuffer());
    }));
    const doc = buildAdaptationPdf(report.adaptation.input, report.adaptation.lotName, new Uint8Array(await response.arrayBuffer()), undefined, { regular: fontBytes[0], bold: fontBytes[1] });
    doc.save(filename(report, "pdf"));
    return;
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", format: report.pdf?.format ?? "a3", compress: !!report.pdf?.embeddedFont });
  const width = doc.internal.pageSize.getWidth();
  let reportFont="helvetica";
  if(report.pdf?.embeddedFont){
    const toBase64=(bytes:Uint8Array)=>{
      let text="";for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return btoa(text);
    };
    const fonts=await Promise.all(["regular","bold"].map(async style=>{
      const response=await fetch(`${import.meta.env?.BASE_URL??"/"}fonts/liben-report-${style}.ttf`);
      if(!response.ok)throw new Error("Não foi possível carregar a fonte do relatório.");
      return {style,bytes:new Uint8Array(await response.arrayBuffer())};
    }));
    for(const font of fonts){
      const name=`liben-report-${font.style}.ttf`;
      doc.addFileToVFS(name,toBase64(font.bytes));doc.addFont(name,"liben",font.style==="regular"?"normal":"bold");
    }
    reportFont="liben";
  }
  const logoResponse = await fetch(`${import.meta.env?.BASE_URL ?? "/"}logo-liben-2.png`);
  if (!logoResponse.ok) throw new Error("Não foi possível carregar a logo do relatório.");
  const logo = new Uint8Array(await logoResponse.arrayBuffer());
  const image = doc.getImageProperties(logo);
  const compact=!!report.pdf?.compactHeader;
  const logoSize = compact?20:26;
  const scale = Math.min(logoSize / image.width, logoSize / image.height);
  const logoWidth = image.width * scale;
  const logoHeight = image.height * scale;
  const emittedAt=new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"});
  const drawCompactHeader=()=>{
    doc.setTextColor(0);
    doc.addImage(logo,"PNG",12+(logoSize-logoWidth)/2,8+(logoSize-logoHeight)/2,logoWidth,logoHeight);
    doc.setFont(reportFont,"bold");doc.setFontSize(15);doc.text(report.title,36,14);
    doc.setFont(reportFont,"normal");doc.setFontSize(10);
    if(report.farmName)doc.text(doc.splitTextToSize(report.farmName,width-50).slice(0,2),36,21);
    doc.setFontSize(8);doc.text(`Emitido em ${emittedAt} | ${report.recordCount??report.rows.length} registros`,36,29);
  };
  let tableStart:number;
  if(compact){
    drawCompactHeader();doc.setFontSize(8);
    const filters=doc.splitTextToSize(`Filtros: ${report.filters}`,width-24);doc.text(filters,12,36);
    tableStart=36+filters.length*3.5+3;
    if(report.pdf?.summary){doc.setTextColor(137,81,32);doc.text(report.pdf.summary,12,tableStart);doc.setTextColor(0);tableStart+=5;}
  }else{
    doc.addImage(logo, "PNG", 12 + (logoSize - logoWidth) / 2, 10 + (logoSize - logoHeight) / 2, logoWidth, logoHeight);
    doc.setFont(reportFont, "bold");doc.setFontSize(17);doc.text(report.title,44,21);
    doc.setFont(reportFont,"normal");doc.setFontSize(9);
    doc.text(`Emitido em ${emittedAt} | ${report.recordCount??report.rows.length} registros`,44,29);
    const filterLines=doc.splitTextToSize(`Filtros: ${report.filters}`,width-24);doc.text(filterLines,12,43);
    const noteLines=doc.splitTextToSize(report.note,width-24);const noteY=45+filterLines.length*4;doc.text(noteLines,12,noteY);
    tableStart=noteY+noteLines.length*4+4;
  }
  autoTable(doc, {
    startY: tableStart,
    showHead:"everyPage",
    didDrawPage: data=>{if(compact&&data.pageNumber>1)drawCompactHeader();},
    head: [report.columns.map(column => column.title)],
    body: report.rows.map(row => row.map((value, index) => typeof value === "number" ? formatNumber(value, report.columns[index].decimals ?? 1) : value ?? "—")),
    margin: { top: compact?34:12, right: 12, bottom: compact?28:16, left: 12 },
    styles: { font: reportFont, fontSize: report.pdf?.fontSize ?? 8, cellPadding: compact?1.8:2, overflow: "linebreak" },
    headStyles: { fillColor: [101, 59, 39], ...(report.pdf?.centerColumns ? { halign: "center" as const } : {}) },
    alternateRowStyles: { fillColor: [247, 242, 237] },
    rowPageBreak: "avoid",
    columnStyles: Object.fromEntries(report.columns.map((column,index)=>[index, {
      ...(report.pdf?.centerColumns ? {halign:"center" as const} : column.decimals===undefined ? {} : {halign:"right" as const}),
      ...(report.pdf?.columnWidths?.[index] ? {cellWidth:report.pdf.columnWidths[index]} : {}),
    }])) ,
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if(compact){doc.setFont(reportFont,"normal");doc.setFontSize(7.5);doc.setTextColor(90);const notes=doc.splitTextToSize(report.note,width-24);doc.text(notes,12,doc.internal.pageSize.getHeight()-21);doc.setTextColor(0);}
    doc.setFontSize(8);
    doc.text(`LiBen Agronegócios | Página ${page} de ${pages}`, width - 12, doc.internal.pageSize.getHeight() - 7, { align: "right" });
  }
  doc.save(filename(report, "pdf"));
}
