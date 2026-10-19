import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const format=url(compile(read('../src/lib/format.ts'))),constants=url(compile(read('../src/lib/constants.ts')));
const domain=url(compile(read('../src/lib/domain.ts').replace('from "./format"',`from "${format}"`).replace('from "./constants"',`from "${constants}"`)));
const loans=url(compile(read('../src/lib/loan-installments.ts')));
const stockDetail=url(compile(read('../src/lib/stock-animal-detail.ts').replace('from "./format"',`from "${format}"`)));
const logic=url(compile(read('../src/lib/financial-workspace.ts').replace('from "./format"',`from "${format}"`).replace('from "./domain"',`from "${domain}"`).replace('from "./stock-animal-detail"',`from "${stockDetail}"`)));
const mock=url(`
export const CashFlowExportButtons=ExportButtons;
export default function StockLotDetail(){}
export const useState=initial=>{const h=globalThis.__financeHarness,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>{h.state[i]=typeof v==='function'?v(h.state[i]):v;}];};
export const useAuth=()=>({isGestor:globalThis.__financeHarness.manager,tenant:{farmId:'farm'}});
const query=name=>({isLoading:false,isError:false,isSuccess:true,data:globalThis.__financeHarness[name],refetch:async()=>{}});
export const useFinancialWorkspace=()=>query('workspace');export const useLots=()=>query('lots');export const useAnimals=()=>query('animals');export const useWeighings=()=>query('weighings');export const useWeightRecords=()=>query('records');export const useDiets=()=>query('diets');export const useDietItems=()=>query('ingredients');
export const useLoanMutation=()=>({isPending:false,mutateAsync:async call=>{globalThis.__financeHarness.calls.push(call);return{created:1};}});
export const useWorkspaceMutation=()=>({isPending:false,mutateAsync:async call=>{const h=globalThis.__financeHarness;h.calls.push(call);if(h.fail)throw new Error('Falha de rede');return{};}});
export const toast={success:()=>{},error:message=>globalThis.__financeHarness.errors.push(message)};
export const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);export const number=s=>{const n=Number(s.replace(',','.'));return s.trim()&&Number.isFinite(n)?n:null;};
export function BackFinance(){}export function Metric(){}export function Pager(){}export function SettingsDialog(){}export function WorkspaceError(){}
export function Link(){}export const useSearchParams=()=>[new URLSearchParams(globalThis.__financeHarness.query??'aba=insumos')];export function Link2(){}export function Unlink(){}export function Check(){}export function Pencil(){}export function Plus(){}export function Settings2(){}export function Trash2(){}
export function PageHeader(){}export function PageLoading(){}export function ExportButtons(){}export function NumericField(){}export function TextField(){}export function SelectField(){}export function Button(){}
export function Dialog(){}export function DialogContent(){}export function DialogDescription(){}export function DialogHeader(){}export function DialogTitle(){}
`);
const component=async(path)=>{let source=compile(read(path));source=source.replace(/from\s+(['"])(.*?)\1/g,(_,q,name)=>`from "${name==='react/jsx-runtime'?import.meta.resolve(name):name==='@/lib/loan-installments'?loans:name==='@/lib/format'?format:name==='@/lib/financial-workspace'?logic:mock}"`);return(await import(url(source))).default;};
const Cash=await component('../src/pages/management/cash-flow.tsx'),Inventory=await component('../src/pages/management/inventory.tsx');
const fixture=()=>({state:[],cursor:0,calls:[],errors:[],manager:true,workspace:{settings:null,entries:[],items:[{id:'item',name:'Milho',category:'ingrediente',minimum_kg:10,quantity_kg:100,stock_value:200,updated_at:'version'}],movements:[],links:[]},lots:[],animals:[],weighings:[],records:[],diets:[{id:'diet',name:'Dieta',is_active:true}],ingredients:[{diet_id:'diet',ingredient:'RAÇÃO'}]});
const draw=(h,C)=>{globalThis.__financeHarness=h;h.cursor=0;return C();};
const nodes=root=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(root);return out;};
const field=(t,label)=>nodes(t).find(n=>n.props.label===label);
const button=(t,text)=>nodes(t).find(n=>n.type.name==='Button'&&(n.props.children===text||Array.isArray(n.props.children)&&n.props.children.includes(text)));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
// PageHeader actions são elementos reais passados por prop, fora da árvore de children.
const action=(t,text)=>button(t,text)??button(nodes(t).find(n=>n.type.name==='PageHeader').props.actions,text);
test('caixa valida vazio e salva compromisso em reais sem marcar pagamento',async()=>{
 const h=fixture();action(draw(h,Cash),'Novo lançamento').props.onClick();let tree=draw(h,Cash);button(tree,'Salvar lançamento').props.onClick();await flush();assert.equal(h.calls.length,0);
 field(tree,'Descrição').props.onChange('Compra de milho');tree=draw(h,Cash);field(tree,'Valor').props.onValueChange('125,90');tree=draw(h,Cash);button(tree,'Salvar lançamento').props.onClick();await flush();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].action,'save_entry');assert.equal(h.calls[0].payload.amount,125.9);assert.equal(h.calls[0].payload.settled_on,null);assert.equal(h.calls[0].payload.lot_id,null);assert.equal(h.calls[0].payload.expected,null);
});
test('caixa edita pagamento com versão e confirmação de data',async()=>{
 const h=fixture();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());h.workspace.entries=[{id:'e',direction:'saida',description:'Frete',category:'Fretes',amount:200,due_date:today,settled_on:null,lot_id:null,notes:'',updated_at:'version'}];
 let t=draw(h,Cash);nodes(t).find(n=>n.props['aria-label']==='Registrar pagamento ou recebimento').props.onClick();t=draw(h,Cash);assert.equal(field(t,'Data do pagamento/recebimento').props.value,today);button(t,'Salvar lançamento').props.onClick();await flush();assert.equal(h.calls[0].payload.expected,'version');assert.equal(h.calls[0].payload.settled_on,today);
});
test('estoque converte toneladas em kg e mantém custo por kg',async()=>{
 const h=fixture();action(draw(h,Inventory),'Registrar movimentação').props.onClick();let t=draw(h,Inventory);field(t,'Item').props.onChange('item');t=draw(h,Inventory);field(t,'Quantidade').props.onValueChange('1,5');t=draw(h,Inventory);field(t,'Unidade da quantidade').props.onChange('ton');t=draw(h,Inventory);field(t,'Custo entregue por kg (inclua frete)').props.onValueChange('2,10');t=draw(h,Inventory);button(t,'Confirmar movimentação').props.onClick();await flush();
 assert.equal(h.calls[0].payload.quantity_kg,1500);assert.equal(h.calls[0].payload.unit_cost,2.1);assert.equal(h.calls[0].action,'move');
});
test('vínculo de trato é explícito e usa ingrediente e item selecionados',async()=>{
 const h=fixture();button(draw(h,Inventory),'Vincular aos tratos').props.onClick();let t=draw(h,Inventory);field(t,'Dieta').props.onChange('diet');t=draw(h,Inventory);field(t,'Ingrediente da dieta').props.onChange('RAÇÃO');t=draw(h,Inventory);field(t,'Item a descontar').props.onChange('item');t=draw(h,Inventory);button(t,'Ativar vínculo').props.onClick();await flush();assert.deepEqual(h.calls[0],{action:'link',payload:{diet_id:'diet',ingredient:'RAÇÃO',item_id:'item'}});
});
test('reenvio de movimento após falha de rede mantém identificador',async()=>{
 const h=fixture();h.fail=true;action(draw(h,Inventory),'Registrar movimentação').props.onClick();let t=draw(h,Inventory);field(t,'Item').props.onChange('item');t=draw(h,Inventory);field(t,'Quantidade').props.onValueChange('10');t=draw(h,Inventory);field(t,'Custo entregue por kg (inclua frete)').props.onValueChange('0');button(draw(h,Inventory),'Confirmar movimentação').props.onClick();await flush();h.fail=false;button(draw(h,Inventory),'Confirmar movimentação').props.onClick();await flush();assert.equal(h.calls.length,2);assert.equal(h.calls[0].payload.id,h.calls[1].payload.id);
});
test('operador não recebe telas financeiras nem dados de estoque',()=>{
 const h=fixture();h.manager=false;assert.match(draw(h,Cash).props.children,/gestores/);h.state=[];assert.match(draw(h,Inventory).props.children,/gestores/);
});

test('aba A pagar inclui vencidos de meses anteriores e a exportação acompanha o filtro',()=>{
 const h=fixture();h.workspace.entries=[{id:'old',direction:'saida',description:'Frete vencido',category:'Fretes',amount:80,due_date:'2001-01-01',settled_on:null,lot_id:null,notes:'',updated_at:'v'}];let t=draw(h,Cash);button(t,'A pagar').props.onClick();t=draw(h,Cash);const header=nodes(t).find(n=>n.type.name==='PageHeader');const exporter=nodes(header.props.actions).find(n=>n.type.name==='ExportButtons');assert.equal(exporter.props.getReport().rows.length,1);assert.equal(exporter.props.getReport().rows[0][2],'Frete vencido');
});
