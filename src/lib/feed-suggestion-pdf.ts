import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { FeedingSuggestion } from "./feed-suggestion";
import { formatDate, formatNumber } from "./format";

type Color = [number, number, number];
const brown: Color = [101, 59, 39], ink: Color = [44, 40, 35], muted: Color = [112, 105, 96];
const cream: Color = [248, 245, 240], green: Color = [48, 112, 77], orange: Color = [181, 104, 43];
type Fonts = { regular: Uint8Array; bold: Uint8Array };

/** Apresentação dos valores já calculados; não desconta nem grava tratos. */
export function buildFeedingSuggestionPdf(suggestions: FeedingSuggestion[], farmName: string, date: string, logo: Uint8Array, fonts: Fonts) {
  const doc = new jsPDF({ orientation: "landscape", format: "a4", compress: true });
  for (const [style, bytes] of Object.entries(fonts)) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const file = `feeding-${style}.ttf`;
    doc.addFileToVFS(file, btoa(binary)); doc.addFont(file, "liben", style === "regular" ? "normal" : "bold");
  }
  const width = doc.internal.pageSize.getWidth(), margin = 12, usable = width - 2 * margin;
  const valid = suggestions.filter(item => !item.issue);
  const feed = valid.reduce((s, item) => s + (item.feedDaily ?? 0), 0);
  const roughage = valid.reduce((s, item) => s + (item.roughageDaily ?? 0), 0);
  const meals = [0, 1, 2].map(i => ({ feed: valid.reduce((s, item) => s + (item.meals[i]?.feedKg ?? 0), 0), roughage: valid.reduce((s, item) => s + (item.meals[i]?.roughageKg ?? 0), 0) }));
  const head = valid.reduce((s, item) => s + item.head, 0);
  const kg = (value: number) => `${formatNumber(value, 2)} kg`;
  const pair = (a: number | null, b: number | null) => a === null || b === null ? "-" : `R: ${kg(a)}\nV: ${kg(b)}`;
  const text = (value: string, x: number, y: number, size = 9, color: Color = ink, bold = false, maxWidth?: number) => {
    doc.setFont("liben", bold ? "bold" : "normal"); doc.setTextColor(...color); doc.setFontSize(size);
    if (maxWidth && doc.getTextWidth(value) > maxWidth) doc.setFontSize(Math.max(6, size * maxWidth / doc.getTextWidth(value)));
    doc.text(value, x, y);
  };
  const box = (x: number, y: number, w: number, h: number, color: Color = cream) => { doc.setFillColor(...color); doc.roundedRect(x, y, w, h, 2, 2, "F"); };
  const header = (continuation = false) => {
    doc.setFillColor(...brown); doc.rect(0, 0, width, 2, "F");
    if (!continuation) {
      const properties = doc.getImageProperties(logo), scale = Math.min(22 / properties.width, 22 / properties.height);
      doc.addImage(logo, "PNG", margin, 7, properties.width * scale, properties.height * scale);
      text("ROTINA DE ALIMENTAÇÃO", 39, 12, 8, brown, true);
      text("Sugestão diária de trato", 39, 21, 17, ink, true);
      text(farmName, 39, 29, 9, muted, false, 173);
      text(formatDate(date), width - 55, 16, 15, brown, true);
      text("3 REFEIÇÕES POR DIA", width - 55, 24, 7, muted, true);
    } else {
      text("Sugestão diária de trato | Continuação", margin, 12, 12, brown, true);
      text(`${farmName} | ${formatDate(date)}`, margin, 20, 8, muted, false, usable);
    }
  };
  header();
  const metricW = (usable - 12) / 4;
  [["LOTES VÁLIDOS", `${valid.length} de ${suggestions.length}`], ["ANIMAIS (LOTES VÁLIDOS)", formatNumber(head, 0)], ["RAÇÃO NO DIA", kg(feed)], ["VOLUMOSO NO DIA", kg(roughage)]].forEach(([label, value], i) => {
    const x = margin + i * (metricW + 4); box(x, 35, metricW, 17);
    text(label, x + 4, 41, 7, muted, true); text(value, x + 4, 50, 15, i === 2 ? orange : i === 3 ? green : brown, true, metricW - 8);
  });
  const mealW = (usable - 8) / 3;
  ["MANHÃ", "TARDE", "NOITE"].forEach((period, i) => {
    const x = margin + i * (mealW + 4), entry = meals[i]; box(x, 55, mealW, 21);
    doc.setFillColor(...brown); doc.roundedRect(x, 55, 1.3, 21, 0.6, 0.6, "F");
    text(period, x + 5, 61, 8, brown, true);
    text(`Ração ${kg(entry.feed)}`, x + 5, 68, 11, orange, true, mealW - 10);
    text(`Volumoso ${kg(entry.roughage)}`, x + 5, 74, 10, green, false, mealW - 10);
  });
  text("Distribuição por curral e lote", margin, 84, 10, brown, true);
  text("R = ração | V = volumoso | Quantidades em kg por lote", 151, 84, 7, muted);
  const rows = suggestions.map(item => [
    `${item.penCode}\n${item.lotCode}`,
    item.issue ? `REVISAR\n${item.issue}` : `Dia ${item.day}\n${item.phase?.label ?? "Revisar"}`,
    `${Number.isFinite(item.head) ? formatNumber(item.head, 0) : "-"} animais\n${item.weight === null ? "-" : `${formatNumber(item.weight, 2)} kg/cab`}`,
    item.phase ? `R: ${formatNumber(item.phase.feedPct, 1)}%\nV: ${formatNumber(item.phase.roughagePct, 1)}%` : "-",
    item.issue ? "-" : pair(item.feedDaily, item.roughageDaily),
    ...[0, 1, 2].map(i => !item.issue && item.meals[i] ? pair(item.meals[i].feedKg, item.meals[i].roughageKg) : "-"),
  ]);
  autoTable(doc, {
    startY: 88, margin: { left: margin, right: margin, top: 28, bottom: 27 },
    head: [["Curral / Lote", "Dia no cocho\nEtapa", "Animais\nPeso médio", "% peso vivo\nRação / Volumoso", "Total diário\nRação / Volumoso", "Manhã\nRação / Volumoso", "Tarde\nRação / Volumoso", "Noite\nRação / Volumoso"]],
    body: rows,
    foot: [["TOTAL VÁLIDO", `${valid.length} lotes`, `${formatNumber(head, 0)} animais`, "-", pair(feed, roughage), ...meals.map(m => pair(m.feed, m.roughage))]],
    showFoot: "lastPage", rowPageBreak: "avoid", styles: { font: "liben", fontSize: 7.4, cellPadding: 0.9, halign: "center", valign: "middle", textColor: ink, lineColor: [235, 229, 221], lineWidth: 0.1 },
    headStyles: { fillColor: brown, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: [235, 225, 214], textColor: brown, fontStyle: "bold" }, alternateRowStyles: { fillColor: cream },
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 29 }, 2: { cellWidth: 28 }, 3: { cellWidth: 29 } },
    didParseCell(data) {
      if (data.section === "body" && suggestions[data.row.index]?.issue) { data.cell.styles.fillColor = [255, 239, 224]; if (data.column.index === 1) data.cell.styles.textColor = [147, 65, 27]; }
    },
    didDrawPage(data) { if (data.pageNumber > 1) header(true); },
  });
  const notes = [
    "Sugestão pela grade fixa de adaptação. Não desconta tratos registrados e não altera os planos salvos.",
    "Peso da última pesagem; sem pesagem, usa a média de entrada. O dia da entrada conta como dia 1.",
    "Três refeições equivalentes; diferenças de centavos de kg são ajustadas à noite.",
    valid.length < suggestions.length ? `${suggestions.length - valid.length} lote(s) com pendências destacados. Os totais incluem apenas lotes válidos.` : "Confira a referência e as quantidades antes do fornecimento.",
  ];
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    notes.forEach((note, i) => text(note, margin, 188 + i * 3.2, 6.5, i === 3 && valid.length < suggestions.length ? orange : muted, i === 3, usable));
    text("LiBen Agronegócios | Planejamento de fornecimento", margin, 205, 7, muted);
    text(`${page} / ${count}`, width - 22, 205, 7, muted);
  }
  return doc;
}
