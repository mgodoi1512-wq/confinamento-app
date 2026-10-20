import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/weight-history.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText;
const {weightHistory}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const lot={id:'l',entry_date:'2026-10-01',entry_avg_weight_kg:300};
const session={id:'w',lot_id:'l',date:'2026-10-11',avg_weight_kg:320,created_at:'2026-10-11T08:00:00Z'};
test('primeira pesagem produz histórico com entrada e peso registrado',()=>{
  assert.deepEqual(weightHistory(lot,[session],'2026-10-20').map(p=>[p.date,p.weight]),[['2026-10-01',300],['2026-10-11',320]]);
});
test('mesmo dia usa a última sessão, sem duplicar a data de entrada',()=>{
  const atEntry={...session,date:lot.entry_date};
  assert.deepEqual(weightHistory(lot,[{...atEntry,id:'later',created_at:'2026-10-11T09:00:00Z',avg_weight_kg:325},atEntry],'2026-10-20').map(p=>[p.date,p.weight]),[['2026-10-01',325]]);
});
test('ignora futuras, antes da entrada, outro lote e pesos inválidos',()=>{
  const records=[session,{...session,id:'future',date:'2026-11-01'},
    {...session,id:'before',date:'2026-09-01'},{...session,id:'other',lot_id:'x'},
    {...session,id:'zero',date:'2026-10-12',avg_weight_kg:0}];
  assert.equal(weightHistory(lot,records,'2026-10-20').length,2);
});
