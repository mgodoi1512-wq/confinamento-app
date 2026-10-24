import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const helper=fs.readFileSync(new URL('../supabase/functions/_shared/coupon-payment.ts',import.meta.url),'utf8');
async function load(name){let source=fs.readFileSync(new URL('../supabase/functions/asaas-production-'+name+'/handler.ts',import.meta.url),'utf8').replace(/^import .*coupon-payment.*\n/m,'');if(source.includes('annual-reconcile'))source=fs.readFileSync(new URL('../supabase/functions/_shared/annual-reconcile.ts',import.meta.url),'utf8')+'\n'+source.replace(/^import .*annual-reconcile.*\n/m,'');return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(helper+'\n'+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));}
const{createProductionSubscriptionHandler}=await load('subscription');const{createProductionWebhookHandler}=await load('webhook');
const id='11111111-1111-4111-8111-111111111111',quote='22222222-2222-4222-8222-222222222222';
const env={APP_ALLOWED_ORIGINS:'https://example.invalid',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fake-anon',SUPABASE_SERVICE_ROLE_KEY:'fake-service',ASAAS_PRODUCTION_API_KEY:'$aact_prod_fake',ASAAS_PRODUCTION_WEBHOOK_TOKEN:'fake-webhook-token-for-tests-at-least32'};
const json=x=>new Response(JSON.stringify(x));
const pay=(patch={})=>({id:'pay_first',subscription:'sub_test',customer:'cus_test',billingType:'PIX',value:24.9,dueDate:'2026-10-24',status:'PENDING',invoiceUrl:'https://www.asaas.com/i/test',...patch});
function subscriptionFixture(options={}){
 const calls=[],ingested=[];const method=options.method??"PIX";let s={id,amount_cents:2490,first_payment_cents:2241,coupon_quote_id:quote,first_due_on:'2026-10-24',plan:'monthly',method,fresh:!options.recover,status:'creating',provider_id:options.recover?'sub_test':null,customer_id:options.recover?'cus_test':null,coupon_first_payment_id:options.recover?'pay_first':null};
 let first=pay({billingType:method,value:options.recover?22.41:24.9,...options.payment});
 const handler=createProductionSubscriptionHandler({env:k=>env[k],fetch:async(url,init)=>{
 calls.push({url,init});if(url.endsWith('/auth/v1/user'))return json({id});
 if(url.endsWith('/app_production_subscription_server')){const b=JSON.parse(init.body);if(b.p_action==='prepare')assert.equal(b.p_payload.couponQuoteId,quote);if(b.p_action==='customer')s={...s,customer_id:'cus_test'};if(b.p_action==='save')s={...s,provider_id:'sub_test',status:'ACTIVE'};return json(s);}
 if(url.endsWith('/app_coupon_bind_first_payment')){s={...s,coupon_first_payment_id:'pay_first'};return json(s);}
 if(url.endsWith('/app_ingest_production_subscription_payment')){ingested.push(JSON.parse(init.body).p_payload);return json({ok:true});}
 if(url==='https://api.asaas.com/v3/customers')return json({id:'cus_test'});
 if(url==='https://api.asaas.com/v3/subscriptions'||url==='https://api.asaas.com/v3/subscriptions/sub_test'){if(init.method==='POST')assert.equal(JSON.parse(init.body).value,24.9);return json({id:'sub_test',customer:'cus_test',externalReference:id,billingType:method,cycle:'MONTHLY',value:24.9,status:'ACTIVE'});}
 if(url.includes('/subscriptions/sub_test/payments?'))return json({data:[first,pay({billingType:method,id:'pay_next',dueDate:'2026-11-24'})],hasMore:false});
 if(url==='https://api.asaas.com/v3/payments/pay_first'&&init.method==='PUT'){const b=JSON.parse(init.body);assert.deepEqual(b,{value:22.41,billingType:method,dueDate:'2026-10-24'});first={...first,value:22.41};return json(first);}
 throw new Error(url);
 }});
 const request=()=>new Request('https://fixture.supabase.co/functions/v1/test',{method:'POST',headers:{authorization:'Bearer fake',origin:'https://example.invalid'},body:JSON.stringify({action:'create',plan:'monthly',method,name:'Pessoa Teste',cpfCnpj:'12345678909',priceVersion:'version',productionConsent:true,couponQuoteId:quote})});return{handler,request,calls,ingested};
}
test('mensal mantém recorrência integral e aplica valor do servidor somente à primeira fatura',async()=>{const f=subscriptionFixture();const r=await f.handler(f.request());assert.equal(r.status,200,await r.text());assert.deepEqual(f.ingested.map(p=>p.amountCents),[2241,2490]);assert.equal(f.calls.filter(c=>c.url.includes('api.asaas.com')&&c.init.method==='PUT').length,1);});
test('retomada não cria nem altera novamente a fatura que já tem desconto',async()=>{const f=subscriptionFixture({recover:true});assert.equal((await f.handler(f.request())).status,200);assert.ok(f.calls.filter(c=>c.url.includes('api.asaas.com')).every(c=>!c.init.method||c.init.method==='GET'));});
test('primeira fatura já paga pelo valor integral não é alterada nem importada como desconto',async()=>{const f=subscriptionFixture({payment:{status:'RECEIVED'}});assert.equal((await f.handler(f.request())).status,502);assert.equal(f.ingested.length,0);assert.ok(!f.calls.some(c=>c.init.method==='PUT'));});
for(const [due,value,bound,expected] of [['2026-10-24',22.41,true,200],['2026-10-24',24.9,true,503],['2026-10-24',22.41,false,503],['2026-11-24',24.9,true,200],['2026-11-24',22.41,true,503]])test(`webhook confere cupom por ID e data ${due} valor ${value} vínculo ${bound}`,async()=>{
 const actions=[];const payment=pay({dueDate:due,value,status:'RECEIVED'});
 const subscription={id,customer_id:'cus_test',provider_id:'sub_test',method:'PIX',amount_cents:2490,coupon_quote_id:quote,first_payment_cents:2241,coupon_first_payment_id:bound?'pay_first':null,first_due_on:'2026-10-24'};
 const handler=createProductionWebhookHandler({env:k=>env[k],fetch:async(url,init)=>{if(url.endsWith('/app_production_webhook')){const b=JSON.parse(init.body);actions.push(b.p_action);return json(b.p_action==='claim'?{claimToken:quote,subscription}:{ok:true});}return json(payment);}});
 const response=await handler(new Request('https://fixture.supabase.co/functions/v1/hook',{method:'POST',headers:{'asaas-access-token':env.ASAAS_PRODUCTION_WEBHOOK_TOKEN},body:JSON.stringify({id:'evt_coupon',event:'PAYMENT_RECEIVED',payment:{id:'pay_first',subscription:'sub_test'}})}));assert.equal(response.status,expected);assert.equal(actions.includes('complete'),expected===200);
});

test('primeiro mensal no cartão também mantém o valor integral das próximas faturas',async()=>{const f=subscriptionFixture({method:'CREDIT_CARD'});const r=await f.handler(f.request());assert.equal(r.status,200,await r.text());assert.deepEqual(f.ingested.map(p=>p.amountCents),[2241,2490]);});
