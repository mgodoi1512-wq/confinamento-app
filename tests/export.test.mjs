import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const formatUrl = moduleUrl(read('../src/lib/format.ts'));
const constantsUrl = moduleUrl(read('../src/lib/constants.ts'));
const domainUrl = moduleUrl(read('../src/lib/domain.ts').replace('from "./constants"', `from "${constantsUrl}"`).replace('from "./format"', `from "${formatUrl}"`));
const { animalReport, lotReport } = await import(moduleUrl(read('../src/lib/export-data.ts').replace('from "./domain"', `from "${domainUrl}"`).replace('from "./format"', `from "${formatUrl}"`)));
let fileSource = read('../src/lib/export-files.ts').replace('from "./format"', `from "${formatUrl}"`);
for (const name of ['exceljs', 'jspdf', 'jspdf-autotable']) fileSource = fileSource.replace(`import("${name}")`, `import("${import.meta.resolve(name)}")`);
const { exportExcel, exportPdf } = await import(moduleUrl(fileSource));
const lot = { id:'l1', code:'Lote 01', pen_id:'p1', entry_date:'2026-10-01', entry_avg_weight_kg:400, head_count:2, status:'ativo' };
const weighing = { id:'w1',lot_id:'l1',date:'2026-10-11',created_at:'2026-10-11T12:00:00Z',avg_weight_kg:430 };
const animal = { id:'a1',lot_id:'l1',pen_id:'p1',ear_tag:'0000123',sisbov:'001234567890123',entry_weight_kg:400,current_weight_kg:430,status:'ativo',health_status:'saudavel' };
const record = { id:'r1',animal_id:'a1',weighing_id:'w1',weight_kg:430 };
const reportFor = (animals=[animal], weighings=[weighing], records=[record]) => animalReport(animals,[lot],[{id:'p1',code:'Curral 01'}],weighings,records,key=>key,'Lote: Lote 01','2026-10-21');

test('GMD individual usa a data da pesagem e preserva identificadores e filtros', () => {
  const report = reportFor();
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0][0],'0000123');
  assert.equal(report.rows[0][7],'11/10/2026');
  assert.equal(report.rows[0][9],3);
  assert.equal(report.filters,'Lote: Lote 01');
  assert.equal(reportFor([]).rows.length,0);
});
test('GMD não inventa datas: ausência, mesmo dia, outro lote e peso incompatível', () => {
  assert.equal(reportFor([animal],[],[]).rows[0][9],null);
  assert.equal(reportFor([animal],[{...weighing,date:lot.entry_date}]).rows[0][9],null);
  assert.equal(reportFor([animal],[{...weighing,lot_id:'outro'}]).rows[0][9],null);
  assert.equal(reportFor([{...animal,current_weight_kg:440}]).rows[0][9],null);
  assert.equal(reportFor([animal],[{...weighing,date:'2026-10-25'}]).rows[0][9],null);
});
test('pesagem retroativa não substitui a mais recente; perda e ganho zero são exportados', () => {
  const older = {...weighing,id:'w0',date:'2026-10-05'};
  assert.equal(reportFor([animal],[weighing,older],[record,{...record,id:'r0',weighing_id:'w0',weight_kg:410}]).rows[0][9],3);
  assert.equal(reportFor([{...animal,current_weight_kg:390}],[weighing],[{...record,weight_kg:390}]).rows[0][9],-1);
  assert.equal(reportFor([{...animal,current_weight_kg:400}],[weighing],[{...record,weight_kg:400}]).rows[0][9],0);
});
test('GMD do lote coincide com o indicador da plataforma', () => {
  const report=lotReport([lot],[],[weighing],key=>key,'Ativos','2026-10-21');
  assert.equal(report.rows[0][9],3);
});
test('Excel real mantém números, zeros iniciais, textos de fórmula e metadados', async () => {
  const report=reportFor([{...animal,ear_tag:'=1+1'},animal]);
  let savedBlob;
  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = blob => { savedBlob=blob; return 'blob:test'; };
  globalThis.document = {createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}};
  globalThis.window = {setTimeout(){}};
  try {
    await exportExcel(report);
    const book=new ExcelJS.Workbook();
    await book.xlsx.load(await savedBlob.arrayBuffer());
    const sheet=book.getWorksheet('Dados');
    assert.equal(sheet.getCell('A2').value,'=1+1');
    assert.equal(sheet.getCell('A3').value,'0000123');
    assert.equal(sheet.getCell('B3').value,'001234567890123');
    assert.equal(sheet.getCell('F3').value,400);
    assert.equal(sheet.getCell('J3').value,3);
    assert.equal(book.getWorksheet('Informações').getCell('B3').value,'Lote: Lote 01');
  } finally { URL.createObjectURL=originalCreate; delete globalThis.document; delete globalThis.window; }
});
test('PDF real pagina tabelas extensas e repete o cabeçalho', async () => {
  const report=reportFor();
  report.rows=Array.from({length:180},(_,index)=>[String(index).padStart(6,'0'),...report.rows[0].slice(1)]);
  const save=jsPDF.API.save;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async () => new Response(fs.readFileSync(new URL('../public/logo-liben-2.png',import.meta.url)), {status:200});
  let document;
  jsPDF.API.save=function(){ document=this; return this; };
  try {
    await exportPdf(report);
    assert.ok(document.getNumberOfPages()>1);
    const text=document.output();
    assert.ok(text.includes('GMD'));
    assert.ok(text.includes('/Subtype /Image'), 'Logo incorporada ao PDF');
    assert.ok(text.includes('000179'));
    // Optional local QA outputs; never include real farm data in fixtures.
    if(process.env.EXPORT_QA_DIR){
      fs.mkdirSync(process.env.EXPORT_QA_DIR,{recursive:true});
      fs.writeFileSync(`${process.env.EXPORT_QA_DIR}/animais-exemplo.pdf`,Buffer.from(document.output('arraybuffer')));
    }
  } finally { jsPDF.API.save=save; globalThis.fetch=originalFetch; }
});

const { computeFeedingSuggestions, feedingSuggestionReport, gradeForDay, splitDailyFeedKg }=await import(moduleUrl(read('../src/lib/feed-suggestion.ts').replace('from "./domain"',`from "${domainUrl}"`).replace('from "./format"',`from "${formatUrl}"`)));
test('sugestão aplica todos os limites da grade e não sobrepõe dia 15',()=>{
 for(const [day,feed,rough] of [[1,.3,3],[3,.3,3],[4,.8,2.5],[6,.8,2.5],[7,1.3,2],[9,1.3,2],[10,1.8,1.5],[12,1.8,1.5],[13,2.3,1],[15,2.3,1],[16,2.5,.8],[90,2.5,.8]]){
  const grade=gradeForDay(day);assert.equal(grade.feedPct,feed);assert.equal(grade.roughagePct,rough);
 }
 assert.equal(gradeForDay(0),null);assert.equal(gradeForDay(1.5),null);
});
test('sugestão usa dia inclusivo e peso médio; divide o lote em três refeições',()=>{
 const source={...lot,head_count:10,entry_date:'2026-10-01',entry_avg_weight_kg:400};
 let row=computeFeedingSuggestions([source],[],[],'2026-10-01')[0];
 assert.equal(row.day,1);assert.equal(row.feedDaily,12);assert.equal(row.roughageDaily,120);
 assert.deepEqual(row.meals.map(m=>[m.feedKg,m.roughageKg]),[[4,40],[4,40],[4,40]]);
 row=computeFeedingSuggestions([source],[],[{...weighing,date:'2026-10-01',avg_weight_kg:450},{...weighing,id:'future',date:'2026-10-20',avg_weight_kg:999}],'2026-10-01')[0];
 assert.equal(row.weight,450);assert.equal(row.feedDaily,13.5);
 assert.equal(computeFeedingSuggestions([source],[],[],'2026-10-16')[0].feedDaily,100);
});
test('arredondamento das refeições conserva os centavos do total diário',()=>{
 for(const value of [0,.01,.02,.03,.04,31.372,98.0375,120.01,999.99]){
  const parts=splitDailyFeedKg(value);assert.ok(parts.every(n=>n>=0));assert.equal(Math.round(parts.reduce((a,b)=>a+b,0)*100),Math.round(value*100));
 }
 assert.throws(()=>splitDailyFeedKg(NaN));
});
test('todos os lotes ativos são listados; pendências não ganham quantidades inventadas',()=>{
 const rows=computeFeedingSuggestions([
  {...lot,id:'b',code:'Lote 10',pen_id:'p10'},
  {...lot,id:'a',code:'Lote 2',pen_id:'p2'},
  {...lot,id:'invalid',code:'Sem peso',entry_avg_weight_kg:0},
  {...lot,id:'future',entry_date:'2026-11-01'},
  {...lot,id:'closed',status:'encerrado'},
 ],[{id:'p10',code:'Curral 10'},{id:'p2',code:'Curral 2'}],[],'2026-10-16');
 assert.equal(rows.length,4);assert.equal(rows[0].penCode,'Curral 2');
 assert.ok(rows.find(r=>r.lotId==='invalid').issue);assert.equal(rows.find(r=>r.lotId==='invalid').feedDaily,null);
 assert.equal(rows.find(r=>r.lotId==='future').day,null);
 const report=feedingSuggestionReport(rows,'Fazenda teste','2026-10-16');
 assert.equal(report.rows.length,5);assert.equal(report.pdf.format,'a4');assert.match(report.note,/apenas cálculos válidos/);
 assert.equal(feedingSuggestionReport([],'Teste','2026-10-16').rows.length,0);
});
test('PDF real da sugestão usa A4, logo e valores por refeição',async()=>{
 const fixtures=Array.from({length:10},(_,i)=>({...lot,id:`s${i}`,code:`Lote ${String(i+1).padStart(2,'0')}`,pen_id:`p${i}`,entry_avg_weight_kg:400+i*5,head_count:10,entry_date:formatAddDays('2026-09-16',i*3)}));
 const samplePens=fixtures.map((l,i)=>({id:l.pen_id,code:`Curral ${String(i+1).padStart(2,'0')}`}));
 const report=feedingSuggestionReport(computeFeedingSuggestions(fixtures,samplePens,[],'2026-10-16'),'Fazenda Exemplo - dados demonstrativos','2026-10-16');
 const originalSave=jsPDF.API.save,originalFetch=globalThis.fetch;let pdf;
 globalThis.fetch=async url=>new Response(fs.readFileSync(new URL(String(url).endsWith('.ttf')?'../public'+String(url):'../public/logo-liben-2.png',import.meta.url)),{status:200});
 jsPDF.API.save=function(){pdf=this;return this;};
 try{
  await exportPdf(report);
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth()-297)<.1);
  assert.ok(pdf.output().includes('/Subtype /Image'));assert.ok(pdf.output().includes('/FontFile2'));
  assert.equal(report.rows.at(-1)[0],'TOTAL');
  if(process.env.FEED_SUGGESTION_QA_DIR){fs.mkdirSync(process.env.FEED_SUGGESTION_QA_DIR,{recursive:true});fs.writeFileSync(`${process.env.FEED_SUGGESTION_QA_DIR}/sugestao-fornecimento-exemplo.pdf`,Buffer.from(pdf.output('arraybuffer')));}
 }finally{jsPDF.API.save=originalSave;globalThis.fetch=originalFetch;}
});
function formatAddDays(date,days){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
