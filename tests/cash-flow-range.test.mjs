import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText.replace(/from "(jspdf|jspdf-autotable|exceljs)"/g, (_, name) => `from "${import.meta.resolve(name)}"`);
const load = async path => import('data:text/javascript;base64,' + Buffer.from(compile(path)).toString('base64'));

const { checkRange, splitRange, summarizeRange, rangeEntries, buildCashFlowRange } = await load('../src/lib/cash-flow-range.ts');

const entry = (id, direction, amount, due, settled = null, extra = {}) => ({
  id, farm_id: 'f', direction, description: id, category: 'Outras despesas', amount,
  due_date: due, settled_on: settled, lot_id: null, notes: '', updated_at: 'v', ...extra,
});
const settings = { cash_configured: true, opening_date: '2026-09-01', opening_balance: 1000, carcass_yield: 52, arroba_price: null, updated_at: 'v' };
const entries = [
  entry('a', 'entrada', 5000, '2026-09-20', '2026-09-20'),
  entry('b', 'saida', 800, '2026-09-28', '2026-09-28'),
  entry('g', 'saida', 500, '2026-10-05', '2026-10-06'),
  entry('d', 'entrada', 3000, '2026-11-03', '2026-11-03'),
  entry('c', 'saida', 1050, '2026-11-10', '2026-11-10'),
  entry('f', 'entrada', 200, '2026-11-18'),
  entry('e', 'saida', 964.79, '2026-11-25'),
  entry('h', 'saida', 77, '2026-08-01'),
];
const sum = (list, pick) => Math.round(list.reduce((total, item) => total + pick(item), 0) * 100) / 100;

test('intervalo é validado: datas reais, ordem e limite de 24 meses', () => {
  assert.equal(checkRange('2026-11-01', '2026-11-16'), null);
  assert.equal(checkRange('2026-11-16', '2026-11-16'), null);
  assert.match(checkRange('2026-11-16', '2026-11-01'), /anterior/);
  assert.match(checkRange('2026-02-30', '2026-03-01'), /Informe/);
  assert.match(checkRange('', '2026-03-01'), /Informe/);
  assert.equal(checkRange('2025-01-01', '2027-01-02'), null);
  assert.match(checkRange('2025-01-01', '2027-01-03'), /24 meses/);
});

test('semanas partem da data inicial e a última é cortada na data final', () => {
  assert.deepEqual(splitRange('2026-11-01', '2026-11-16', 'semana').map(part => part.label), ['01/11 a 07/11', '08/11 a 14/11', '15/11 a 16/11']);
  assert.deepEqual(splitRange('2026-11-01', '2026-11-08', 'semana').map(part => part.label), ['01/11 a 07/11', '08/11']);
  assert.deepEqual(splitRange('2026-12-28', '2027-01-10', 'semana').map(part => part.label), ['28/12/2026 a 03/01/2027', '04/01/2027 a 10/01/2027']);
});

test('meses respeitam o calendário, intervalos parciais e anos bissextos', () => {
  const parts = splitRange('2026-10-16', '2027-01-10', 'mes');
  assert.deepEqual(parts.map(part => part.label), ['out/2026 (16/10 a 31/10)', 'nov/2026', 'dez/2026', 'jan/2027 (01/01 a 10/01)']);
  assert.deepEqual(parts.map(part => part.to), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-10']);
  assert.equal(splitRange('2027-02-01', '2027-03-05', 'mes')[0].to, '2027-02-28');
  assert.equal(splitRange('2028-02-01', '2028-03-05', 'mes')[0].to, '2028-02-29');
});

test('sem subtotais o período vira um único intervalo com os mesmos totais', () => {
  const parts = splitRange('2026-11-01', '2026-11-16', 'nenhum');
  assert.deepEqual(parts, [{ from: '2026-11-01', to: '2026-11-16', label: '01/11/2026 a 16/11/2026' }]);
  const none = summarizeRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'nenhum' });
  const weekly = summarizeRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'semana' });
  assert.equal(none.intervals.length, 1);
  for (const key of ['opening', 'closing', 'income', 'expenses', 'net', 'receivable', 'payable']) assert.equal(none[key], weekly[key]);
  const { report } = buildCashFlowRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'nenhum' }, { lotName: () => '—', today: '2026-11-16' });
  assert.match(report.filters, /sem subtotais/);
  assert.equal(report.rows.length, 4);
});

test('os intervalos cobrem o período sem buracos nem sobreposição', () => {
  for (const group of ['semana', 'mes']) {
    const parts = splitRange('2026-01-15', '2026-12-20', group);
    assert.equal(parts[0].from, '2026-01-15');
    assert.equal(parts.at(-1).to, '2026-12-20');
    for (let index = 1; index < parts.length; index++) {
      const next = new Date(parts[index - 1].to + 'T00:00:00Z');
      next.setUTCDate(next.getUTCDate() + 1);
      assert.equal(next.toISOString().slice(0, 10), parts[index].from);
    }
  }
});

test('resumo do período usa as mesmas regras da tela (abertura, realizados e pendentes)', () => {
  const range = summarizeRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'semana' });
  assert.equal(range.opening, 1000 + 5000 - 800 - 500);
  assert.equal(range.income, 3000);
  assert.equal(range.expenses, 1050);
  assert.equal(range.net, 1950);
  assert.equal(range.closing, range.opening + 1950);
  assert.equal(range.receivable, 200);
  assert.equal(range.payable, 964.79);
  assert.equal(range.intervals.length, 5);
  assert.equal(range.intervals[0].income, 3000);
  assert.equal(range.intervals[1].expenses, 1050);
  assert.equal(range.intervals.at(-1).balanceEnd, range.closing);
  assert.equal(sum(range.intervals, item => item.net), range.net);
  assert.equal(sum(range.intervals, item => item.count), 4);
});

test('pendências vencidas antes do início não entram e o saldo atravessa meses e anos', () => {
  const range = summarizeRange(entries, settings, { from: '2026-09-15', to: '2026-12-31', group: 'mes' });
  assert.equal(range.opening, 1000);
  assert.equal(range.income, 8000);
  assert.equal(range.expenses, 2350);
  assert.equal(range.closing, 1000 + 8000 - 2350);
  assert.equal(range.payable, 964.79);
  assert.equal(range.intervals.length, 4);
  assert.equal(sum(range.intervals, item => item.payable), range.payable);
});

test('sem configuração do caixa o cálculo começa no início do intervalo com saldo zero', () => {
  const range = summarizeRange(entries, null, { from: '2026-11-01', to: '2026-11-30', group: 'mes' });
  assert.equal(range.opening, 0);
  assert.equal(range.closing, 1950);
});

test('lista de lançamentos: realizados pela data de realização, pendentes pela data prevista, em ordem', () => {
  const list = rangeEntries(entries, '2026-11-01', '2026-11-30');
  assert.deepEqual(list.map(item => item.id), ['d', 'c', 'f', 'e']);
  assert.deepEqual(rangeEntries(entries, '2026-10-01', '2026-10-31').map(item => item.id), ['g']);
});

test('relatório do intervalo traz filtros, observação, linhas e o resumo para Excel e PDF', () => {
  const lots = { l1: 'Lote 01' };
  const withLot = [...entries, entry('l', 'saida', 10, '2026-11-12', '2026-11-12', { lot_id: 'l1', notes: 'Sal' }), entry('o', 'saida', 5, '2026-11-05')];
  const { report, pdf } = buildCashFlowRange(withLot, settings, { from: '2026-11-01', to: '2026-11-30', group: 'mes' }, { lotName: id => lots[id] ?? '—', today: '2026-11-16' });
  assert.equal(report.filename, 'fluxo-de-caixa-2026-11-01-a-2026-11-30');
  assert.match(report.filters, /01\/11\/2026 a 30\/11\/2026/);
  assert.match(report.filters, /por mês/);
  assert.match(report.note, /Saldo de abertura do período: R\$ 4\.700,00/);
  assert.equal(report.rows.length, 6);
  assert.deepEqual(report.rows[0].slice(0, 2), ['03/11/2026', '03/11/2026']);
  assert.equal(report.rows.find(row => row[2] === 'l')[4], 'Lote 01');
  assert.equal(report.rows.find(row => row[2] === 'o')[7], 'Em atraso');
  assert.equal(report.rows.find(row => row[2] === 'f')[7], 'Pendente');
  assert.equal(report.rows.find(row => row[2] === 'e')[7], 'Pendente');
  assert.equal(report.columns.length, report.rows[0].length);
  assert.equal(report.cashRange.group, 'mes');
  assert.equal(pdf.periodLabel, '01/11/2026 a 30/11/2026');
  assert.equal(pdf.summary.actual, report.cashRange.closing);
  assert.equal(pdf.entries.find(item => item.id === 'l').lotLabel, 'Lote 01');
});

const { createCashFlowWorkbook } = await load('../src/lib/cash-flow-excel.ts');
const { createCashFlowPdf } = await load('../src/lib/cash-flow-pdf.ts');

test('Excel do intervalo ganha a aba de resumo e mantém a aba de lançamentos', () => {
  const { report } = buildCashFlowRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'semana' }, { lotName: () => '—', today: '2026-11-16' });
  const book = createCashFlowWorkbook(report);
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ['Resumo por intervalo', 'Fluxo de caixa']);
  const summary = book.getWorksheet('Resumo por intervalo');
  assert.equal(summary.getCell('A6').value, 'Saldo de abertura');
  assert.equal(summary.getCell('G6').value, 4700);
  assert.equal(summary.getCell('A7').value, '01/11 a 07/11');
  assert.equal(summary.getCell('B7').value, 3000);
  assert.equal(summary.getCell('A12').value, 'Total do período');
  assert.equal(summary.getCell('B12').value, 3000);
  assert.equal(summary.getCell('C12').value, 1050);
  assert.equal(summary.getCell('G12').value, 6650);
  assert.equal(summary.getCell('B7').numFmt, '#,##0.00');
  assert.equal(book.getWorksheet('Fluxo de caixa').getCell('A6').value, '03/11/2026');
});

test('Excel sem subtotais traz só a aba de lançamentos', () => {
  const { report } = buildCashFlowRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'nenhum' }, { lotName: () => '—', today: '2026-11-16' });
  const book = createCashFlowWorkbook(report);
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ['Fluxo de caixa']);
  assert.equal(book.getWorksheet('Fluxo de caixa').getCell('A6').value, '03/11/2026');
});

test('Excel sem intervalo continua com uma única aba', () => {
  const book = createCashFlowWorkbook({ title: 'Fluxo de caixa', filename: 'f', filters: 'x', note: 'y', columns: [{ title: 'A' }], rows: [['1']] });
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ['Fluxo de caixa']);
});

test('PDF sem subtotais gera o relatório do período sem a tabela de intervalos', () => {
  const pdf = buildCashFlowRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'nenhum' }, { lotName: () => '—', today: '2026-11-16' }).pdf;
  const doc = createCashFlowPdf({ ...pdf, generatedAt: new Date('2026-11-16T12:00:00Z') });
  assert.ok(doc.getNumberOfPages() >= 1);
});

test('PDF do intervalo gera páginas e continua válido com muitos intervalos', () => {
  const small = buildCashFlowRange(entries, settings, { from: '2026-11-01', to: '2026-11-30', group: 'semana' }, { lotName: () => '—', today: '2026-11-16' }).pdf;
  const doc = createCashFlowPdf({ ...small, generatedAt: new Date('2026-11-16T12:00:00Z') });
  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.1);
  const many = buildCashFlowRange(entries, settings, { from: '2025-01-01', to: '2026-12-31', group: 'semana' }, { lotName: () => '—', today: '2026-11-16' }).pdf;
  assert.ok(many.range.intervals.length > 100);
  const long = createCashFlowPdf({ ...many, generatedAt: new Date('2026-11-16T12:00:00Z') });
  assert.ok(long.getNumberOfPages() > 1);
});
