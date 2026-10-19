import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpileModule(s,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const format=url("export const todayIso=()=> '2026-10-18';export const daysBetween=(a,b)=>(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000;");
const detail=url(compile(fs.readFileSync(new URL('../src/lib/stock-animal-detail.ts',import.meta.url),'utf8')).replace('from "./format"',`from "${format}"`));
const {stockAnimalDetails,stockDetailTotals,stockWeightAt,stockProjectionInfo,stockProjectionSummary}=await import(detail);
const logic=url(compile(fs.readFileSync(new URL('../src/lib/financial-workspace.ts',import.meta.url),'utf8')).replace('from "./format"',`from "${format}"`).replace('from "./stock-animal-detail"',`from "${detail}"`));
const {animalStock}=await import(logic);
const lot={id:'lot',code:'Lote 1',entry_date:'2026-10-01',entry_avg_weight_kg:410,status:'ativo',head_count:2};
const animals=[{id:'a',ear_tag:'Animal 1',status:'ativo',lot_id:'lot',entry_weight_kg:400},{id:'b',ear_tag:'Animal 2',status:'ativo',lot_id:'lot',entry_weight_kg:420}];
const weighings=[{id:'w',lot_id:'lot',date:'2026-10-16',kind:'individual',head_count_weighed:2,avg_weight_kg:460,created_at:'2026-10-16T12:00:00Z'}];
const records=[{id:'r1',weighing_id:'w',animal_id:'a',weight_kg:450},{id:'r2',weighing_id:'w',animal_id:'b',weight_kg:470}];
const options={start:'2026-10-01',end:'2026-10-18',yieldPct:50,arrobaPrice:360,project:false};
const purchase={default:{amount_per_head:4500,updated_at:'v'},animals:[{animal_id:'a',amount:4000,updated_at:'v'}]};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('ganho individual usa pesos e datas efetivas; compra individual prevalece sobre padrão',()=>{
 const rows=stockAnimalDetails(lot,animals,weighings,records,options,purchase);assert.equal(rows[0].gain,50);close(rows[0].periodGmd,50/15);assert.equal(rows[0].purchase,4000);assert.equal(rows[1].purchase,4500);assert.equal(rows[0].sale,5400);assert.equal(rows[0].difference,1400);assert.equal(rows[0].end.valueDate,'2026-10-16');
});
test('projeção usa GMD histórico e totais do detalhamento coincidem com estoque',()=>{
 const rows=stockAnimalDetails(lot,animals,weighings,records,{...options,project:true},purchase),total=stockDetailTotals(rows);close(total.weight,933.3333333333);close(total.sale,11200);close(total.difference,2700);
 const [summary]=animalStock([lot],animals,weighings,records,50,true,'2026-10-18');close(summary.totalKg,total.weight);close(summary.carcassArrobas,total.arrobas);assert.equal(summary.projected,true);
});
test('mudança de período não inventa ganho quando não há referência nova',()=>{
 const [row]=stockAnimalDetails(lot,animals,weighings,records,{...options,start:'2026-10-16'});assert.equal(row.gain,null);assert.equal(row.periodGmd,null);
 const [projected]=stockAnimalDetails(lot,animals,weighings,records,{...options,start:'2026-10-16',project:true});close(projected.gain,50/15*2);
});
test('pesagem individual parcial não é usada como média de todos os animais',()=>{
 const ws=[{...weighings[0],head_count_weighed:1,avg_weight_kg:450}];const rows=stockAnimalDetails(lot,animals,ws,records.slice(0,1),options);assert.equal(rows[0].end.weight,450);assert.equal(rows[1].end.weight,420);assert.equal(rows[1].gain,null);
});
test('preço e compra ausentes ficam em branco; diferença não é calculada parcialmente',()=>{
 const rows=stockAnimalDetails(lot,animals,weighings,records,{...options,arrobaPrice:null});assert.equal(rows[0].sale,null);assert.equal(rows[0].purchase,null);assert.equal(stockDetailTotals(rows).difference,null);
 const zero=stockAnimalDetails(lot,animals,weighings,records,options,{default:null,animals:[{animal_id:'a',amount:0,updated_at:'v'}]});assert.equal(zero[0].purchase,0);assert.equal(zero[0].purchaseSource,'individual');assert.equal(stockDetailTotals(zero).difference,null);
});
test('sem cadastros completos, usa linhas identificadas como referência sem inventar brincos',()=>{
 const rows=stockAnimalDetails(lot,[],weighings,records,options,{default:{amount_per_head:4000,updated_at:'v'},animals:[]});assert.equal(rows.length,2);assert.equal(rows[0].registered,false);assert.match(rows[0].earTag,/Sem cadastro/);assert.equal(rows[0].purchase,4000);assert.equal(rows[0].end.individual,false);
});
test('pesagens de outro lote e futuras não contaminam o cálculo',()=>{
 const rows=stockAnimalDetails(lot,animals,[{...weighings[0],lot_id:'other'},{...weighings[0],id:'future',date:'2026-11-01'}],records,options);assert.equal(rows[0].end.weight,400);assert.equal(rows[0].gain,null);
});
test('animal vendido não entra nos animais presentes',()=>{
 const rows=stockAnimalDetails({...lot,head_count:1},[animals[0],{...animals[1],status:'vendido'}],weighings,records,options);assert.equal(rows.length,1);assert.equal(rows[0].id,'a');
});
test('GMD negativo é exibido no período, sem projetar perda adiante',()=>{
 const rows=stockAnimalDetails(lot,animals,weighings,[{...records[0],weight_kg:390},records[1]],{...options,project:true});assert.equal(rows[0].end.weight,390);assert.equal(rows[0].end.projected,false);assert.ok(rows[0].periodGmd<0);
});
test('data inválida, rendimento inválido e preço negativo são rejeitados',()=>{
 assert.throws(()=>stockAnimalDetails(lot,animals,weighings,records,{...options,start:'2026-09-01'}),/período/);assert.throws(()=>stockAnimalDetails(lot,animals,weighings,records,{...options,yieldPct:0}),/rendimento/);assert.throws(()=>stockAnimalDetails(lot,animals,weighings,records,{...options,arrobaPrice:-1}),/rendimento/);
});

test('motivo diferencia falta de histórico, referência de hoje, GMD zero e negativo',()=>{
 const noHistory=stockWeightAt(lot,animals[0],'2026-10-18',[],[],true);assert.equal(stockProjectionInfo(noHistory,true,'2026-10-18').label,'Sem GMD disponível');
 const today=stockWeightAt(lot,animals[0],'2026-10-16',weighings,records,true);assert.equal(stockProjectionInfo(today,true,'2026-10-16').label,'Peso na data final');
 const current={...today,referenceDate:'2026-10-18'};assert.equal(stockProjectionInfo(current,true,'2026-10-18').label,'Peso atualizado hoje');
 assert.equal(stockProjectionInfo({...today,gmd:0},true,'2026-10-18').label,'GMD igual a zero');assert.equal(stockProjectionInfo({...today,gmd:-1},true,'2026-10-18').label,'GMD negativo');
});
test('lote com projeção parcial informa quantidade e motivo dos demais animais',()=>{
 const list=stockAnimalDetails(lot,[animals[0],{...animals[1],entry_weight_kg:null}],weighings,records,{...options,project:true});const status=stockProjectionSummary(list,true,'2026-10-18');assert.equal(status.label,'Projeção parcial');assert.match(status.description,/1 de 2/);assert.match(status.description,/Sem GMD disponível: 1/);
});
