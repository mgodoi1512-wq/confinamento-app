import {build} from 'esbuild';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
const mock=`
export const useState=initial=>{const h=globalThis.__couponUI,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>h.state[i]=typeof v==='function'?v(h.state[i]):v];};export const useEffect=()=>{};
export const useAuth=()=>globalThis.__couponUI.auth;export const useNavigate=()=>()=>{};export const useSearchParams=()=>[new URLSearchParams()];
export const useQuery=options=>({data:options.queryKey[0]==='plan-coupons-admin'?globalThis.__couponUI.adminData:globalThis.__couponUI.plan,isPending:false,isError:false});export const useQueryClient=()=>({invalidateQueries:async()=>{}});
export const useMutation=opts=>({isPending:false,mutate:async value=>{try{opts.onMutate?.(value);const r=await opts.mutationFn(value);await opts.onSuccess?.(r,value);}catch(e){opts.onError?.(e);}finally{opts.onSettled?.();}},reset:()=>{}});
export const toast={success:()=>{},error:()=>{},info:()=>{}};
export const billingMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
${['productionSubscription','productionAnnual','sandboxSubscription','productionPayment','sandboxPayment','getMyPlan','getProductionPlan','getProductionPix'].map(n=>`export const ${n}=async(...args)=>{globalThis.__couponUI.calls.push({name:'${n}',args});return{ok:true};};`).join('')}
export const couponsAdmin=async()=>globalThis.__couponUI.adminData;export const couponQuote=async()=>globalThis.__couponUI.quote;
${['Link','Button','Card','CardContent','CardHeader','CardTitle','Input','AlertDialog','AlertDialogAction','AlertDialogCancel','AlertDialogContent','AlertDialogDescription','AlertDialogFooter','AlertDialogHeader','AlertDialogTitle','AlertDialogTrigger','AnnualPurchasePanel','PlanPixDialog','PlanCouponField','Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription'].map(n=>`export function ${n}(){}`).join('')}
`;
const result=await build({stdin:{contents:'export {default as MyPlan} from "./src/pages/config/plan";export {CouponAdmin} from "./src/components/app/coupon-admin";',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',external:['react/jsx-runtime','lucide-react'],plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^(react$|react-router-dom$|@tanstack\/react-query$|sonner$|@\/hooks\/use-auth$|@\/lib\/billing$|@\/lib\/plan-coupons$|@\/components\/ui\/|@\/components\/app\/(annual-purchase-panel|plan-pix-dialog|plan-coupon-field)$)/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock}));
 b.onResolve({filter:/^@\//},a=>({path:fileURLToPath(new URL('../src/'+a.path.slice(2)+'.ts',import.meta.url))}));
}}]});
const dir=await fs.mkdtemp(new URL('./.tmp-coupon-ui-',import.meta.url));let components;try{const path=join(dir,'bundle.mjs');await fs.writeFile(path,result.outputFiles[0].contents);components=await import(pathToFileURL(path).href);}finally{await fs.rm(dir,{recursive:true,force:true});}
const nodes=root=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(root);return out;};
const setup=()=>{const h={cursor:0,state:[],calls:[],auth:{user:{id:'owner'},tenant:{farmId:'farm',billingMode:'automatic',billingOwner:true},approved:true},plan:{environment:'production',mode:'automatic',isOwner:true,canTest:true,canCreate:true,monthlyCents:2490,annualCents:24990,billingVersion:'v1',orders:[],access:{allowed:false}},adminData:{coupons:[],uses:[]}};globalThis.__couponUI=h;return{h,draw:()=>{h.cursor=0;return components.MyPlan({forceProduction:true});}};};
const accept=t=>nodes(t).find(n=>n.type==='input'&&n.props.type==='checkbox');
const field=t=>nodes(t).find(n=>n.type.name==='PlanCouponField');
const quote={id:'quote-id',code:'LIBEN10',plan:'monthly',installments:1,originalCents:2490,discountCents:249,totalCents:2241,priceVersion:'v1',expiresAt:'2099-12-31T00:00:00Z'};
test('aplicar cupom retira autorização anterior e envia somente referência da cotação',async()=>{
 const{h,draw}=setup();accept(draw()).props.onChange({target:{checked:true}});field(draw()).props.onQuote(quote);assert.equal(accept(draw()).props.checked,false);
 const text=JSON.stringify(draw());assert.match(text,/Cupom /);assert.match(text,/22,41/);assert.match(text,/Próximas cobranças/);
 accept(draw()).props.onChange({target:{checked:true}});await nodes(draw()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(h.calls[0].name,'productionSubscription');assert.equal(h.calls[0].args[2],'quote-id');assert.equal(h.calls[0].args[0].amountCents,undefined);
});
test('mudar plano descarta a cotação incompatível; validação em andamento bloqueia contratação',async()=>{
 const{h,draw}=setup();field(draw()).props.onQuote(quote);field(draw()).props.onValidating(true);accept(draw()).props.onChange({target:{checked:true}});await nodes(draw()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.calls.length,0);
 field(draw()).props.onValidating(false);nodes(draw()).find(n=>n.type==='input'&&n.props.value==='annual').props.onChange();assert.doesNotMatch(JSON.stringify(draw()),/Cupom LIBEN10 aplicado/);
 accept(draw()).props.onChange({target:{checked:true}});await nodes(draw()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.calls[0].args[2],undefined);
});
test('admin exibe gestão de cupons e não é renderizado para usuário comum',()=>{
 const {h}=setup();h.auth.tenant.isAdmin=true;h.cursor=0;let tree=components.CouponAdmin();assert.match(JSON.stringify(tree),/Cupons de desconto/);assert.match(JSON.stringify(tree),/Novo cupom/);
 h.auth.tenant.isAdmin=false;h.cursor=0;tree=components.CouponAdmin();assert.equal(tree,null);
});
