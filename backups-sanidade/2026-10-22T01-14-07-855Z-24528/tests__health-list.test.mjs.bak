import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const moduleUrl=s=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const formatUrl=moduleUrl(read('../src/lib/format.ts'));
const constantsUrl=moduleUrl(read('../src/lib/constants.ts'));
const domainUrl=moduleUrl(read('../src/lib/domain.ts').replace('from "./constants"',`from "${constantsUrl}"`).replace('from "./format"',`from "${formatUrl}"`));
const {emptyHealthFilters,hasHealthFilters,filterHealthEvents}=await import(moduleUrl(read('../src/pages/health/health-list.ts').replaceAll('from "@/lib/domain"',`from "${domainUrl}"`)));
const animals=new Map([['a',{id:'a',ear_tag:'BR-10'}]]),lots=new Map([['l',{id:'l',code:'Lote São João'}]]),today='2026-10-21';
const events=[
 {id:'active',animal_id:'a',lot_id:'l',event_date:'2026-10-20',kind:'tratamento',product:'Solução A',withdrawal_until:'2026-10-23',diagnosis:'Inflamação'},
 {id:'today',animal_id:'a',lot_id:'l',event_date:'2026-10-21',kind:'vacina',product:'B',withdrawal_until:today},
 {id:'unknown',animal_id:null,lot_id:null,event_date:'2026-09-30',kind:'tratamento',product:null,withdrawal_until:null},
 {id:'death',animal_id:'a',lot_id:'l',event_date:'2026-10-18',kind:'obito',diagnosis:'Causa registrada',withdrawal_until:null},
];
const filter=(change,mode='treatments',rows=events)=>filterHealthEvents(rows,{...emptyHealthFilters(),...change},animals,lots,mode,today).map(e=>e.id);
test('busca sem acento por brinco, lote, produto e diagnóstico; vínculos ausentes não falham',()=>{
 assert.deepEqual(filter({search:' BR-10 '}),['active','today','death']);
 assert.deepEqual(filter({search:'sao joao'}),['active','today','death']);
 assert.deepEqual(filter({search:'solucao'}),['active']);
 assert.deepEqual(filter({search:'inflamacao'}),['active']);
 assert.deepEqual(filter({lot:'outro'}),[]);
});
test('período inclusivo e combinação com lote; intervalo invertido não retorna registros',()=>{
 assert.deepEqual(filter({from:'2026-10-20',to:'2026-10-21',lot:'l'}),['active','today']);
 assert.deepEqual(filter({from:'2026-10-21',to:'2026-10-20'}),[]);
});
test('carência usa a regra existente: fim hoje encerrado e prazo ausente não é declarado liberado',()=>{
 assert.deepEqual(filter({situation:'active'}),['active']);
 assert.deepEqual(filter({situation:'ended'}),['today']);
 assert.deepEqual(filter({situation:'unknown'}),['unknown','death']);
});
test('tipo distingue óbito de caso clínico na lista sanitária; filtros não mutam os dados',()=>{
 const snapshot=structuredClone(events),occurrences=events.filter(e=>e.kind==='obito'||e.diagnosis);
 assert.deepEqual(filter({situation:'death'},'occurrences',occurrences),['death']);
 assert.deepEqual(filter({situation:'clinical'},'occurrences',occurrences),['active']);
 assert.deepEqual(events,snapshot);
 assert.equal(hasHealthFilters(emptyHealthFilters()),false);
 assert.equal(hasHealthFilters({...emptyHealthFilters(),from:today}),true);
});
