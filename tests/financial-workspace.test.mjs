import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const format=url(compile(read('../src/lib/format.ts'))),constants=url(compile(read('../src/lib/constants.ts')));
const domain=url(compile(read('../src/lib/domain.ts').replace('from "./format"',`from "${format}"`).replace('from "./constants"',`from "${constants}"`)));
const stockDetail=url(compile(read('../src/lib/stock-animal-detail.ts').replace('from "./format"',`from "${format}"`)));
const {cashSummary,animalStock}=await import(url(compile(read('../src/lib/financial-workspace.ts').replace('from "./format"',`from "${format}"`).replace('from "./domain"',`from "${domain}"`).replace('from "./stock-animal-detail"',`from "${stockDetail}"`))));
const entry=(direction,amount,due_date,settled_on=null)=>({id:crypto.randomUUID(),direction,amount,due_date,settled_on});
const settings={opening_date:'2026-09-01',opening_balance:10000};
test('caixa usa pagamento efetivo, acumula saldo anterior e mantém pendências fora do realizado',()=>{
 const rows=[entry('entrada',5000,'2026-09-01','2026-09-02'),entry('saida',1000,'2026-09-10','2026-09-10'),entry('entrada',45000,'2026-09-30','2026-10-05'),entry('saida',28500,'2026-10-08','2026-10-08'),entry('saida',3000,'2026-10-20'),entry('entrada',12000,'2026-10-22'),entry('saida',400,'2026-09-20'),entry('entrada',99999,'2026-11-01')];
 const s=cashSummary(rows,settings,'2026-10','2026-10-18');assert.equal(s.opening,14000);assert.equal(s.income,45000);assert.equal(s.expenses,28500);assert.equal(s.actual,30500);assert.equal(s.payable,3400);assert.equal(s.receivable,12000);assert.equal(s.projected,39100);assert.equal(s.chart.reduce((n,c)=>n+c.income,0),45000);
});
test('saldo inicial não repete pagamentos anteriores à data de abertura e considera mês bissexto',()=>{
 const s=cashSummary([entry('entrada',100,'2024-01-01','2024-01-01'),entry('saida',20,'2024-02-10','2024-02-10')],{opening_date:'2024-02-01',opening_balance:200},'2024-02','2024-03-01');assert.equal(s.end,'2024-02-29');assert.equal(s.opening,200);assert.equal(s.actual,180);
});
const lot={id:'l1',code:'Lote 1',status:'ativo',head_count:10,entry_date:'2026-10-01',entry_avg_weight_kg:400};
const weighing={id:'w',lot_id:'l1',date:'2026-10-16',avg_weight_kg:450,created_at:'2026-10-16T10:00:00Z'};
test('animais em lote usam cabeças presentes × última média e convertem rendimento de carcaça',()=>{
 const [r]=animalStock([lot],[],[weighing],[],50,false,'2026-10-18');assert.equal(r.head,10);assert.equal(r.totalKg,4500);assert.equal(r.liveArrobas,150);assert.equal(r.carcassArrobas,150);assert.match(r.warning,/incompleto/);
 assert.equal(animalStock([lot],[],[weighing],[],52,false,'2026-10-18')[0].carcassArrobas,156);
});
test('projeção pelo GMD é opcional e não altera a base da última pesagem',()=>{
 const [base]=animalStock([lot],[],[weighing],[],50,false,'2026-10-19');const [projected]=animalStock([lot],[],[weighing],[],50,true,'2026-10-19');assert.equal(base.average,450);assert.equal(projected.average,460);assert.equal(projected.date,'2026-10-16');
});
test('pesos individuais completos substituem a média e vendidos não somam novamente',()=>{
 const animals=[{id:'a',ear_tag:'Animal 1',lot_id:'l1',status:'ativo',current_weight_kg:440},{id:'b',ear_tag:'Animal 2',lot_id:'l1',status:'tratamento',current_weight_kg:460},{id:'sold',lot_id:null,status:'vendido',current_weight_kg:700}];
 const records=[{id:'ra',animal_id:'a',weighing_id:'w',weight_kg:440},{id:'rb',animal_id:'b',weighing_id:'w',weight_kg:460}];
 const rows=animalStock([{...lot,head_count:2}],animals,[weighing],records,50,false,'2026-10-18');assert.equal(rows.length,1);assert.equal(rows[0].totalKg,900);assert.equal(rows[0].estimated,false);
});
test('animais fora de lotes ativos são incluídos com aviso, sem inventar peso ausente',()=>{
 const rows=animalStock([], [{id:'a',status:'ativo',lot_id:null,current_weight_kg:450},{id:'b',status:'ativo',lot_id:null}],[],[],50,false,'2026-10-18');assert.equal(rows[0].head,2);assert.equal(rows[0].totalKg,450);assert.equal(rows[0].unknown,1);assert.equal(rows[0].average,null);
});
test('pesagem futura e lote encerrado não substituem o estoque presente',()=>{
 const rows=animalStock([lot,{...lot,id:'closed',status:'encerrado',head_count:999}],[],[{...weighing,date:'2026-11-01'}],[],50,false,'2026-10-18');assert.equal(rows.length,1);assert.equal(rows[0].totalKg,4000);
});
test('rendimento inválido não calcula arrobas silenciosamente',()=>{
 assert.throws(()=>animalStock([],[],[],[],0),/rendimento/);assert.throws(()=>animalStock([],[],[],[],NaN),/rendimento/);assert.throws(()=>animalStock([],[],[],[],101),/rendimento/);
});


test('projeção histórica mantém conta quitada só no mês seguinte como pendente ao fim do mês',()=>{
 const s=cashSummary([entry('saida',300,'2026-09-25','2026-10-05')],settings,'2026-09','2026-10-18');assert.equal(s.actual,10000);assert.equal(s.payable,300);assert.equal(s.projected,9700);
});
test('mês anterior à abertura não apresenta saldo inicial de uma data futura',()=>{
 const s=cashSummary([],{opening_date:'2026-10-01',opening_balance:10000},'2026-09','2026-10-18');assert.equal(s.actual,0);assert.equal(s.opening,0);
});
