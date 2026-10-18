import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
let source=fs.readFileSync(new URL('../supabase/functions/asaas-production-webhook/handler.ts',import.meta.url),'utf8');
source=fs.readFileSync(new URL('../supabase/functions/_shared/annual-reconcile.ts',import.meta.url),'utf8')+'\n'+source.replace(/^import .*annual-reconcile.*\n/m,'');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createProductionWebhookHandler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const token='fixture-webhook-secret-with-at-least-32-characters';
const orderId='11111111-1111-4111-8111-111111111111';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
function fixture(options={}){
 const calls=[];
 const env={ASAAS_PRODUCTION_WEBHOOK_TOKEN:token,ASAAS_PRODUCTION_API_KEY:'$aact_prod_fixture',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-service-fixture',...options.env};
 const order={id:orderId,customer_id:'cus_fixture',payment_id:'pay_fixture',method:'PIX',amount_cents:2490,...options.order};
 const payment={id:'pay_fixture',customer:'cus_fixture',externalReference:orderId,billingType:'PIX',value:24.9,invoiceUrl:'https://www.asaas.com/i/fixture',status:'RECEIVED',...options.payment};
 const handler=createProductionWebhookHandler({env:key=>env[key],now:()=>new Date('2026-10-17T20:00:00Z'),fetch:async(url,init)=>{
  calls.push({url,init});
  if(url.includes('/app_production_webhook')){
   const body=JSON.parse(init.body);
   if(body.p_action==='claim')return options.dbFailure?json({},503):json(options.claim??{claimToken:'22222222-2222-4222-8222-222222222222',order});
   if(body.p_action==='deleted_unimported')return json({processed:true});
   if(body.p_action==='complete')return options.completeFailure?json({},503):json({processed:true});
   if(body.p_action==='fail')return json({retry:true});
  }
  if(url==='https://api.asaas.com/v3/subscriptions/sub_fixture')return json(options.providerSubscription??{id:'sub_fixture',customer:'cus_fixture',externalReference:orderId,billingType:'PIX',cycle:'MONTHLY',value:24.9,status:'ACTIVE',nextDueDate:'2026-11-17'},options.subscriptionStatus??200);
  if(url==='https://api.asaas.com/v3/payments/pay_fixture'){
   assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'error');
   if(options.network)throw Error(env.ASAAS_PRODUCTION_API_KEY);
   return json(payment,options.providerStatus??200);
  }
  throw Error('Unexpected request '+url);
 }});
 const event={id:'evt_fixture&1',event:'PAYMENT_RECEIVED',payment:{id:'pay_fixture',externalReference:orderId,status:'RECEIVED',value:24.9},...options.event};
 const request=(extra={})=>new Request('https://example.supabase.co/functions/v1/asaas-production-webhook',{method:'POST',headers:{'asaas-access-token':token,'content-type':'application/json'},body:JSON.stringify(event),...extra});
 return{handler,request,calls};
}
test('notificação válida consulta o Asaas e aplica somente o resultado verificado',async()=>{const f=fixture({payment:{status:'PENDING'}});const r=await f.handler(f.request());assert.equal(r.status,200);const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');assert.equal(JSON.parse(c.init.body).p_payload.payment.status,'PENDING','não confia no status RECEIVED do webhook');assert.deepEqual(await r.json(),{code:'EVENT_PROCESSED'});});
for(const headers of [{},{'asaas-access-token':'wrong'}])test('token ausente ou inválido bloqueia antes do banco/Asaas '+JSON.stringify(headers),async()=>{const f=fixture();assert.equal((await f.handler(f.request({headers}))).status,401);assert.equal(f.calls.length,0);});
for(const env of [{ASAAS_PRODUCTION_WEBHOOK_TOKEN:'short'},{ASAAS_PRODUCTION_WEBHOOK_TOKEN:'$aact_hmlg_'+'x'.repeat(40)},{ASAAS_PRODUCTION_API_KEY:'$aact_hmlg_forbidden'},{SUPABASE_SERVICE_ROLE_KEY:''}])test('configuração insegura falha fechada '+JSON.stringify(env),async()=>{const f=fixture({env});assert.equal((await f.handler(f.request())).status,503);assert.equal(f.calls.length,0);});
test('método incorreto, JSON quebrado e IDs inválidos não consultam provedor',async()=>{for(const request of [{method:'GET',body:undefined},{body:'{'},{body:JSON.stringify({id:'not-an-event',event:'PAYMENT_RECEIVED'})},{body:JSON.stringify({id:'evt_test',event:'PAYMENT_RECEIVED',payment:{id:'https://evil.invalid'}})}]){const f=fixture();assert.ok((await f.handler(f.request(request))).status>=400);assert.equal(f.calls.length,0);}});
for(const claim of [{duplicate:true},{ignored:true}])test('evento duplicado ou de outra cobrança é reconhecido sem consulta externa '+JSON.stringify(claim),async()=>{const f=fixture({claim});assert.equal((await f.handler(f.request())).status,200);assert.equal(f.calls.length,1);});
test('evento em processamento pede retentativa em vez de aplicar duas vezes',async()=>{const f=fixture({claim:{busy:true}});assert.equal((await f.handler(f.request())).status,503);assert.equal(f.calls.length,1);});
for(const payment of [{id:'pay_other'},{customer:'cus_other'},{externalReference:'other'},{value:1},{billingType:'CREDIT_CARD'},{invoiceUrl:'https://evil.invalid/i/test'}])test('divergência não atualiza plano '+JSON.stringify(payment),async()=>{const f=fixture({payment});assert.equal((await f.handler(f.request())).status,503);assert.ok(!f.calls.some(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete'));assert.ok(f.calls.some(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='fail'));});
for(const options of [{network:true},{providerStatus:429},{providerStatus:404},{providerStatus:401},{dbFailure:true},{completeFailure:true}])test('indisponibilidade mantém evento para retentativa '+JSON.stringify(options),async()=>{const f=fixture(options);const r=await f.handler(f.request());assert.equal(r.status,503);const content=await r.text();assert.ok(!content.includes('$aact_'));assert.ok(!content.includes('private-service'));});
test('campos adicionais não quebram a integração',async()=>{const f=fixture({event:{newField:{unknown:true}}});assert.equal((await f.handler(f.request())).status,200);});
test('evento não utilizado é ignorado sem interpretar o recurso',async()=>{const f=fixture({event:{event:'SOME_FUTURE_EVENT',payment:null}});assert.equal((await f.handler(f.request())).status,200);assert.equal(f.calls.length,0);});
test('webhook não requer JWT de usuário e não depende de CORS',async()=>{const f=fixture();const r=await f.handler(f.request());assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.ok(!f.calls.some(x=>x.url.includes('/auth/v1')));});

test('soma somente estornos concluídos e ignora cancelados ou pendentes',async()=>{const f=fixture({payment:{refunds:[{status:'DONE',value:1.2},{status:'CANCELLED',value:10},{status:'PENDING',value:10},{status:'DONE',value:0.8}]}});assert.equal((await f.handler(f.request())).status,200);const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');assert.equal(JSON.parse(c.init.body).p_payload.payment.refundedCents,200);});

const recurringClaim={claimToken:'22222222-2222-4222-8222-222222222222',order:null,subscription:{id:orderId,provider_id:'sub_fixture',customer_id:'cus_fixture',plan:'monthly',method:'PIX',amount_cents:2490}};
test('nova cobrança de renovação é vinculada pela assinatura verificada',async()=>{const f=fixture({claim:recurringClaim,payment:{subscription:'sub_fixture',externalReference:null,dueDate:'2026-11-17'}});assert.equal((await f.handler(f.request())).status,200);const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');const payload=JSON.parse(c.init.body).p_payload.payment;assert.equal(payload.providerSubscriptionId,'sub_fixture');assert.equal(payload.externalReference,orderId);});
test('renovação de outro contrato não atualiza pagamento',async()=>{const f=fixture({claim:recurringClaim,payment:{subscription:'sub_other'}});assert.equal((await f.handler(f.request())).status,503);assert.ok(!f.calls.some(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete'));});
test('evento da assinatura consulta assinatura e atualiza estado verificado',async()=>{const f=fixture({claim:recurringClaim,event:{event:'SUBSCRIPTION_UPDATED',subscription:{id:'sub_fixture',externalReference:orderId}}});assert.equal((await f.handler(f.request())).status,200);const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');assert.equal(JSON.parse(c.init.body).p_payload.subscription.status,'ACTIVE');});
test('exclusão de assinatura conhecida exige 404 do provedor para confirmar remoção',async()=>{const f=fixture({claim:recurringClaim,event:{event:'SUBSCRIPTION_DELETED',subscription:{id:'sub_fixture'}},subscriptionStatus:404});assert.equal((await f.handler(f.request())).status,200);const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');assert.equal(JSON.parse(c.init.body).p_payload.subscription.status,'CANCELLED');});
test('uma notificação de exclusão não cancela se o provedor ainda informa ACTIVE',async()=>{const f=fixture({claim:recurringClaim,event:{event:'SUBSCRIPTION_DELETED',subscription:{id:'sub_fixture'}}});assert.equal((await f.handler(f.request())).status,200);const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');assert.equal(JSON.parse(c.init.body).p_payload.subscription.status,'ACTIVE');});

test('exclusão de fatura ainda não importada não interrompe a fila',async()=>{const f=fixture({claim:recurringClaim,event:{event:'PAYMENT_DELETED'},providerStatus:404});assert.equal((await f.handler(f.request())).status,200);assert.ok(f.calls.some(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='deleted_unimported'));});

for(const status of ['PENDING','CONFIRMED','RECEIVED','REFUNDED','CHARGEBACK_REQUESTED'])test('webhook Boleto/Pix preserva situação verificada e método autorizado '+status,async()=>{
 const f=fixture({claim:recurringClaim,payment:{billingType:'BOLETO',subscription:'sub_fixture',externalReference:null,dueDate:'2026-11-17',status}});const r=await f.handler(f.request());assert.equal(r.status,200);
 const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');const payment=JSON.parse(c.init.body).p_payload.payment;
 assert.equal(payment.method,'PIX');assert.equal(payment.status,status);assert.equal(payment.amountCents,2490);assert.equal(payment.providerSubscriptionId,'sub_fixture');
 assert.ok(f.calls.filter(x=>x.url.includes('api.asaas.com')).every(x=>x.init.method==='GET'));
});
test('webhook de assinatura recupera Boleto/Pix antes de provider_id salvo',async()=>{const f=fixture({claim:{...recurringClaim,subscription:{...recurringClaim.subscription,provider_id:null}},event:{event:'SUBSCRIPTION_CREATED',subscription:{id:'sub_fixture',externalReference:orderId}},providerSubscription:{id:'sub_fixture',customer:'cus_fixture',externalReference:orderId,billingType:'BOLETO',cycle:'MONTHLY',value:24.9,status:'ACTIVE',nextDueDate:'2026-11-17'}});assert.equal((await f.handler(f.request())).status,200);const c=f.calls.find(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete');assert.equal(JSON.parse(c.init.body).p_payload.subscription.method,'PIX');});
test('webhook BOLETO não é aceito para assinatura em cartão',async()=>{const f=fixture({claim:{...recurringClaim,subscription:{...recurringClaim.subscription,method:'CREDIT_CARD'}},payment:{billingType:'BOLETO',subscription:'sub_fixture'}});assert.equal((await f.handler(f.request())).status,503);assert.ok(!f.calls.some(x=>x.url.includes('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete'));});
