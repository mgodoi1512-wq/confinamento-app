import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read = path => fs.readFileSync(new URL(path, import.meta.url),'utf8');
const url = source => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText).toString('base64');
const format=url(read('../src/lib/format.ts')), constants=url(read('../src/lib/constants.ts'));
const domain=url(read('../src/lib/domain.ts').replace('from "./format"',`from "${format}"`).replace('from "./constants"',`from "${constants}"`));
const {weighingGmd}=await import(url(read('../src/lib/weighing-gmd.ts').replace('from "./domain"',`from "${domain}"`).replace('from "./format"',`from "${format}"`)));
const lot={id:'l',entry_date:'2026-10-01',entry_avg_weight_kg:350};
const session={id:'w',lot_id:'l',date:'2026-10-11',avg_weight_kg:365};
test('primeira sessão usa a entrada e inclui a referência na dica',()=>{
  const result=weighingGmd(session,lot,[session],'2026-10-19');
  assert.equal(result.gmd,1.5);assert.match(result.reason,/entrada do lote/);
});
test('sessão seguinte usa a anterior e ignora registros anteriores à entrada e de outro lote',()=>{
  const records=[session,{...session,id:'before',date:'2026-09-30',avg_weight_kg:999},
    {...session,id:'other',lot_id:'other',date:'2026-10-10',avg_weight_kg:999}];
  const next={...session,id:'next',date:'2026-10-16',avg_weight_kg:370};
  assert.equal(weighingGmd(next,lot,records,'2026-10-19').gmd,1);
  assert.match(weighingGmd(next,lot,records,'2026-10-19').reason,/pesagem anterior/);
});
test('não calcula sem intervalo ou sem base; preserva ganho zero e perda de peso',()=>{
  assert.equal(weighingGmd({...session,date:lot.entry_date},lot,[],'2026-10-19').gmd,null);
  assert.equal(weighingGmd(session,null,[],'2026-10-19').gmd,null);
  assert.equal(weighingGmd(session,lot,[],'2026-10-10').gmd,null);
  assert.equal(weighingGmd({...session,avg_weight_kg:350},lot,[],'2026-10-19').gmd,0);
  assert.equal(weighingGmd({...session,avg_weight_kg:340},lot,[],'2026-10-19').gmd,-1);
});
