import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
// Executa os handlers reais. Dependências da interface e queries usam contratos controlados.
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const tagLogic=url(ts.transpileModule(fs.readFileSync(new URL('../src/lib/animal-registration.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const mock=url(`
export const useState=initial=>{const h=globalThis.__priceLot,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>{h.state[i]=typeof v==='function'?v(h.state[i]):v;}];};
export function AnimalTagsEditor(){}
export const useNextEarTag=()=>({data:{next:'101'},isLoading:false,refetch:async()=>{}});
export const locationName=p=>p.code;
export const productionSystems=[{value:"confinamento",label:"Confinamento"}],validSystems=()=>true,compatibleLocation=()=>true;
export const useFarm=()=>({data:{production_systems:["confinamento"],default_production_system:"confinamento"},isLoading:false,isSuccess:true});
export const useMemo=f=>f();export const useTranslation=()=>({t:k=>k});export const useNavigate=()=>()=>{};
export const useCreateLot=()=>({isPending:false,mutateAsync:async p=>{globalThis.__priceLot.saved.push(p);return{id:'new',...p.lot};}});
const query=data=>({data,isSuccess:true,isLoading:false});
export const useLots=()=>query([]),usePens=()=>query([{id:'p',code:'Curral 1',status:'ativo',capacity_head:100}]);
export const useDiets=()=>query([]),useDietItems=()=>query([]),useProtocols=()=>query([]);
export const computePenOccupancy=p=>p.map(pen=>({pen,free:100,head:0,capacity:100}));export const dietTotalKg=()=>null;
export const parseNumberInput=s=>{if(!String(s??'').trim())return null;const n=Number(String(s).replace(',','.'));return Number.isFinite(n)?n:null;};
export const formatNumber=(n,d=0)=>n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
export const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});export const todayIso=()=> '2026-10-18';
export const BREED_OPTIONS=[{value:'nelore',labelKey:'Nelore'}],CATEGORY_OPTIONS=[],SEX_OPTIONS=[],DEFAULT_TARGET_WEIGHT=550;
export class DuplicateEarTagsError extends Error{constructor(matches){super('duplicado');this.matches=matches;}}
export const mutateApp=async()=>globalThis.__priceLot.matches??[];export const cn=(...a)=>a.filter(Boolean).join(' ');export const toast={success:()=>{},error:e=>globalThis.__priceLot.errors.push(e)};
${['Link','PageHeader','NumericField','SelectField','TextField','StatusBadge','Dialog','DialogContent','DialogDescription','DialogFooter','DialogHeader','DialogTitle','Button','Card','CardContent','AlertTriangle','ArrowLeft','ArrowRight','Beef','Check','Loader2','Plus','Trash2'].map(n=>`export function ${n}(){}`).join('\n')}
`);
const code=ts.transpileModule(fs.readFileSync(new URL('../src/pages/lots/new/index.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from\s+(['"])(.*?)\1/g,(_,q,name)=>`from "${name==='react/jsx-runtime'?import.meta.resolve(name):name==='@/lib/animal-registration'?tagLogic:mock}"`);
const {default:NewLot}=await import(url(code));
const nodes=root=>{const r=[];const visit=v=>{if(Array.isArray(v))return v.forEach(visit);if(v?.props){r.push(v);visit(v.props.children);}};visit(root);return r;};
const render=h=>{globalThis.__priceLot=h;h.cursor=0;return NewLot();};
const field=(h,label,index=0)=>nodes(render(h)).filter(n=>n.props.label===label)[index];
const click=async(h,label)=>{const n=nodes(render(h)).find(n=>n.props.children===label||Array.isArray(n.props.children)&&n.props.children.includes(label));assert.ok(n,`botão ${label}`);assert.ok(!n.props.disabled);await n.props.onClick();};
const setup=async()=>{const h={state:[],cursor:0,saved:[],errors:[]};field(h,'field.headCount').props.onValueChange('2');field(h,'field.entryWeight').props.onValueChange('400');await click(h,'action.next');return h;};
const finish=async h=>{await click(h,'action.next');field(h,'field.pen').props.onChange('p');await click(h,'lots.new.create');await new Promise(r=>setImmediate(r));};
const text=h=>{const values=[];const visit=v=>{if(Array.isArray(v))return v.forEach(visit);if(v?.props)return visit(v.props.children);if(typeof v==='string'||typeof v==='number')values.push(v);};visit(render(h));return values.join(' ');};
test('por lote calcula total e envia preço por cabeça sem alterar pesos',async()=>{const h=await setup();field(h,'Preço de compra por animal (opcional)').props.onValueChange('3500,50');assert.match(text(h),/7\.001,00/);await finish(h);assert.equal(h.saved.length,1);assert.deepEqual(h.saved[0].purchase,{defaultPerHead:3500.5,animals:[]});assert.equal(h.saved[0].lot.entry_avg_weight_kg,400);assert.equal(h.saved[0].lot.head_count,2);});
test('valor é opcional e não reutiliza preço de outro modo',async()=>{const h=await setup();await finish(h);assert.equal(h.saved[0].purchase,undefined);const g=await setup();field(g,'Preço de compra por animal (opcional)').props.onValueChange('9999');await click(g,'lots.new.modeIndividual');for(const tag of ['1','2']){await click(g,'weighings.form.addAnimal');field(g,`field.earTag ${tag}`).props.onChange(tag);}await finish(g);assert.equal(g.saved[0].purchase,undefined);});
test('individual preserva pesos e preços distintos, inclusive zero',async()=>{const h=await setup();await click(h,'lots.new.modeIndividual');for(const tag of ['1','2']){await click(h,'weighings.form.addAnimal');field(h,`field.earTag ${tag}`).props.onChange(' '+tag+' ');}field(h,'field.weight',0).props.onValueChange('380');field(h,'field.weight',1).props.onValueChange('420');field(h,'Preço unitário (opcional)',0).props.onValueChange('3200,25');field(h,'Preço unitário (opcional)',1).props.onValueChange('0');await finish(h);assert.deepEqual(h.saved[0].purchase,{defaultPerHead:null,animals:[{earTag:'1',amount:3200.25},{earTag:'2',amount:0}]});assert.deepEqual(h.saved[0].animals.map(a=>a.entry_weight_kg),[380,420]);assert.equal(h.saved[0].lot.entry_avg_weight_kg,400);});
test('preço inválido impede avanço e não grava',async()=>{for(const price of ['-1','inválido','1000000000000']){const h=await setup();field(h,'Preço de compra por animal (opcional)').props.onValueChange(price);await click(h,'action.next');assert.ok(field(h,'Preço de compra por animal (opcional)'));assert.match(text(h),/preços de compra válidos/);assert.equal(h.saved.length,0);}});
test('conflito de brinco continua exigindo confirmação antes da alocação',async()=>{const h=await setup();await click(h,'lots.new.modeIndividual');for(const tag of ['1','2']){await click(h,'weighings.form.addAnimal');field(h,`field.earTag ${tag}`).props.onChange(tag);}field(h,'Preço unitário (opcional)',0).props.onValueChange('4000');h.matches=[{earTag:'1',lotCode:'Lote antigo'}];await click(h,'action.next');assert.equal(field(h,'field.pen'),undefined);assert.equal(h.saved.length,0);assert.match(text(h),/Estes brincos já estão em uso/);});

test('total e payload arredondam cada valor monetário para centavos',async()=>{const h=await setup();field(h,'Preço de compra por animal (opcional)').props.onValueChange('3500,555');assert.match(text(h),/7\.001,12/);await finish(h);assert.equal(h.saved[0].purchase.defaultPerHead,3500.56);});

const editor=h=>nodes(render(h)).find(n=>n.type.name==='AnimalTagsEditor');
test('por lote cria animais automaticamente e permite alterar a sequência preservando zeros',async()=>{const h=await setup();assert.ok(editor(h));editor(h).props.onChange({kind:'sequence',start:'009',list:''});await finish(h);assert.deepEqual(h.saved[0].animals.map(a=>a.ear_tag),['009','010']);assert.deepEqual(h.saved[0].animals.map(a=>a.entry_weight_kg),[400,400]);assert.equal(h.saved[0].lot.head_count,2);});
test('por lote aceita lista não sequencial e impede quantidade errada',async()=>{const h=await setup();editor(h).props.onChange({kind:'list',start:null,list:'AZ-1;AZ-3'});await finish(h);assert.deepEqual(h.saved[0].animals.map(a=>a.ear_tag),['AZ-1','AZ-3']);const g=await setup();editor(g).props.onChange({kind:'list',start:null,list:'AZ-1'});await click(g,'action.next');assert.equal(g.saved.length,0);assert.ok(editor(g));});
test('automático pode ser desmarcado para manter somente médias',async()=>{const h=await setup();nodes(render(h)).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:false}});await finish(h);assert.deepEqual(h.saved[0].animals,[]);});
test('sequência automática também exige confirmação dos conflitos entre lotes',async()=>{const h=await setup();h.matches=[{earTag:'101',lotCode:'Outro lote'}];await click(h,'action.next');assert.equal(field(h,'field.pen'),undefined);assert.equal(h.saved.length,0);assert.match(text(h),/Estes brincos já estão em uso/);});
