import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../supabase/functions/asaas-production-payment/handler.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createProductionPaymentHandler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const id='11111111-1111-4111-8111-111111111111';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const payload='000201'+'1234567890'.repeat(15);
const json=(x,status=200)=>new Response(JSON.stringify(x),{status});
function fixture(options={}){
 const calls=[];const env={APP_ALLOWED_ORIGINS:'https://liben-agro.com',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'anon-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-secret-fixture',ASAAS_PRODUCTION_API_KEY:'$aact_prod_private_fixture',...options.env};
 const order={id,method:'PIX',amount_cents:2490,payment_id:'pay_fixture',customer_id:'cus_fixture',provider_subscription_id:'sub_fixture',provider_reference:id,archived:false,...options.order};
 const payment={id:'pay_fixture',subscription:'sub_fixture',customer:'cus_fixture',billingType:'BOLETO',value:24.9,dueDate:'2026-10-17',invoiceUrl:'https://www.asaas.com/i/fixture',status:'PENDING',...options.payment};
 const qr={encodedImage:png,payload,expirationDate:'2026-10-18 23:59:59',...options.qr};
 const handler=createProductionPaymentHandler({env:k=>env[k],now:()=>new Date('2026-10-17T20:00:00Z'),fetch:async(url,init)=>{
 calls.push({url,init});if(url.endsWith('/auth/v1/user'))return json({id:'22222222-2222-4222-8222-222222222222'},options.authStatus??200);
 if(url.endsWith('/app_billing_production_server'))return json(order,options.dbDenied?403:200);
 if(url==='https://api.asaas.com/v3/payments/pay_fixture')return json(payment);
 if(url==='https://api.asaas.com/v3/payments/pay_fixture/pixQrCode')return json(qr,options.qrStatus??200);
 throw Error(url);
 }});
 const request=(body={action:'pix',id},headers={})=>new Request('https://fixture.supabase.co/functions/v1/asaas-production-payment',{method:'POST',headers:{origin:'https://liben-agro.com',authorization:'Bearer user-session',...headers},body:JSON.stringify(body)});
 return{handler,request,calls};
}
test('Pix nativo recupera QR da cobrança Boleto/Pix existente após autorização e conferência',async()=>{
 const f=fixture();const r=await f.handler(f.request());assert.equal(r.status,200);const data=await r.json();assert.equal(data.id,id);assert.equal(data.amountCents,2490);assert.equal(data.state,'pending');assert.equal(data.status,'PENDING');assert.equal(data.pix.payload,payload);assert.equal(data.pix.encodedImage,png);assert.equal(data.pix.expirationDate,'2026-10-19T02:59:59.000Z');
 const provider=f.calls.filter(x=>x.url.includes('api.asaas.com'));assert.equal(provider.length,2);assert.ok(provider.every(x=>x.init.method==='GET'&&x.init.body===undefined&&x.init.redirect==='error'));
 assert.ok(f.calls.findIndex(x=>x.url.endsWith('/app_billing_production_server'))<f.calls.findIndex(x=>x.url.includes('api.asaas.com')));
 const raw=JSON.stringify(data);for(const secret of ['$aact_','service-secret','cus_fixture','sub_fixture','pay_fixture'])assert.ok(!raw.includes(secret));
});
for(const status of ['RECEIVED','CONFIRMED','REFUNDED','DELETED','CHARGEBACK_REQUESTED','AUTHORIZED'])test('não oferece código para pagar novamente em '+status,async()=>{const f=fixture({payment:{status}});const r=await f.handler(f.request());assert.equal(r.status,200);const data=await r.json();assert.equal(data.pix,null);assert.equal(data.state,status==='RECEIVED'?'paid':status==='CONFIRMED'?'processing':'unavailable');assert.ok(!f.calls.some(x=>x.url.endsWith('/pixQrCode')));});
test('estorno parcial esconde código e é sincronizado sem liberar novo pagamento',async()=>{const f=fixture({payment:{status:'RECEIVED',refunds:[{status:'DONE',value:1},{status:'CANCELLED',value:2}]}});const r=await f.handler(f.request());assert.equal(r.status,200);assert.equal((await r.json()).state,'unavailable');assert.ok(!f.calls.some(x=>x.url.endsWith('/pixQrCode')));const sync=f.calls.find(x=>x.url.endsWith('/app_billing_production_server')&&JSON.parse(x.init.body).p_action==='sync');assert.equal(JSON.parse(sync.init.body).p_payload.refundedCents,100);});
for(const options of [{order:{method:'CREDIT_CARD'}},{order:{archived:true}},{dbDenied:true},{authStatus:401},{env:{ASAAS_PRODUCTION_API_KEY:'$aact_hmlg_bad'}}])test('negação não alcança Asaas nem expõe QR '+JSON.stringify(options),async()=>{const f=fixture(options);assert.ok((await f.handler(f.request())).status>=400);assert.ok(!f.calls.some(x=>x.url.includes('api.asaas.com')));});
for(const payment of [{id:'pay_other'},{customer:'cus_other'},{subscription:'sub_other'},{value:1},{billingType:'CREDIT_CARD'},{invoiceUrl:'https://evil.invalid/i/test'}])test('cobrança divergente não permite recuperar QR '+JSON.stringify(payment),async()=>{const f=fixture({payment});assert.equal((await f.handler(f.request())).status,502);assert.ok(!f.calls.some(x=>x.url.endsWith('/pixQrCode')));});
for(const extra of [{amount:1},{paymentId:'pay_other'},{farmId:'other'},{environment:'sandbox'},{baseUrl:'https://evil.invalid'}])test('cliente não escolhe valor, provedor ou destino '+JSON.stringify(extra),async()=>{const f=fixture();assert.equal((await f.handler(f.request({action:'pix',id,...extra}))).status,400);assert.ok(!f.calls.some(x=>x.url.includes('api.asaas.com')));});
for(const qr of [{encodedImage:'PHN2Zz48L3N2Zz4='},{payload:'wrong'},{payload:payload+'\n'},{expirationDate:'invalid'},{expirationDate:'2026-10-16 23:59:59'}])test('código inválido ou expirado não é apresentado '+JSON.stringify(qr),async()=>{const f=fixture({qr});const r=await f.handler(f.request());assert.ok(r.status>=400);const raw=await r.text();assert.ok(!raw.includes('encodedImage'));assert.ok(!raw.includes('$aact_'));});
test('falha do Asaas ao obter QR não expõe resposta privada',async()=>{const f=fixture({qrStatus:500});const r=await f.handler(f.request());assert.equal(r.status,502);assert.ok((await r.json()).error.message.includes('Pix'));});
test('o QR também é aceito em cobrança PIX direta e vencida ainda pagável',async()=>{const f=fixture({payment:{billingType:'PIX',status:'OVERDUE'}});const r=await f.handler(f.request());assert.equal(r.status,200);assert.equal((await r.json()).state,'pending');});
