import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const format=url(read('../src/lib/format.ts'));
const {parseWithdrawalDays,validateTreatmentForm,validateDeathForm}=await import(url(read('../src/pages/health/health-form.ts').replace('from "@/lib/format"',`from "${format}"`)));
const base={animalId:'a',eligibleIds:['a'],date:'2026-10-21',today:'2026-10-21'};
test('carência vazia, decimal, negativa ou misturada com texto não vira zero',()=>{
 for(const raw of ['',' ','1,5','1.5','-1','2 dias','1e2','36501','Infinity'])assert.equal(parseWithdrawalDays(raw),null,raw);
 for(const [raw,n]of [['0',0],[' 0 ',0],['02',2],['36500',36500]])assert.equal(parseWithdrawalDays(raw),n);
 assert.equal(validateTreatmentForm({...base,product:'Produto',withdrawal:''}).withdrawal!==undefined,true);
 assert.deepEqual(validateTreatmentForm({...base,product:'Produto',withdrawal:'0'}),{});
});
test('animal deve continuar disponível, produto é obrigatório e data não pode ser futura ou impossível',()=>{
 const input={...base,product:'Produto',withdrawal:'2'};
 assert(validateTreatmentForm({...input,eligibleIds:[]}).animal);
 assert(validateTreatmentForm({...input,product:' '}).product);
 for(const date of ['','2026-02-30','2026-10-22'])assert(validateTreatmentForm({...input,date}).date);
});
test('óbito exige causa explícita; Não determinada é uma escolha válida',()=>{
 assert(validateDeathForm({...base,cause:''}).cause);
 assert.deepEqual(validateDeathForm({...base,cause:'Não determinada'}),{});
 assert(validateDeathForm({...base,cause:'Causa',date:'2026-10-22'}).date);
 assert(validateDeathForm({...base,cause:'Causa',eligibleIds:[]}).animal);
});
