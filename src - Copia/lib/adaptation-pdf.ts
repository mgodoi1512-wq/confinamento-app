import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { computeAdaptation, type AdaptationInput } from "./adaptation";
import { formatDate, formatNumber } from "./format";

type Color = [number, number, number];
const brown: Color = [101, 59, 39], green: Color = [47, 112, 78], orange: Color = [190, 112, 49];
const ink: Color = [43, 39, 34], muted: Color = [110, 105, 98], cream: Color = [248, 245, 240];
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/** PDF visual da adaptação. Usa exatamente o mesmo cálculo do formulário. */
export function buildAdaptationPdf(input: AdaptationInput, lotName: string, logo: Uint8Array, issued = new Date(), fonts?: { regular: Uint8Array; bold: Uint8Array }) {
  const result = computeAdaptation(input);
  const doc = new jsPDF({ orientation: "landscape", format: "a4", compress: true });
  let font = "helvetica";
  if (fonts) {
    for (const [style, bytes] of Object.entries(fonts)) {
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const file = `adaptation-${style}.ttf`;
      doc.addFileToVFS(file, btoa(binary)); doc.addFont(file, "liben", style === "regular" ? "normal" : "bold");
    }
    font = "liben";
  }
  const width = doc.internal.pageSize.getWidth(), margin = 12, usable = width - margin * 2;
  const text = (value: string, x: number, y: number, size = 9, color: Color = ink, bold = false) => {
    doc.setTextColor(...color); doc.setFont(font, bold ? "bold" : "normal"); doc.setFontSize(size); doc.text(value, x, y);
  };
  const box = (x: number, y: number, w: number, h: number, color: Color = cream) => {
    doc.setFillColor(...color); doc.roundedRect(x, y, w, h, 2, 2, "F");
  };
  doc.setFillColor(...brown); doc.rect(0, 0, width, 2, "F");
  const image = doc.getImageProperties(logo), scale = Math.min(23 / image.width, 23 / image.height);
  doc.addImage(logo, "PNG", margin, 7, image.width * scale, image.height * scale);
  text("PLANEJAMENTO NUTRICIONAL", 40, 12, 8, brown, true);
  // Nomes longos ocupam duas linhas sem invadir os indicadores.
  doc.setFontSize(17); doc.setFont(font, "bold"); doc.setTextColor(...ink);
  const titleLines = doc.splitTextToSize(`Adaptação - ${lotName}`, 178) as string[];
  doc.text(titleLines.length > 2 ? [titleLines[0], `${titleLines[1].slice(0, -3)}...`] : titleLines, 40, 20);
  text(`Início ${formatDate(input.startDate)}  |  Término ${formatDate(result.endDate)}`, 40, 32, 8, muted);
  text("LIBEN AGRONEGÓCIOS", width - 62, 12, 8, brown, true);
  text(`Emitido em ${issued.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, width - 62, 18, 8, muted);

  const gap = 4, cardWidth = (usable - gap * 3) / 4;
  const metrics = [
    ["ANIMAIS NO LOTE", `${formatNumber(input.headCount, 0)} cabeças`, "Base das quantidades deste relatório"],
    ["PESO MÉDIO", `${formatNumber(input.averageWeightKg, 2)} kg`, `Peso vivo total: ${formatNumber(result.totalLiveWeight, 2)} kg`],
    ["ADAPTAÇÃO", `${result.adaptationDays} dias`, `${result.phases.length} etapas de 3 dias`],
    ["CONFINAMENTO TOTAL", `${input.totalDays} dias`, `Inclui adaptação + ${result.postDays} dias seguintes`],
  ];
  metrics.forEach(([label, value, note], i) => {
    const x = margin + i * (cardWidth + gap); box(x, 35, cardWidth, 21);
    text(label, x + 4, 41, 7, muted, true); text(value, x + 4, 49, 15, brown, true); text(note, x + 4, 54, 7, muted);
  });

  // Gráfico em degraus: a proporção permanece constante durante cada etapa.
  const chartX = margin, chartWidth = 164, chartY = 62, chartHeight = 37;
  text("Evolução da oferta (% do peso vivo)", chartX, chartY, 10, brown, true);
  const points = [...result.phases.map(p => ({ day: p.startDay, feed: p.feedPct, roughage: p.roughagePct })),
    ...(result.postDays > 0 ? [{ day: result.adaptationDays + 1, feed: input.postFeedPct, roughage: input.postRoughagePct }] : [])];
  const maxValue = Math.max(1, ...points.flatMap(p => [p.feed, p.roughage]));
  const maxY = Math.ceil(maxValue * 2) / 2;
  const plotX = chartX + 11, plotY = chartY + 7, plotW = chartWidth - 16, plotH = chartHeight - 17;
  for (let i = 0; i <= 2; i++) {
    const y = plotY + plotH * i / 2; doc.setDrawColor(225, 220, 212); doc.setLineWidth(0.2); doc.line(plotX, y, plotX + plotW, y);
    text(formatNumber(maxY * (1 - i / 2), 1), chartX, y + 1, 7, muted);
  }
  const cellW = plotW / points.length;
  for (const [key, color] of [["feed", orange], ["roughage", green]] as const) {
    doc.setDrawColor(...color); doc.setLineWidth(0.8);
    points.forEach((p, i) => {
      const x = plotX + i * cellW, y = plotY + plotH * (1 - p[key] / maxY);
      doc.line(x, y, x + cellW, y);
      if (i < points.length - 1) doc.line(x + cellW, y, x + cellW, plotY + plotH * (1 - points[i + 1][key] / maxY));
      doc.setFillColor(...color); doc.circle(x + cellW / 2, y, 0.65, "F");
    });
  }
  points.forEach((p, i) => text(i === points.length - 1 && result.postDays > 0 ? "Dia 16+" : `Dia ${p.day}`, plotX + i * cellW + 2, plotY + plotH + 5, 7, muted));
  text("Etapas com a mesma largura; duração indicada na tabela.", plotX, chartY + chartHeight, 6.5, muted);
  text("Ração", chartX + 119, chartY, 8, orange, true); text("Volumoso", chartX + 137, chartY, 8, green, true);
  const sideX = chartX + chartWidth + 6, sideW = usable - chartWidth - 6;
  box(sideX, 61, sideW, 40);
  text("BASE DO PLANEJAMENTO", sideX + 4, 68, 8, brown, true);
  text(`Ração: ${money(input.feedPriceKg)}/kg`, sideX + 4, 75, 9);
  text(`Volumoso: ${money(input.roughagePriceKg)}/kg`, sideX + 4, 81, 9);
  text(`Custo por animal: ${money(result.totalCostPerHead)}`, sideX + 4, 88, 9, brown, true);
  text("Peso fixo na simulação; sem projeção de ganho.", sideX + 4, 95, 7, muted);
  text("Quantidades e custos consideram o lote inteiro.", sideX + 4, 100, 7, muted);

  text("Plano de fornecimento por etapa", margin, 104, 10, brown, true);
  const phases = result.phases.map(p => [
    `Dias ${p.startDay} a ${p.endDay} (${p.days} dias)\n${formatDate(p.startDate)} a ${formatDate(p.endDate)}`,
    formatNumber(p.feedPct, 2), formatNumber(p.roughagePct, 2), formatNumber(p.feedDailyKg, 2), formatNumber(p.roughageDailyKg, 2),
    formatNumber(p.feedPeriodKg, 2), formatNumber(p.roughagePeriodKg, 2), money(p.cost),
  ]);
  phases.push([`Total da adaptação (${result.adaptationDays} dias)`, "-", "-", "-", "-", formatNumber(result.adaptationFeedKg, 2), formatNumber(result.adaptationRoughageKg, 2), money(result.adaptationCost)]);
  if (result.postDays > 0) phases.push([
    `Após adaptação (${result.postDays} dias)\n${formatDate(result.postStartDate)} a ${formatDate(result.endDate)}`,
    formatNumber(input.postFeedPct, 2), formatNumber(input.postRoughagePct, 2), formatNumber(result.postFeedDailyKg, 2), formatNumber(result.postRoughageDailyKg, 2),
    formatNumber(result.postFeedDailyKg * result.postDays, 2), formatNumber(result.postRoughageDailyKg * result.postDays, 2), money(result.postDailyCost * result.postDays),
  ]);
  autoTable(doc, {
    startY: 108, margin: { left: margin, right: margin, top: 15, bottom: 18 },
    head: [["Etapa / período", "Ração\n% PV", "Volumoso\n% PV", "Ração\nkg/dia (lote)", "Volumoso\nkg/dia (lote)", "Ração\nkg no período", "Volumoso\nkg no período", "Custo\ndo período"]],
    body: phases, styles: { font, fontSize: 8, cellPadding: 1.3, textColor: ink, lineColor: [234, 229, 222], lineWidth: 0.1, valign: "middle", halign: "right" },
    headStyles: { fillColor: brown, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: cream }, columnStyles: { 0: { cellWidth: 55, halign: "left" }, 1: { cellWidth: 19 }, 2: { cellWidth: 19 } },
    rowPageBreak: "avoid",
    didParseCell(data) { if (data.section === "body" && data.row.index === result.phases.length) { data.cell.styles.fillColor = [235, 226, 215]; data.cell.styles.fontStyle = "bold"; } },
  });
  let endY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  if (endY + 17 > 200) { doc.addPage(); endY = 18; }
  const totals = [["RAÇÃO NO CONFINAMENTO", `${formatNumber(result.totalFeedKg, 2)} kg`], ["VOLUMOSO NO CONFINAMENTO", `${formatNumber(result.totalRoughageKg, 2)} kg`], ["CUSTO TOTAL ESTIMADO", money(result.totalCost)]];
  const totalW = (usable - 8) / 3;
  totals.forEach(([label, value], i) => {
    const x = margin + i * (totalW + 4); box(x, endY, totalW, 17, i === 2 ? brown : cream);
    text(label, x + 4, endY + 5, 7, i === 2 ? [240, 229, 216] : muted, true);
    text(value, x + 4, endY + 12, 14, i === 2 ? [255, 255, 255] : brown, true);
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); text("LiBen Agronegócios | Planejamento estimado com os parâmetros informados.", margin, 205, 7, muted);
    text(`${page} / ${pages}`, width - 22, 205, 7, muted);
  }
  return doc;
}
