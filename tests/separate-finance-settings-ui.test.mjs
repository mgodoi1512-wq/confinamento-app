import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const source=fs.readFileSync(new URL('../src/pages/management/workspace/shared.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
assert.equal((compiled.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const mock=url(`
export const useState=initial=>{const h=globalThis.__settingsHarness,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>{h.state[i]=v;}];};
export const useWorkspaceMutation=()=>({isPending:false,mutateAsync:async call=>{globalThis.__settingsHarness.calls.push(call);return{};}});
export const toast={success:()=>{},error:m=>globalThis.__settingsHarness.errors.push(m)};
export const todayIso=()=> '2026-10-18';export const number=s=>{if(!s.trim())return null;const n=Number(s.replace(',','.'));return Number.isFinite(n)?n:null;};
export function ArrowLeft(){}export function RefreshCw(){}export function Link(){}export function Button(){}export function NumericField(){}export function TextField(){}export function Dialog(){}export function DialogContent(){}export function DialogDescription(){}export function DialogHeader(){}export function DialogTitle(){}
`);
const code=compiled.outputText.replace(/from\s+(['"])(.*?)\1/g,(_,q,name)=>`from "${name==='react/jsx-runtime'?import.meta.resolve(name):mock}"`);
const {SettingsDialog}=await import(url(code));
const base={opening_date:'2026-09-01',opening_balance:12345.67,carcass_yield:50,arroba_price:360,updated_at:'version'};
const fixture=()=>({state:[],cursor:0,calls:[],errors:[]});
const draw=(h,mode,settings=base)=>{globalThis.__settingsHarness=h;h.cursor=0;return SettingsDialog({settings,open:true,mode,onOpenChange:()=>{}});};
const nodes=t=>{const out=[];const visit=v=>{if(Array.isArray(v))return v.forEach(visit);if(v?.props){out.push(v);visit(v.props.children);}};visit(t);return out;};
const field=(t,label)=>nodes(t).find(n=>n.props.label===label);
const save=async t=>{nodes(t).find(n=>n.type.name==='Button').props.onClick();await new Promise(r=>setImmediate(r));};
test('estoque mostra só estimativa e não envia saldo nem data de abertura',async()=>{
 const h=fixture();let t=draw(h,'inventory');assert.equal(nodes(t).filter(n=>n.type.name==='NumericField').length,2);assert.equal(nodes(t).filter(n=>n.type.name==='TextField').length,0);
 field(t,'Preço da arroba para estimativa (opcional)').props.onValueChange('370');await save(draw(h,'inventory'));
 assert.deepEqual(h.calls,[{action:'estimate_settings',payload:{carcass_yield:50,arroba_price:370,expected:'version'}}]);
});
test('fluxo de caixa identifica saldo de abertura e envia configuração completa',async()=>{
 const h=fixture();let t=draw(h,'cash');assert.ok(field(t,'Saldo disponível no início do fluxo'));assert.ok(field(t,'Data de início do controle de caixa'));
 field(t,'Saldo disponível no início do fluxo').props.onValueChange('2000');await save(draw(h,'cash'));
 assert.equal(h.calls[0].action,'settings');assert.equal(h.calls[0].payload.opening_balance,2000);assert.equal(h.calls[0].payload.opening_date,'2026-09-01');
});
test('estoque sem configuração não envia uma abertura de caixa implícita',async()=>{
 const h=fixture();await save(draw(h,'inventory',null));assert.equal(h.calls[0].action,'estimate_settings');assert.equal('opening_balance' in h.calls[0].payload,false);assert.equal('opening_date' in h.calls[0].payload,false);
});
test('preço inválido impede gravação sem alterar saldo',async()=>{
 const h=fixture();let t=draw(h,'inventory');field(t,'Preço da arroba para estimativa (opcional)').props.onValueChange('-1');await save(draw(h,'inventory'));assert.equal(h.calls.length,0);assert.equal(h.errors.length,1);
});
test('caixa ainda não configurado sugere abertura de hoje com saldo zero',()=>{
 const h=fixture(),t=draw(h,'cash',{...base,cash_configured:false});assert.equal(field(t,'Data de início do controle de caixa').props.value,'2026-10-18');assert.equal(field(t,'Saldo disponível no início do fluxo').props.value,'0');
});
test('resumo do caixa ignora abertura provisória criada apenas para estimativa',async()=>{
 const source=fs.readFileSync(new URL('../src/lib/financial-workspace.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from\s+(['"])(.*?)\1/g,()=>`from "${url("export const todayIso=()=> '2026-10-18';export const daysBetween=()=>0;export const computeLotMetrics=()=>null;export const stockAnimalDetails=()=>[];export const stockProjectionSummary=()=>({label:'',description:''});")}"`);
 const {cashSummary}=await import(url(code));const s=cashSummary([],{...base,cash_configured:false},'2026-10','2026-10-18');assert.equal(s.actual,0);assert.equal(s.opening,0);
});
