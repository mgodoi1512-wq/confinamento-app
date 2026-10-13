import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Compila os módulos reais, sem manter uma cópia das fórmulas nos testes.
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const formatSource = fs.readFileSync(new URL('../src/lib/format.ts', import.meta.url), 'utf8');
const formatUrl = moduleUrl(formatSource);
const constantsUrl = moduleUrl(fs.readFileSync(new URL('../src/lib/constants.ts', import.meta.url), 'utf8'));
const domainSource = fs.readFileSync(new URL('../src/lib/domain.ts', import.meta.url), 'utf8')
  .replace('from "./constants"', `from "${constantsUrl}"`).replace('from "./format"', `from "${formatUrl}"`);
const format = await import(formatUrl);
const domain = await import(moduleUrl(domainSource));

test('data civil de São Paulo não muda ao entrar no dia seguinte em UTC', () => {
  assert.equal(format.todayIso(new Date('2026-10-13T00:30:00Z')), '2026-10-12');
  assert.equal(format.todayIso(new Date('2026-10-13T03:00:00Z')), '2026-10-13');
});
test('datas e carência mantêm dias civis e validam datas impossíveis', () => {
  assert.equal(format.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(format.daysBetween('2026-10-01', '2026-10-11'), 10);
  assert.equal(format.isValidIsoDate('2026-02-30'), false);
  assert.throws(() => format.addDays('2026-10-01', -1));
  assert.equal(domain.isUnderWithdrawal({withdrawal_until:'2026-10-13'}, '2026-10-12'), true);
  assert.equal(domain.isUnderWithdrawal({withdrawal_until:'2026-10-12'}, '2026-10-12'), false);
});
test('números pt-BR e decimais com ponto, entradas inválidas são rejeitadas', () => {
  for (const [raw, expected] of [['1.234,5',1234.5],['512,4',512.4],['512.4',512.4],['12 kg',12],['-3%',-3],['',null],['1,2,3',null],['1e3',null],['Infinity',null]]) {
    assert.equal(format.parseNumberInput(raw), expected, raw);
  }
});
const lot={id:'l1',entry_date:'2026-10-01',entry_avg_weight_kg:400,head_count:100,initial_head_count:100,status:'ativo',target_weight_kg:520};
const weighing={id:'w1',lot_id:'l1',date:'2026-10-11',avg_weight_kg:430,created_at:'2026-10-11T12:00:00Z'};
test('GMD permanece ligado à data da pesagem, mesmo dez dias depois', () => {
  assert.equal(domain.computeLotMetrics(lot,[weighing],'2026-10-11').gmd,3);
  assert.equal(domain.computeLotMetrics(lot,[weighing],'2026-10-21').gmd,3);
  assert.equal(domain.computeLotMetrics(lot,[],'2026-10-21').gmd,null);
  assert.equal(domain.computeLotMetrics(lot,[weighing],'2026-10-10').gmd,null);
});
test('mortalidade contabiliza cabeças e prontidão respeita carência', () => {
  const animals=[{id:'a1',lot_id:'l1',status:'ativo',current_weight_kg:550,withdrawal_until:'2026-10-30'},
    {id:'a2',lot_id:'l1',status:'ativo',current_weight_kg:550,withdrawal_until:null}];
  const summary=domain.computeHerdSummary([lot],animals,[weighing],[],[{kind:'obito',head_count:5,lot_id:'l1'}],'2026-10-21');
  assert.equal(summary.deaths,5);assert.equal(summary.mortalityRate,5);assert.equal(summary.readyForSlaughter,1);
});
test('GMD negativo não desaparece do indicador agregado', () => {
  const summary=domain.computeHerdSummary([lot],[],[{...weighing,avg_weight_kg:390}],[],[],'2026-10-21');
  assert.equal(summary.avgGmd,-1);
});
