import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Executa o componente e seus handlers reais com queries/estado controlados.
// Não substitui um teste visual de navegador.
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const locationLogic=url(compile(read('../src/lib/location-name.ts')));
const format=url(compile(read('../src/lib/format.ts')));
const constants=url(compile(read('../src/lib/constants.ts')));
const domain=url(compile(read('../src/lib/domain.ts').replace('from "./format"',`from "${format}"`).replace('from "./constants"',`from "${constants}"`)));
const tagLogic=url(compile(read('../src/lib/animal-registration.ts')));
const systemsLogic=url(compile(read('../src/lib/production-systems.ts')));
const stockLogic=url(compile(read('../src/lib/feed-stock.ts')));
const planning=url(compile(read('../src/lib/feed-planning.ts')));
const mock=url(`
export const useState=initial=>{const h=globalThis.__feedHarness;const i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],value=>{h.state[i]=typeof value==='function'?value(h.state[i]):value;}];};
export const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function AnimalTagsEditor(){}
export const useNextEarTag=()=>({data:{next:"101"},isLoading:false,refetch:async()=>{}});
export const useMemo=fn=>fn();export const useRef=value=>{const h=globalThis.__feedHarness;const i=h.cursor++;if(!(i in h.state))h.state[i]={current:value};return h.state[i];};
export const useAuth=()=>({isGestor:true});
export class DuplicateEarTagsError extends Error{constructor(matches){super('duplicado');this.matches=matches;}}
export const mutateApp=async(operation,payload)=>{const h=globalThis.__feedHarness;h.tagChecks??=[];h.tagChecks.push({operation,payload});if(h.tagCheckError)throw new Error(h.tagCheckError);return h.tagMatches??[];};
export const useTranslation=()=>({t:key=>key});
export const useNavigate=()=>()=>{};export const cn=(...values)=>values.filter(Boolean).join(' ');
export const useProtocols=()=>query('protocols');export const useCreateLot=()=>({isPending:false,mutateAsync:async payload=>{globalThis.__feedHarness.saved.push(payload);return{id:'created',...payload.lot};}});
export function Link(){} export function PageHeader(){} export function StatusBadge(){} export function Card(){} export function CardContent(){}
export function AlertTriangle(){} export function Loader2(){} export function LockKeyhole(){} export function ArrowLeft(){} export function ArrowRight(){} export function Beef(){} export function Check(){} export function Plus(){} export function Trash2(){}
export const toast={success:()=>{},error:()=>{}};
const query=name=>({data:globalThis.__feedHarness[name],isSuccess:globalThis.__feedHarness.ready,isLoading:false,isError:false,refetch:async()=>({data:globalThis.__feedHarness[name],isError:false})});
export const useFarm=()=>({...query('farm'),data:{production_systems:['confinamento','semiconfinamento','pasto'],default_production_system:'confinamento'}});export const useLots=()=>query('lots');export const usePens=()=>query('pens');export const useDiets=()=>query('diets');export const useDietItems=()=>query('items');export const useWeighings=()=>query('weighings');
export const useDailyFeedPlans=()=>query('plans');export const useFarmFeedSettings=()=>query('settings');
export const useSaveFeedSchedule=()=>({isPending:false,mutateAsync:async()=>{}});
export const useRecordPlannedFeed=()=>({isPending:false,mutateAsync:async({payload})=>{
 const h=globalThis.__feedHarness;const log={lot_id:payload.lotId,shift:payload.shift,date:payload.date,pen_id:h.lots.find(l=>l.id===payload.lotId).pen_id,diet_id:payload.dietId,total_kg:Math.round(payload.actualKgPerHead*payload.headCount*100)/100};h.saved.push(log);h.logs.push(log);return log;
}});
export const useFeedLogs=()=>query('logs');
export const useFeedStock=()=>{const h=globalThis.__feedHarness;const list=[...h.items.map(i=>({dietId:i.diet_id,name:i.ingredient})),...h.plans.flatMap(p=>(p.ingredients??[]).map(i=>({dietId:p.diet_id,name:i.name})))];const data=h.stock??{items:[...new Set(list.map(i=>i.name))].map(name=>({id:'stock-'+name,name,category:'racao',quantity_kg:1000000})),links:list.map(i=>({diet_id:i.dietId,ingredient:i.name,item_id:'stock-'+i.name}))};return{data,isSuccess:h.ready,isLoading:false,isError:false,refetch:async()=>({data})};};

export const useSaveFeedLog=()=>({isPending:false,mutateAsync:async value=>{globalThis.__feedHarness.saved.push(value);return value;}});
export function SelectField(){} export function NumericField(){} export function TextField(){} export function Button(){}
export function Dialog(){} export function DialogContent(){} export function DialogFooter(){} export function DialogDescription(){} export function DialogHeader(){} export function DialogTitle(){} export function DialogTrigger(){}
`);
let source=compile(read('../src/pages/feed/feed-form-dialog.tsx'));
source=source.replace(/from\s+(['"])(.*?)\1/g,(whole,quote,name)=>{
 const target=name==='react/jsx-runtime'?import.meta.resolve(name):name==='@/lib/location-name'?locationLogic:name==='@/lib/animal-registration'?tagLogic:name==='@/lib/production-systems'?systemsLogic:name==='@/lib/feed-stock'?stockLogic:name==='@/lib/feed-planning'?planning:name==='@/lib/domain'?domain:name==='@/lib/constants'?constants:name==='@/lib/format'?format:mock;
 return `from "${target}"`;
});
const {FeedFormDialog}=await import(url(source));
let lotSource=compile(read('../src/pages/lots/new/index.tsx'));
lotSource=lotSource.replace(/from\s+(['"])(.*?)\1/g,(whole,quote,name)=>{
 const target=name==='react/jsx-runtime'?import.meta.resolve(name):name==='@/lib/location-name'?locationLogic:name==='@/lib/animal-registration'?tagLogic:name==='@/lib/production-systems'?systemsLogic:name==='@/lib/feed-stock'?stockLogic:name==='@/lib/feed-planning'?planning:name==='@/lib/domain'?domain:name==='@/lib/constants'?constants:name==='@/lib/format'?format:mock;
 return `from "${target}"`;
});
const {default:NewLot}=await import(url(lotSource));

const fixture=()=>({state:[],cursor:0,ready:true,saved:[],logs:[],plans:[],settings:null,pens:[{id:'p',code:'Curral 01',status:'ativo'}],lots:[{id:'a',code:'Lote A',pen_id:'p',status:'ativo',head_count:10,entry_avg_weight_kg:400,entry_date:'2026-10-01',diet_id:'da'},{id:'b',code:'Lote B',pen_id:'p',status:'ativo',head_count:5,entry_avg_weight_kg:500,entry_date:'2026-10-01',diet_id:'db'}],diets:[{id:'da',name:'Dieta A',is_active:true},{id:'db',name:'Dieta B',is_active:true}],items:[{ingredient:'Ração A',diet_id:'da',kg_per_head_day:0,body_weight_pct:1},{ingredient:'Ração B',diet_id:'db',kg_per_head_day:0,body_weight_pct:2}],weighings:[]});
const render=h=>{globalThis.__feedHarness=h;h.cursor=0;return FeedFormDialog({trigger:null});};
const nodes=root=>{const result=[];const visit=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}if(value.props){result.push(value);visit(value.props.children);}};visit(root);return result;};
const select=tree=>nodes(tree).find(node=>node.props.label==='Local e lote');
const field=(tree,label)=>nodes(tree).find(node=>node.props.label===label);
const save=tree=>nodes(tree).find(node=>node.type.name==='Button' && node.props.children==='Registrar trato');

test('trato seleciona cada lote do mesmo curral e sugere somente um terço da dieta diária',async()=>{
 const h=fixture();let tree=render(h);
 assert.deepEqual(select(tree).props.options.map(option=>option.value),['a','b']);
 select(tree).props.onChange('b');tree=render(h);
 assert.equal(field(tree,'field.headCount').props.value,'5');
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'3,333');
 assert.equal(save(tree).props.disabled,false);save(tree).props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.saved[0].lot_id,'b');assert.equal(h.saved[0].pen_id,'p');assert.equal(h.saved[0].diet_id,'db');assert.equal(h.saved[0].total_kg,16.67);
 select(render(h)).props.onChange('a');tree=render(h);
 assert.equal(field(tree,'field.headCount').props.value,'10');assert.equal(field(tree,'Oferta por animal neste trato').props.value,'1,333');
 save(tree).props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.saved[1].lot_id,'a');assert.equal(h.saved[1].total_kg,13.33);
 delete globalThis.__feedHarness;
});
test('trato não grava contexto incompleto e não lista curral em manutenção',()=>{
 const h=fixture();h.ready=false;let tree=render(h);assert.equal(select(tree).props.disabled,true);assert.equal(save(tree).props.disabled,true);
 h.ready=true;h.pens[0].status='manutencao';tree=render(h);assert.equal(select(tree).props.options.length,0);
 delete globalThis.__feedHarness;
});

test('novo lote oferece somente protocolos ativos e calcula o resumo percentual pelo peso informado',async()=>{
 const h=fixture();h.pens[0].capacity_head=100;h.protocols=[{id:'on',name:'Ativo',is_active:true},{id:'off',name:'Inativo',is_active:false}];
 const renderLot=()=>{globalThis.__feedHarness=h;h.cursor=0;return NewLot();};
 let tree=renderLot();field(tree,'field.headCount').props.onValueChange('10');field(tree,'field.entryWeight').props.onValueChange('400');
 const advance=async()=>{tree=renderLot();const button=nodes(tree).find(node=>node.type.name==='Button' && Array.isArray(node.props.children) && node.props.children.includes('action.next'));assert.equal(button.props.disabled,false);button.props.onClick();await new Promise(r=>setImmediate(r));};
 await advance();await advance();tree=renderLot();
 assert.deepEqual(field(tree,'field.protocol (opcional)').props.options.map(option=>option.value),['on']);
 const checkbox=nodes(tree).find(node=>node.type==='input' && node.props.type==='checkbox');assert.equal(checkbox.props.checked,false);
 field(tree,'field.diet (opcional)').props.onChange('da');tree=renderLot();
 assert.ok(nodes(tree).some(node=>node.type==='p' && String(node.props.children).includes('4,00 kg/cab/dia')));
 delete globalThis.__feedHarness;
});


test('trato detalha ingredientes pelo último peso, aplica parcela e informa dia inclusivo de entrada',()=>{
 const h=fixture();
 h.lots[0].entry_date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 h.weighings=[{id:'w',lot_id:'a',date:h.lots[0].entry_date,avg_weight_kg:392.2}];
 h.items=[{id:'i1',diet_id:'da',ingredient:'RAÇÃO',kg_per_head_day:0,body_weight_pct:0.3},{id:'i2',diet_id:'da',ingredient:'VOLUMOSO',kg_per_head_day:0,body_weight_pct:3}];
 let tree=render(h);select(tree).props.onChange('a');tree=render(h);
 const values=[];const visit=value=>{if(Array.isArray(value))return value.forEach(visit);if(value&&typeof value==='object')return visit(value.props?.children);if(value!==null&&value!==undefined)values.push(String(value));};visit(tree);
 const content=values.join(' ').replace(/\s+/g,' ');
 assert.match(content,/Dia 1 no manejo atual/);
 assert.match(content,/1,177/);assert.match(content,/11,766/);assert.match(content,/0,392/);assert.match(content,/3,922/);
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'4,314');
 field(tree,'Oferta por animal neste trato').props.onValueChange('6,5');tree=render(h);
 assert.ok(nodes(tree).some(node=>node.type==='p'&&JSON.stringify(node.props.children).includes('65,00')));
 field(tree,'feed.dietUsed').props.onChange('db');tree=render(h);
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'');
 delete globalThis.__feedHarness;
});

test('formulário reabre plano congelado, preserva dieta e não libera turno fornecido',()=>{
 const h=fixture();
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 h.plans=[{lot_id:'a',pen_id:'p',date,diet_id:'da',diet_name:'Nome original',head_count:10,average_weight_kg:400,daily_kg_per_head:13.2,daily_total_kg:132,ingredients:[{name:'Ração',bodyWeightPct:.3,dailyKgPerHead:1.2},{name:'Volumoso',bodyWeightPct:3,dailyKgPerHead:12}],schedule:[{shift:'manha',time:'08:00',percent:33.33},{shift:'tarde',time:'14:00',percent:33.33},{shift:'noite',time:'18:00',percent:33.34}]}];
 h.logs=[{lot_id:'a',pen_id:'p',date,shift:'manha',total_kg:44}];
 h.lots[0].entry_avg_weight_kg=900;h.diets[0].is_active=false;
 let tree=render(h);select(tree).props.onChange('a');tree=render(h);
 assert.equal(field(tree,'Peso vivo de referência').props.value,'400,000');
 assert.equal(field(tree,'feed.dietUsed').props.disabled,true);
 assert.equal(field(tree,'Quantos tratos hoje?').props.disabled,true);
 assert.ok(nodes(tree).some(n=>n.type==='button'&&n.props['aria-label']==='Selecionar trato: Tarde'&&n.props['aria-pressed']));
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'4,4');
 nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Selecionar trato: Manhã').props.onClick();tree=render(h);
 assert.ok(nodes(tree).some(n=>n.type.name==='Button'&&n.props.children==='Turno já registrado'&&n.props.disabled));
 delete globalThis.__feedHarness;
});


test('um trato pode ser somente noite; cartão inteiro escolhe o registro atual',()=>{
 const h=fixture();let tree=render(h);select(tree).props.onChange('a');tree=render(h);
 field(tree,'Quantos tratos hoje?').props.onChange('1');tree=render(h);
 const card=name=>nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Selecionar trato: '+name);
 card('Noite').props.onClick();tree=render(h);
 assert.equal(card('Noite').props['aria-pressed'],true);
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'4');
 assert.equal(save(tree).props.disabled,false);
 assert.ok(!nodes(tree).some(n=>n.props.label==='Horário'||n.props.label==='feed.shift'));
 card('Tarde').props.onClick();tree=render(h);
 assert.equal(card('Tarde').props['aria-pressed'],true);
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'4');
 delete globalThis.__feedHarness;
});

test('dois tratos permitem qualquer período e bloqueiam repetição ou excesso de registros',()=>{
 const h=fixture();let tree=render(h);select(tree).props.onChange('a');tree=render(h);
 field(tree,'Quantos tratos hoje?').props.onChange('2');tree=render(h);
 const card=name=>nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Selecionar trato: '+name);
 card('Noite').props.onClick();tree=render(h);assert.equal(save(tree).props.disabled,false);
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'2');
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 h.logs.push({lot_id:'a',date,shift:'noite',total_kg:20});
 card('Manhã').props.onClick();tree=render(h);assert.equal(save(tree).props.disabled,false);
 h.logs.push({lot_id:'a',date,shift:'manha',total_kg:20});tree=render(h);
 card('Tarde').props.onClick();tree=render(h);
 assert.ok(nodes(tree).some(n=>n.type.name==='Button'&&n.props.children==='Dia concluído'&&n.props.disabled));
 assert.equal(nodes(tree).filter(n=>n.type==='input'&&n.props.type==='checkbox').length,0);
 delete globalThis.__feedHarness;
});
test('peso e animais são referências bloqueadas, sem handlers de edição',()=>{
 const h=fixture();let tree=render(h);select(tree).props.onChange('a');tree=render(h);
 for(const label of ['Peso vivo de referência','field.headCount']){
  const node=field(tree,label);assert.equal(node.type.name,'LockedReference');assert.equal(node.props.onValueChange,undefined);
 }
 delete globalThis.__feedHarness;
});

test('abrir novo trato limpa curral, dieta, oferta, período e observações',()=>{
 const h=fixture();let tree=render(h);select(tree).props.onChange('a');tree=render(h);
 field(tree,'Oferta por animal neste trato').props.onValueChange('9');field(tree,'field.notes').props.onChange('Texto anterior');
 const dialog=nodes(tree).find(n=>n.type.name==='Dialog');dialog.props.onOpenChange(false);
 nodes(render(h)).find(n=>n.type.name==='Dialog').props.onOpenChange(true);tree=render(h);
 assert.equal(select(tree).props.value,'');assert.equal(field(tree,'feed.dietUsed').props.value,'');
 assert.equal(field(tree,'Oferta por animal neste trato').props.value,'');assert.equal(field(tree,'field.notes').props.value,'');
 assert.ok(nodes(tree).filter(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Selecionar trato:')).every(n=>!n.props['aria-pressed']));
 delete globalThis.__feedHarness;
});
test('lista omite lotes concluídos, mantém pendentes no mesmo curral e ignora tratos antigos',()=>{
 const h=fixture();const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 h.plans=[{lot_id:'a',meal_count:1,schedule:[{shift:'noite',percent:100}]}];
 h.logs=[{lot_id:'a',date,shift:'noite',total_kg:40},{lot_id:'b',date:'2020-01-01',shift:'manha',total_kg:50}];
 let tree=render(h);assert.deepEqual(select(tree).props.options.map(o=>o.value),['b']);
 h.plans.push({lot_id:'b',meal_count:2,schedule:[]});h.logs.push({lot_id:'b',date,shift:'manha',total_kg:25});tree=render(h);assert.deepEqual(select(tree).props.options.map(o=>o.value),['b']);
 h.logs.push({lot_id:'b',date,shift:'noite',total_kg:25});tree=render(h);assert.equal(select(tree).props.options.length,0);assert.equal(select(tree).props.disabled,true);
 h.logs.pop();tree=render(h);assert.equal(select(tree).props.options[0].value,'b','excluir trato libera novamente o lote');
 delete globalThis.__feedHarness;
});
test('último trato fecha e limpa o formulário, mantendo histórico e outros lotes disponíveis',async()=>{
 const h=fixture();let tree=render(h);select(tree).props.onChange('a');tree=render(h);
 field(tree,'Quantos tratos hoje?').props.onChange('1');tree=render(h);
 nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Selecionar trato: Noite').props.onClick();tree=render(h);
 save(tree).props.onClick();await new Promise(resolve=>setImmediate(resolve));tree=render(h);
 assert.equal(h.saved.length,1);assert.equal(select(tree).props.value,'');
 assert.equal(nodes(tree).find(n=>n.type.name==='Dialog').props.open,false);
 delete globalThis.__feedHarness;
});


test('brincos repetidos são conferidos antes da sanidade e a confirmação acompanha o salvamento',async()=>{
 const h=fixture();h.protocols=[];h.pens[0].capacity_head=100;h.tagMatches=[{earTag:'Animal 1',lotCode:'Lote 1'}];
 const draw=()=>{globalThis.__feedHarness=h;h.cursor=0;return NewLot();};
 const button=(tree,text)=>nodes(tree).find(n=>n.type.name==='Button'&&(n.props.children===text||Array.isArray(n.props.children)&&n.props.children.includes(text)));
 let tree=draw();field(tree,'field.headCount').props.onValueChange('1');field(tree,'field.entryWeight').props.onValueChange('400');
 await button(draw(),'action.next').props.onClick();
 tree=draw();nodes(tree).find(n=>n.type==='button'&&n.props.children==='lots.new.modeIndividual').props.onClick();
 button(draw(),'weighings.form.addAnimal').props.onClick();tree=draw();field(tree,'field.earTag 1').props.onChange(' Animal 1 ');
 await button(draw(),'action.next').props.onClick();tree=draw();
 assert.deepEqual(h.tagChecks,[{operation:'check_lot_ear_tags',payload:{tags:['Animal 1']}}]);
 assert.equal(field(tree,'field.protocol (opcional)'),undefined);assert.equal(h.saved.length,0);
 assert.ok(nodes(tree).some(n=>n.type==='td'&&n.props.children==='Lote 1'));
 button(tree,'Revisar brincos').props.onClick();tree=draw();assert.ok(field(tree,'field.earTag 1'));
 await button(tree,'action.next').props.onClick();button(draw(),'Continuar cadastro').props.onClick();tree=draw();
 assert.ok(field(tree,'field.protocol (opcional)'));field(tree,'field.pen').props.onChange('p');tree=draw();
 const final=nodes(tree).find(n=>n.type.name==='Button'&&n.props.onClick&&String(n.props.onClick).includes('submit'));
 final.props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.saved.length,1);assert.deepEqual(h.saved[0].confirmedDuplicateEarTags,['Animal 1']);
 delete globalThis.__feedHarness;
});

test('falha na consulta de brincos impede avanço para sanidade',async()=>{
 const h=fixture();h.protocols=[];h.pens[0].capacity_head=100;
 const draw=()=>{globalThis.__feedHarness=h;h.cursor=0;return NewLot();};
 const next=tree=>nodes(tree).find(n=>n.type.name==='Button'&&Array.isArray(n.props.children)&&n.props.children.includes('action.next'));
 let tree=draw();field(tree,'field.headCount').props.onValueChange('1');field(tree,'field.entryWeight').props.onValueChange('400');await next(draw()).props.onClick();
 tree=draw();nodes(tree).find(n=>n.type==='button'&&n.props.children==='lots.new.modeIndividual').props.onClick();
 tree=draw();nodes(tree).find(n=>n.type.name==='Button'&&Array.isArray(n.props.children)&&n.props.children.includes('weighings.form.addAnimal')).props.onClick();
 field(draw(),'field.earTag 1').props.onChange('Animal 1');h.tagCheckError='Sem conexão';await next(draw()).props.onClick();
 assert.ok(field(draw(),'field.earTag 1'));assert.equal(h.saved.length,0);delete globalThis.__feedHarness;
});

test('trato mostra déficit, bloqueia saldo insuficiente e exige vínculo de todos os componentes',()=>{const h=fixture();h.stock={items:[{id:'stock-a',name:'Ração pronta',category:'racao',quantity_kg:1}],links:[{diet_id:'da',ingredient:'Ração A',item_id:'stock-a'}]};let tree=render(h);select(tree).props.onChange('a');tree=render(h);assert.equal(save(tree).props.disabled,true);assert.ok(nodes(tree).some(n=>n.props.role==='alert'&&JSON.stringify(n.props.children).includes('Estoque insuficiente')));h.stock.items[0].quantity_kg=100;assert.equal(save(render(h)).props.disabled,false);h.stock.links=[];assert.equal(save(render(h)).props.disabled,true);});
