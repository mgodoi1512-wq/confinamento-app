import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),compile=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const stock=url(compile(read('../src/lib/feed-stock.ts')));
const mock=url(`
export const useState=initial=>{const h=globalThis.__dietStock,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>h.state[i]=typeof v==='function'?v(h.state[i]):v];};export const useMemo=fn=>fn();export const useTranslation=()=>({t:s=>s});export const useAuth=()=>({isGestor:true});
export const useDiets=()=>({data:globalThis.__dietStock.diets});export const useDietItems=()=>({data:globalThis.__dietStock.items});export const useFeedStock=()=>({data:globalThis.__dietStock.stock,isSuccess:true,isPending:false,isError:false});export const useSaveDiet=()=>({isPending:false,mutateAsync:async p=>globalThis.__dietStock.calls.push(p)});export const useDeleteDiet=()=>({isPending:false,mutateAsync:async id=>globalThis.__dietStock.deleted=id});
export const normalizeDietName=s=>s.toLowerCase(),formatNumber=(n,d=0)=>n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}),parseNumberInput=s=>s.trim()&&Number.isFinite(Number(s.replace(',','.')))?Number(s.replace(',','.')):null;export const toast={success:()=>{},error:()=>{}};
${['RefreshCw','DialogDescription','Info','MoreHorizontal','Pencil','PageLoading','Tooltip','TooltipContent','TooltipProvider','TooltipTrigger','DropdownMenu','DropdownMenuContent','DropdownMenuItem','DropdownMenuTrigger','AlertDialog','AlertDialogContent','AlertDialogHeader','AlertDialogTitle','AlertDialogDescription','AlertDialogFooter','AlertDialogCancel','Link','Package','BarChart3','Plus','Save','Trash2','EmptyState','NumericField','PageHeader','StatusBadge','SelectField','TextField','Button','Card','CardContent','CardHeader','CardTitle','Dialog','DialogContent','DialogFooter','DialogHeader','DialogTitle'].map(n=>`export function ${n}(){}`).join('\n')}
`);
const source=compile(read('../src/pages/config/diets.tsx')).replace(/from\s+(['"])(.*?)\1/g,(_,q,n)=>`from "${n==='react/jsx-runtime'?import.meta.resolve(n):n==='@/lib/feed-stock'?stock:mock}"`),{default:C}=await import(url(source));
const fixture=()=>({state:[],cursor:0,calls:[],diets:[{id:'d',name:'Dieta',is_active:true}],items:[{id:'old',diet_id:'d',ingredient:'RAÇÃO',kg_per_head_day:0,body_weight_pct:2}],stock:{items:[{id:'r',name:'Ração 80-15-5',category:'racao',quantity_kg:0}],links:[{diet_id:'d',ingredient:'RAÇÃO',item_id:'r'}]}});
const draw=h=>{globalThis.__dietStock=h;h.cursor=0;return C();},nodes=t=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(t);return out;};
const button=(h,text)=>nodes(draw(h)).find(n=>n.type.name==='Button'&&(n.props.children===text||Array.isArray(n.props.children)&&n.props.children.includes(text)));
test('edição recupera vínculo e salva ingrediente, percentual e estoque juntos, inclusive saldo zero',async()=>{const h=fixture();button(h,'action.edit').props.onClick();let t=draw(h);const field=nodes(t).find(n=>n.props.label==='Ingrediente do estoque');assert.equal(field.props.value,'r');assert.ok(field.props.options[0].labelKey.includes('0,000 kg'));button(h,'action.save').props.onClick();await new Promise(r=>setImmediate(r));assert.equal(h.calls[0].stockLinked,true);assert.equal(h.calls[0].items[0].ingredient,'RAÇÃO');assert.equal(h.calls[0].items[0].stock_item_id,'r');assert.equal(h.calls[0].items[0].body_weight_pct,2);});
test('dieta antiga sem vínculo precisa de escolha explícita e não é vinculada por nome semelhante',async()=>{const h=fixture();h.stock.links=[];button(h,'action.edit').props.onClick();button(h,'action.save').props.onClick();await new Promise(r=>setImmediate(r));assert.equal(h.calls.length,0);const field=nodes(draw(h)).find(n=>n.props.label==='Ingrediente do estoque');assert.equal(field.props.value,'');field.props.onChange('r');button(h,'action.save').props.onClick();await new Promise(r=>setImmediate(r));assert.equal(h.calls.length,1);});

test('filtros combinam nome sem acento e situação e podem ser limpos',()=>{
 const h=fixture();h.diets.push({id:'x',name:'Adaptação inativa',is_active:false});
 let field=nodes(draw(h)).find(n=>n.props.label==='Buscar dieta ou ingrediente');field.props.onChange('adaptacao');
 assert.match(JSON.stringify(draw(h)),/Adaptação inativa/);assert.doesNotMatch(JSON.stringify(draw(h)),/Mais opções de Dieta/);
 nodes(draw(h)).find(n=>n.props.label==='Situação').props.onChange('active');
 assert.match(JSON.stringify(draw(h)),/Nenhuma dieta encontrada/);
 button(h,'Limpar filtros').props.onClick();assert.match(JSON.stringify(draw(h)),/Mais opções de Dieta/);
});
test('exclusão exige confirmação e cancelar não chama a mutação',async()=>{
 const h=fixture();const menu=()=>nodes(draw(h)).find(n=>n.type.name==='DropdownMenuItem');menu().props.onSelect();
 nodes(draw(h)).find(n=>n.type.name==='AlertDialog').props.onOpenChange(false);assert.equal(h.deleted,undefined);
 menu().props.onSelect();button(h,'Excluir dieta').props.onClick();await new Promise(r=>setImmediate(r));assert.equal(h.deleted,'d');
});
test('editor usa vírgula e salva kg diários sem converter em percentual',async()=>{
 const h=fixture();h.items[0].body_weight_pct=0.3;button(h,'action.edit').props.onClick();
 assert.equal(nodes(draw(h)).find(n=>n.props.label==='Quantidade diária').props.value,'0,3');
 nodes(draw(h)).find(n=>n.props.label==='Unidade').props.onChange('kg');
 nodes(draw(h)).find(n=>n.props.label==='Quantidade diária').props.onValueChange('1,25');
 button(h,'action.save').props.onClick();await new Promise(r=>setImmediate(r));
 assert.equal(h.calls[0].items[0].body_weight_pct,null);assert.equal(h.calls[0].items[0].kg_per_head_day,1.25);assert.equal(h.calls[0].items[0].stock_item_id,'r');
});
