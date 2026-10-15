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
  let document;
  jsPDF.API.save=function(){ document=this; return this; };
  try {
    await exportPdf(report);
    assert.ok(document.getNumberOfPages()>1);
    const text=document.output();
    assert.ok(text.includes('GMD'));
    assert.ok(text.includes('000179'));
    // Optional local QA outputs; never include real farm data in fixtures.
    if(process.env.EXPORT_QA_DIR){
      fs.mkdirSync(process.env.EXPORT_QA_DIR,{recursive:true});
      fs.writeFileSync(`${process.env.EXPORT_QA_DIR}/animais-exemplo.pdf`,Buffer.from(document.output('arraybuffer')));
    }
  } finally { jsPDF.API.save=save; }
});
