import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(text, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const formatUrl = moduleUrl(source('../src/lib/format.ts'));
const {computeAdaptation,validateAdaptation,defaultAdaptationPhases} = await import(moduleUrl(source('../src/lib/adaptation.ts').replace('from "./format"',`from "${formatUrl}"`)));
const fixture=JSON.parse(source('./fixtures/adaptation-workbook.json'));
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-7,`${label}: ${actual} != ${expected}`);
for(const [index,entry] of fixture.cases.entries()) test(`adaptação confere com fórmulas da planilha: cenário ${index+1}`,()=>{
 const result=computeAdaptation(entry.input);
 for(let i=0;i<5;i++)for(const [key,value] of Object.entries(entry.phases[i]))near(result.phases[i][key],value,`Etapa ${i+1}, ${key}`);
 for(const [key,value] of Object.entries(entry.totals))near(result[key],value,key);
 near(result.totalCostPerHead,entry.totals.totalCost/entry.input.headCount,'Custo por animal');
});
test('etapas cobrem quinze dias consecutivos e confinamento inclui adaptação',()=>{
 const input={...fixture.cases[0].input,totalDays:15,phases:defaultAdaptationPhases()};
 const result=computeAdaptation(input);
 assert.equal(result.phases[0].startDate,'2026-10-14');
 assert.equal(result.phases[0].endDate,'2026-10-16');
 assert.equal(result.phases[1].startDate,'2026-10-17');
 assert.equal(result.phases[4].endDate,'2026-10-28');
 assert.equal(result.postDays,0);assert.equal(result.endDate,'2026-10-28');
 near(result.totalCost,result.adaptationCost,'Sem consumo após adaptação');
});
test('peso total escala pelas cabeças e custos não são divididos duas vezes',()=>{
 const input=fixture.cases[0].input;const original=computeAdaptation(input);const double=computeAdaptation({...input,headCount:input.headCount*2});
 near(double.totalCost,original.totalCost*2,'Custo do lote');near(double.totalCostPerHead,original.totalCostPerHead,'Custo por cabeça');
 near(original.totalLiveWeight,4000,'Peso total H5');
});
test('dados ausentes e valores inválidos não viram totais zero',()=>{
 const input=fixture.cases[0].input;
 for(const change of [{headCount:0},{headCount:1.5},{averageWeightKg:0},{feedPriceKg:-1},{totalDays:14},{totalDays:15.5},{startDate:'2026-02-30'},{phases:[]},{postFeedPct:101}])assert.throws(()=>validateAdaptation({...input,...change}));
 assert.throws(()=>validateAdaptation(null));
});
