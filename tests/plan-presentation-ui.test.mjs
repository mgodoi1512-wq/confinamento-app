import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Renderiza os componentes reais com respostas autenticadas de teste, sem Asaas.
const uiNames = ['Button','Card','CardContent','CardHeader','CardTitle','Input',
  'AlertDialog','AlertDialogAction','AlertDialogCancel','AlertDialogContent',
  'AlertDialogDescription','AlertDialogFooter','AlertDialogHeader','AlertDialogTitle','AlertDialogTrigger'];
const billingNames = ['getMyPlan','getProductionPlan','productionPayment','productionSubscription',
  'productionAnnual','sandboxPayment','sandboxSubscription','getProductionPix'];
const fixture = () => globalThis.__planPresentation;
globalThis.__planPresentation = {};
const result = await build({
  stdin: { contents: 'export {default as MyPlan} from "./src/pages/config/plan"; export {PlanPixDialog} from "./src/components/app/plan-pix-dialog";', resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
  external: ['react','react/jsx-runtime','lucide-react'],
  plugins: [{name:'authenticated-fixtures',setup(b){
    b.onResolve({filter:/^(@\/hooks\/use-auth|@tanstack\/react-query|react-router-dom|@\/lib\/billing|@\/components\/ui\/|@radix-ui\/react-dialog|sonner)/}, a=>({path:a.path,namespace:'fixture'}));
    b.onResolve({filter:/^@\//},a=>({path:fileURLToPath(new URL('../src/'+a.path.slice(2)+(a.path.endsWith('utils')||a.path.endsWith('signup-plan')?'.ts':'.tsx'),import.meta.url))}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>{
      const f='globalThis.__planPresentation'; let contents;
      if(a.path==='@/hooks/use-auth') contents=`export const useAuth=()=>${f}.auth;`;
      else if(a.path==='@tanstack/react-query') contents=`export const useQuery=()=>${f}.query; export const useQueryClient=()=>({invalidateQueries:async()=>{}});export const useMutation=()=>({isPending:false,mutate:()=>{}});`;
      else if(a.path==='react-router-dom') contents=`import React from 'react';export const useNavigate=()=>()=>{};export const useSearchParams=()=>[new URLSearchParams(globalThis.__planPresentation.search??'')]; export const Link=({children})=>React.createElement('a',null,children);`;
      else if(a.path==='@/lib/billing') contents=`export const billingMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);`+billingNames.map(n=>`export const ${n}=async()=>{};`).join('');
      else if(a.path==='sonner') contents='export const toast={success:()=>{},error:()=>{},info:()=>{}};';
      else if(a.path==='@radix-ui/react-dialog') contents=`import React from 'react'; const C=({children})=>React.createElement('div',null,children);`+['Root','Portal','Overlay','Content','Close','Title','Description'].map(n=>`export const ${n}=C;`).join('');
      else contents=`import React from 'react'; const C=({children,disabled})=>React.createElement('div',disabled?{'data-disabled':'true'}:null,children);`+uiNames.map(n=>`export const ${n}=C;`).join('');
      return {contents,loader:'js'};
    });
  }}],
});
const bundleDir=await fs.mkdtemp(new URL('./.tmp-plan-',import.meta.url));
const bundle=pathToFileURL(join(bundleDir,'plan-presentation-ui-bundle.mjs'));
let components;
try {
  await fs.writeFile(bundle,result.outputFiles[0].contents);
  components=await import(bundle.href);
} finally {
  await fs.rm(bundleDir,{recursive:true,force:true});
}
const {MyPlan,PlanPixDialog}=components;
const order=(status)=>({id:'order',archived:false,plan:'monthly',method:'PIX',amountCents:2490,status,invoiceUrl:null,validFrom:null,validUntil:null,checkedAt:null,createdAt:'2026-10-18'});
const overview=(orders,extra={})=>({environment:'production',mode:'automatic',monthlyCents:2490,annualCents:24990,isOwner:true,canTest:true,canCreate:true,orders,...extra});
function setup(data){
  fixture().auth={user:{id:'owner'},tenant:{farmId:'farm',billingFarmId:'farm',billingOwner:true,billingMode:'automatic'},approved:true,refreshProfile:async()=>{}};
  fixture().query={data,isPending:false,isError:false,isFetching:false,refetch:async()=>{}};
}
test('Atualizar situação aparece apenas para pagamentos pendentes não arquivados',()=>{
  for(const status of ['RECEIVED','CONFIRMED','DELETED','REFUNDED','AUTHORIZED','AWAITING_RISK_ANALYSIS']){
    setup(overview([order(status)]));const html=renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true}));assert.ok(!html.includes('Atualizar situação'),status);
  }
  for(const status of ['PENDING','OVERDUE']){setup(overview([order(status)]));assert.ok(renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true})).includes('Atualizar situação'));}
  setup(overview([{...order('PENDING'),archived:true}]));assert.ok(!renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true})).includes('Atualizar situação'));
});
test('cortesia mostra prazo, encerramento ou ausência de vencimento',()=>{
  for(const [courtesy,expected] of [
    [{enabled:true,active:true,expiresOn:'2026-11-17'},'Sua cortesia expira em 17/11/2026'],
    [{enabled:true,active:false,expiresOn:'2026-10-01'},'Sua cortesia expirou em 01/10/2026'],
    [{enabled:true,active:true,expiresOn:null},'Cortesia sem data de expiração definida.'],
  ]){setup(overview([],{courtesy}));const html=renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true}));assert.ok(html.includes('Plano cortesia'));assert.ok(html.includes(expected));}
});
test('Pix recebido mostra confirmação e entrada com nome da fazenda sem botão de atualização',()=>{
  setup(null);const html=renderToStaticMarkup(React.createElement(PlanPixDialog,{order:order('RECEIVED'),entryLabel:'Ir para Fazenda São Miguel',onEnter:()=>{},onClose:()=>{}}));
  assert.ok(html.includes('Pagamento confirmado!'));assert.ok(html.includes('Ir para Fazenda São Miguel'));assert.ok(!html.includes('Atualizar situação'));assert.ok(!html.includes('data:image/png'));
});
test('Pix confirmado em processamento ainda não anuncia recebimento',()=>{
  setup(null);const html=renderToStaticMarkup(React.createElement(PlanPixDialog,{order:order('CONFIRMED'),onEnter:()=>{},onClose:()=>{}}));assert.ok(!html.includes('Pagamento confirmado!'));assert.ok(html.includes('Aguardando confirmação do recebimento'));
});
test('plano pago não mantém aviso fixo de confirmação',()=>{
  setup(overview([order('RECEIVED')],{access:{allowed:true,reason:'paid'},farmName:'São Miguel'}));const html=renderToStaticMarkup(React.createElement(MyPlan));assert.ok(!html.includes('Pagamento confirmado!'));assert.ok(!html.includes('Ir para Fazenda São Miguel'));
});
test('anual cancelado sem pagamento continua apenas no histórico',()=>{
  setup(overview([{...order('DELETED'),installmentCount:12}],{annualPurchase:{id:'order',status:'DELETED',cancelState:'CANCELLED',active:false,validFrom:null,amountCents:24990,installmentCount:12}}));const html=renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true}));assert.ok(!html.includes('Consultar contratação'));assert.ok(html.includes('Cancelado'));
});

test('entrada após a barreira de pagamento permanece disponível sem aviso fixo ou nome duplicado',()=>{
  setup(overview([order('RECEIVED')],{access:{allowed:true,reason:'paid'},farmName:'Fazenda São Miguel'}));const html=renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true}));assert.ok(!html.includes('Pagamento confirmado!'));assert.ok(html.includes('Ir para Fazenda São Miguel'));assert.ok(!html.includes('Fazenda Fazenda'));
});

test('contratação recupera escolha da conta após novo login e permite alterar plano',()=>{
  for(const plan of ['monthly','annual']){
    setup(overview([]));fixture().auth.user.user_metadata={preferred_plan:plan};
    const html=renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true}));
    assert.match(html,new RegExp('name="plan"[^>]*checked=""[^>]*value="'+plan+'"'));assert.match(html,/Selecionar mensal/);assert.match(html,/Selecionar anual/);
  }
});
test('escolha explícita válida tem prioridade; contrato existente permanece soberano',()=>{
  setup(overview([]));fixture().auth.user.user_metadata={preferred_plan:'annual'};fixture().search='plano=monthly';
  let html=renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true}));assert.match(html,/name="plan"[^>]*checked=""[^>]*value="monthly"/);
  setup(overview([],{subscription:{id:'sub',plan:'monthly',status:'ACTIVE',amountCents:2490,method:'PIX'}}));fixture().search='plano=annual';
  html=renderToStaticMarkup(React.createElement(MyPlan,{forceProduction:true}));assert.match(html,/name="plan"[^>]*checked=""[^>]*value="monthly"/);fixture().search='';
});
