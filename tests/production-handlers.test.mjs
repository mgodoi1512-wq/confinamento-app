import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const importHandler=async name=>{
 const code=ts.transpileModule(fs.readFileSync(new URL(`../supabase/functions/asaas-production-${name}/handler.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
const {createProductionCheckHandler}=await importHandler('check');
const {createProductionSubscriptionHandler}=await importHandler('subscription');
const {createProductionWebhookHandler}=await importHandler('webhook');
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const id='11111111-1111-4111-8111-111111111111';
const token='production-webhook-fixture-not-a-real-secret';
const env={APP_ALLOWED_ORIGINS:'https://liben-agro.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-private-service',ASAAS_PRODUCTION_API_KEY:'$aact_prod_fixture_only',ASAAS_PRODUCTION_WEBHOOK_TOKEN:token};
const required=['PAYMENT_CREATED','PAYMENT_UPDATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_REFUND_IN_PROGRESS','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL','SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED'];
function checkFixture(options={}){
 const calls=[];
 const config={...env,...options.env};
 const handler=createProductionCheckHandler({env:key=>config[key],fetch:async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return json({id});
  if(url.endsWith('/is_platform_admin'))return json(options.admin??true);
  if(url.endsWith('/myAccount/status/'))return json({general:options.general??'APPROVED'});
  if(url.includes('/webhooks?'))return json({data:[{url:'https://example.supabase.co/functions/v1/asaas-production-webhook',enabled:true,interrupted:false,events:options.events??required,...options.hook}]});
  if(url.endsWith('/functions/v1/asaas-production-webhook')){assert.equal(init.headers['asaas-access-token'],token);return json({code:options.probeCode??'EVENT_IGNORED'},options.probeStatus??200);}
  if(url.endsWith('/app_record_production_check'))return json({verified:true});
  throw Error(url);
 }});
 const request=()=>new Request('https://example.supabase.co/functions/v1/asaas-production-check',{method:'POST',headers:{origin:'https://liben-agro.com',authorization:'Bearer user-session'},body:JSON.stringify({action:'check_production'})});
 return{calls,handler,request};
}
test('diagnóstico não cria cobrança: usa GET no Asaas e sonda somente o receptor próprio',async()=>{const f=checkFixture();const r=await f.handler(f.request());assert.equal(r.status,200);const body=await r.json();assert.equal(body.paymentCreated,false);assert.equal(body.modeChanged,false);assert.equal(body.environment,'production');assert.ok(f.calls.filter(x=>x.url.includes('api.asaas.com')).every(x=>!x.init.method||x.init.method==='GET'));assert.ok(f.calls.some(x=>x.url.endsWith('/app_record_production_check')));});
for(const options of [{admin:false},{general:'PENDING'},{hook:{enabled:false}},{hook:{interrupted:true}},{events:['PAYMENT_RECEIVED']},{hook:{url:'https://evil.invalid'}},{probeStatus:401},{probeCode:'OTHER'},{env:{ASAAS_PRODUCTION_API_KEY:'$aact_hmlg_forbidden'}},{env:{ASAAS_PRODUCTION_WEBHOOK_TOKEN:'short'}}])test('pré-requisito inválido não grava prontidão '+JSON.stringify(options),async()=>{const f=checkFixture(options);assert.ok((await f.handler(f.request())).status>=400);assert.ok(!f.calls.some(x=>x.url.endsWith('/app_record_production_check')));});
function subFixture(options={}){
 const calls=[];const config={...env,...options.env};
 const sub={id,farm_id:'own-farm',plan:'monthly',method:'PIX',amount_cents:2490,first_due_on:'2026-10-17',customer_id:'cus_fixture',provider_id:null,fresh:true,status:'creating'};
 const provider={id:'sub_fixture',customer:'cus_fixture',externalReference:id,cycle:'MONTHLY',billingType:'PIX',value:24.9,status:'ACTIVE',nextDueDate:'2026-10-17'};
 const handler=createProductionSubscriptionHandler({env:key=>config[key],fetch:async(url,init)=>{
 calls.push({url,init});
 if(url.endsWith('/auth/v1/user'))return json({id});
 if(url.endsWith('/app_production_subscription_server')){
  const body=JSON.parse(init.body);if(options.denied)return json({},403);
  if(body.p_action==='prepare'){assert.equal(body.p_payload.productionConsent,true);assert.equal(body.p_payload.priceVersion,'version');}
  if(body.p_action==='customer')sub.customer_id=body.p_payload.customerId;
  if(body.p_action==='save')sub.provider_id='sub_fixture';
  return json(sub);
 }
 if(url.endsWith('/customers'))return json({id:'cus_fixture'});
 if(url.endsWith('/subscriptions'))return json(provider);
 if(url.includes('/payments?'))return json({data:[],hasMore:false});
 throw Error(url);
 }});
 const body={action:'create',plan:'monthly',method:'PIX',name:'Pagador fictício',cpfCnpj:'12345678909',productionConsent:true,priceVersion:'version'};
 const request=extra=>new Request('https://example.supabase.co/functions/v1/asaas-production-subscription',{method:'POST',headers:{origin:'https://liben-agro.com',authorization:'Bearer customer-session'},body:JSON.stringify({...body,...extra})});
 return{calls,handler,request};
}
test('usuário comum autorizado pelo banco pode contratar; consentimento e versão são verificados antes de criar',async()=>{const f=subFixture();assert.equal((await f.handler(f.request())).status,200);assert.ok(!f.calls.some(x=>x.url.endsWith('/is_platform_admin')));const creation=f.calls.find(x=>x.url.endsWith('/subscriptions'));assert.equal(creation.url,'https://api.asaas.com/v3/subscriptions');assert.equal(JSON.parse(creation.init.body).value,24.9);assert.ok(f.calls.every(x=>!x.url.includes('api-sandbox')));});
for(const extra of [{productionConsent:false},{priceVersion:undefined},{value:1},{farmId:'other'},{creditCard:{number:'private'}}])test('pedido incompleto/manipulado não chega à criação real '+JSON.stringify(extra),async()=>{const f=subFixture();assert.equal((await f.handler(f.request(extra))).status,400);assert.ok(!f.calls.some(x=>x.url.includes('api.asaas.com')));});
test('negação do banco não cria cliente ou assinatura',async()=>{const f=subFixture({denied:true});assert.equal((await f.handler(f.request())).status,502);assert.ok(!f.calls.some(x=>x.url.includes('api.asaas.com')));});
test('chave Sandbox nunca é aceita no endpoint de produção',async()=>{const f=subFixture({env:{ASAAS_PRODUCTION_API_KEY:'$aact_hmlg_fixture'}});assert.equal((await f.handler(f.request())).status,503);assert.equal(f.calls.length,0);});
test('webhook produtivo recusa token errado antes de qualquer consulta',async()=>{const calls=[];const h=createProductionWebhookHandler({env:key=>env[key],fetch:async(...args)=>{calls.push(args);throw Error('No network');}});const r=await h(new Request('https://example.supabase.co/functions/v1/asaas-production-webhook',{method:'POST',headers:{'asaas-access-token':'wrong'},body:'{}'}));assert.equal(r.status,401);assert.equal(calls.length,0);});
