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
  const logoSize = 26;
  const scale = Math.min(logoSize / image.width, logoSize / image.height);
  const logoWidth = image.width * scale;
  const logoHeight = image.height * scale;
  doc.addImage(logo, "PNG", 12 + (logoSize - logoWidth) / 2, 10 + (logoSize - logoHeight) / 2, logoWidth, logoHeight);
  doc.setFont(reportFont, "bold");
  doc.setFontSize(17);
  doc.text(report.title, 44, 21);
  doc.setFont(reportFont, "normal");
  doc.setFontSize(9);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")} | ${report.recordCount??report.rows.length} registros`, 44, 29);
  const filterLines = doc.splitTextToSize(`Filtros: ${report.filters}`, width - 24);
  doc.text(filterLines, 12, 43);
  const noteLines = doc.splitTextToSize(report.note, width - 24);
  const noteY = 45 + filterLines.length * 4;
  doc.text(noteLines, 12, noteY);
  autoTable(doc, {
    startY: noteY + noteLines.length * 4 + 4,
    head: [report.columns.map(column => column.title)],
    body: report.rows.map(row => row.map((value, index) => typeof value === "number" ? formatNumber(value, report.columns[index].decimals ?? 1) : value ?? "—")),
    margin: { top: 12, right: 12, bottom: 16, left: 12 },
    styles: { font: reportFont, fontSize: report.pdf?.fontSize ?? 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [101, 59, 39] },
    alternateRowStyles: { fillColor: [247, 242, 237] },
    rowPageBreak: "avoid",
    columnStyles: Object.fromEntries(report.columns.map((column,index)=>[index, {
      ...(column.decimals===undefined?{}:{halign:"right" as const}),
      ...(report.pdf?.columnWidths?.[index] ? {cellWidth:report.pdf.columnWidths[index]} : {}),
    }])) ,
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`LiBen Agronegócios | Página ${page} de ${pages}`, width - 12, doc.internal.pageSize.getHeight() - 7, { align: "right" });
  }
  doc.save(filename(report, "pdf"));
}
