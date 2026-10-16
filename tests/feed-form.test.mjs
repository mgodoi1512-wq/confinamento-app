import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Executa o componente e seus handlers reais com queries/estado controlados.
// Não substitui um teste visual de navegador.
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const format=url(compile(read('../src/lib/format.ts')));
const constants=url(compile(read('../src/lib/constants.ts')));
const domain=url(compile(read('../src/lib/domain.ts').replace('from "./format"',`from "${format}"`).replace('from "./constants"',`from "${constants}"`)));
const mock=url(`
export const useState=initial=>{const h=globalThis.__feedHarness;const i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],value=>{h.state[i]=typeof value==='function'?value(h.state[i]):value;}];};
export const useMemo=fn=>fn();
export const useTranslation=()=>({t:key=>key});
export const useNavigate=()=>()=>{};export const cn=(...values)=>values.filter(Boolean).join(' ');
export const useProtocols=()=>query('protocols');export const useCreateLot=()=>({isPending:false});
export function Link(){} export function PageHeader(){} export function StatusBadge(){} export function Card(){} export function CardContent(){}
export function ArrowLeft(){} export function ArrowRight(){} export function Beef(){} export function Check(){} export function Plus(){} export function Trash2(){}
export const toast={success:()=>{},error:()=>{}};
const query=name=>({data:globalThis.__feedHarness[name],isSuccess:globalThis.__feedHarness.ready,isLoading:false,isError:false,refetch:async()=>{}});
export const useLots=()=>query('lots');export const usePens=()=>query('pens');export const useDiets=()=>query('diets');export const useDietItems=()=>query('items');export const useWeighings=()=>query('weighings');
export const useSaveFeedLog=()=>({isPending:false,mutateAsync:async value=>{globalThis.__feedHarness.saved.push(value);return value;}});
export function SelectField(){} export function NumericField(){} export function TextField(){} export function Button(){}
export function Dialog(){} export function DialogContent(){} export function DialogFooter(){} export function DialogDescription(){} export function DialogHeader(){} export function DialogTitle(){} export function DialogTrigger(){}
`);
let source=compile(read('../src/pages/feed/feed-form-dialog.tsx'));
source=source.replace(/from\s+(['"])(.*?)\1/g,(whole,quote,name)=>{
 const target=name==='react/jsx-runtime'?import.meta.resolve(name):name==='@/lib/domain'?domain:name==='@/lib/constants'?constants:name==='@/lib/format'?format:mock;
 return `from "${target}"`;
});
const {FeedFormDialog}=await import(url(source));
let lotSource=compile(read('../src/pages/lots/new/index.tsx'));
lotSource=lotSource.replace(/from\s+(['"])(.*?)\1/g,(whole,quote,name)=>{
 const target=name==='react/jsx-runtime'?import.meta.resolve(name):name==='@/lib/domain'?domain:name==='@/lib/constants'?constants:name==='@/lib/format'?format:mock;
 return `from "${target}"`;
});
const {default:NewLot}=await import(url(lotSource));

const fixture=()=>({state:[],cursor:0,ready:true,saved:[],pens:[{id:'p',code:'Curral 01',status:'ativo'}],lots:[{id:'a',code:'Lote A',pen_id:'p',status:'ativo',head_count:10,entry_avg_weight_kg:400,entry_date:'2026-10-01',diet_id:'da'},{id:'b',code:'Lote B',pen_id:'p',status:'ativo',head_count:5,entry_avg_weight_kg:500,entry_date:'2026-10-01',diet_id:'db'}],diets:[{id:'da',name:'Dieta A',is_active:true},{id:'db',name:'Dieta B',is_active:true}],items:[{diet_id:'da',kg_per_head_day:0,body_weight_pct:1},{diet_id:'db',kg_per_head_day:0,body_weight_pct:2}],weighings:[]});
const render=h=>{globalThis.__feedHarness=h;h.cursor=0;return FeedFormDialog({trigger:null});};
const nodes=root=>{const result=[];const visit=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}if(value.props){result.push(value);visit(value.props.children);}};visit(root);return result;};
const select=tree=>nodes(tree).find(node=>node.props.label==='Curral e lote');
const field=(tree,label)=>nodes(tree).find(node=>node.props.label===label);
const save=tree=>nodes(tree).find(node=>node.type.name==='Button' && node.props.children==='action.save');

test('trato seleciona cada lote do mesmo curral com sua dieta, peso e quantidade',async()=>{
 const h=fixture();let tree=render(h);
 assert.deepEqual(select(tree).props.options.map(option=>option.value),['a','b']);
 select(tree).props.onChange('b');tree=render(h);
 assert.equal(field(tree,'field.headCount').props.value,'5');
 assert.equal(field(tree,'feed.kgPerHead').props.value,'10');
 assert.equal(save(tree).props.disabled,false);save(tree).props.onClick();await Promise.resolve();
 assert.equal(h.saved[0].lot_id,'b');assert.equal(h.saved[0].pen_id,'p');assert.equal(h.saved[0].diet_id,'db');assert.equal(h.saved[0].total_kg,50);
 select(render(h)).props.onChange('a');tree=render(h);
 assert.equal(field(tree,'field.headCount').props.value,'10');assert.equal(field(tree,'feed.kgPerHead').props.value,'4');
 save(tree).props.onClick();await Promise.resolve();assert.equal(h.saved[1].lot_id,'a');assert.equal(h.saved[1].total_kg,40);
 delete globalThis.__feedHarness;
});
test('trato não grava contexto incompleto e não lista curral em manutenção',()=>{
 const h=fixture();h.ready=false;let tree=render(h);assert.equal(select(tree).props.disabled,true);assert.equal(save(tree).props.disabled,true);
 h.ready=true;h.pens[0].status='manutencao';tree=render(h);assert.equal(select(tree).props.options.length,0);
 delete globalThis.__feedHarness;
});

test('novo lote oferece somente protocolos ativos e calcula o resumo percentual pelo peso informado',()=>{
 const h=fixture();h.protocols=[{id:'on',name:'Ativo',is_active:true},{id:'off',name:'Inativo',is_active:false}];
 const renderLot=()=>{globalThis.__feedHarness=h;h.cursor=0;return NewLot();};
 let tree=renderLot();field(tree,'field.headCount').props.onValueChange('10');field(tree,'field.entryWeight').props.onValueChange('400');
 const advance=()=>{tree=renderLot();const button=nodes(tree).find(node=>node.type.name==='Button' && Array.isArray(node.props.children) && node.props.children.includes('action.next'));assert.equal(button.props.disabled,false);button.props.onClick();};
 advance();advance();tree=renderLot();
 assert.deepEqual(field(tree,'field.protocol').props.options.map(option=>option.value),['on']);
 const checkbox=nodes(tree).find(node=>node.type==='input' && node.props.type==='checkbox');assert.equal(checkbox.props.checked,false);
 field(tree,'field.diet').props.onChange('da');tree=renderLot();
 assert.ok(nodes(tree).some(node=>node.type==='p' && String(node.props.children).includes('4,00 kg/cab/dia')));
 delete globalThis.__feedHarness;
});
