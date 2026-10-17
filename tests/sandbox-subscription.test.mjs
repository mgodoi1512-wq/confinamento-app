import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../supabase/functions/asaas-sandbox-subscription/handler.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createSandboxSubscriptionHandler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
const json=(x,status=200)=>new Response(JSON.stringify(x),{status});
function fixture(options={}){
 const calls=[];
 const env={APP_ALLOWED_ORIGINS:'https://liben-agro.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'private-service',ASAAS_SANDBOX_API_KEY:'$aact_hmlg_fixture',...options.env};
 const sub={id,plan:'monthly',method:'CREDIT_CARD',amount_cents:2490,status:'ACTIVE',first_due_on:'2026-10-17',provider_id:'sub_fixture',customer_id:'cus_fixture',fresh:false,...options.sub};
 const provider={id:'sub_fixture',customer:'cus_fixture',externalReference:id,cycle:sub.plan==='annual'?'YEARLY':'MONTHLY',billingType:sub.method,value:sub.amount_cents/100,status:'ACTIVE',nextDueDate:'2026-11-17',...options.provider};
 const payment={id:'pay_fixture',customer:'cus_fixture',subscription:'sub_fixture',externalReference:null,value:sub.amount_cents/100,billingType:sub.method,dueDate:'2026-10-17',invoiceUrl:'https://sandbox.asaas.com/i/fixture',status:'PENDING',...options.payment};
 const handler=createSandboxSubscriptionHandler({env:x=>env[x],now:()=>new Date('2026-10-17T20:00:00Z'),fetch:async(url,init)=>{
 calls.push({url,init});
 if(url.endsWith('/auth/v1/user'))return options.badSession?json({},401):json({id:user});
 if(url.endsWith('/is_platform_admin'))return json(options.admin??true);
 if(url.endsWith('/app_sandbox_subscription_server')){const body=JSON.parse(init.body);assert.equal(body.p_user_id,user);if(options.dbDenied)return json({},403);if(body.p_action==='customer')sub.customer_id=body.p_payload.customerId;if(body.p_action==='save'){sub.provider_id=body.p_payload.providerId;sub.status=body.p_payload.status;}if(body.p_action==='cancel_begin')sub.status='canceling';return json(sub);}
 if(url.endsWith('/app_ingest_sandbox_subscription_payment'))return json({id:'order'});
 if(url.endsWith('/customers'))return json({id:'cus_fixture'});
 if(url.includes('/payments?'))return json({data:[payment],hasMore:false});
 if(url.includes('subscriptions?externalReference='))return json({data:options.recoveryEmpty?[]:[provider]});
 if(url.includes('/subscriptions')){if(init.method==='DELETE')return json({deleted:true},options.deleteStatus??200);if(options.providerTimeout)throw Error(env.ASAAS_SANDBOX_API_KEY);return json(provider);}
 throw Error(url);
 }});
 const request=(body={action:'refresh',id})=>new Request('https://example.supabase.co/functions/v1/asaas-sandbox-subscription',{method:'POST',headers:{origin:'https://liben-agro.com',authorization:'Bearer session-token','content-type':'application/json'},body:JSON.stringify(body)});
 return{handler,request,calls};
}
test('consulta assinatura e concilia cobrança por ID da recorrência',async()=>{const f=fixture();assert.equal((await f.handler(f.request())).status,200);const ingest=f.calls.find(x=>x.url.endsWith('/app_ingest_sandbox_subscription_payment'));assert.equal(JSON.parse(ingest.init.body).p_payload.providerSubscriptionId,'sub_fixture');assert.ok(!f.calls.some(x=>x.url.includes('api-sandbox')&&x.init.method==='POST'));});
for(const plan of ['monthly','annual'])test('criação '+plan+' usa valor do banco e não coleta dados do cartão',async()=>{const f=fixture({sub:{plan,amount_cents:plan==='annual'?24990:2490,provider_id:null,customer_id:null,fresh:true,status:'creating'}});assert.equal((await f.handler(f.request({action:'create',plan,method:'CREDIT_CARD',name:'Pagador fictício',cpfCnpj:'12345678909'}))).status,200);const creation=f.calls.find(x=>x.url.endsWith('/subscriptions'));const body=JSON.parse(creation.init.body);assert.equal(body.cycle,plan==='annual'?'YEARLY':'MONTHLY');assert.equal(body.value,plan==='annual'?249.9:24.9);assert.equal(body.billingType,'CREDIT_CARD');assert.equal(body.creditCard,undefined);assert.equal(body.externalReference,id);});
test('Pix usa recorrência de cobranças, sem pedir Pix Automático',async()=>{const f=fixture({sub:{method:'PIX'}});assert.equal((await f.handler(f.request())).status,200);assert.ok(f.calls.every(x=>!x.url.includes('pix/automatic')));});
for(const options of [{admin:false},{badSession:true},{dbDenied:true},{env:{ASAAS_SANDBOX_API_KEY:'$aact_prod_not_allowed'}}])test('acesso negado não cria recorrência '+JSON.stringify(options),async()=>{const f=fixture(options);assert.ok((await f.handler(f.request())).status>=400);assert.ok(!f.calls.some(x=>x.url.includes('api-sandbox')));});
test('cancelamento exige confirmação explícita do formulário',async()=>{const f=fixture();assert.equal((await f.handler(f.request({action:'cancel',id}))).status,400);assert.ok(!f.calls.some(x=>x.init.method==='DELETE'));});
for(const deleteStatus of [200,404])test('cancelamento confirmado ou já removido '+deleteStatus,async()=>{const f=fixture({deleteStatus});assert.equal((await f.handler(f.request({action:'cancel',id,confirm:true}))).status,200);const deleted=f.calls.find(x=>x.init.method==='DELETE');assert.equal(deleted.url,'https://api-sandbox.asaas.com/v3/subscriptions/sub_fixture');const save=f.calls.find(x=>x.url.endsWith('/app_sandbox_subscription_server')&&JSON.parse(x.init.body).p_action==='save');assert.equal(JSON.parse(save.init.body).p_payload.status,'CANCELLED');});
test('falha ao cancelar nunca informa cancelamento concluído',async()=>{const f=fixture({deleteStatus:500});assert.equal((await f.handler(f.request({action:'cancel',id,confirm:true}))).status,502);assert.ok(!f.calls.some(x=>x.url.endsWith('/app_sandbox_subscription_server')&&JSON.parse(x.init.body).p_action==='save'));});
test('resposta perdida procura assinatura por referência sem recriar',async()=>{const f=fixture({sub:{provider_id:null,status:'creating'}});assert.equal((await f.handler(f.request())).status,200);assert.ok(f.calls.some(x=>x.url.includes('externalReference=')));assert.ok(!f.calls.some(x=>x.url.includes('api-sandbox')&&x.init.method==='POST'));});
test('recuperação sem resultado mantém conferência e não faz novo POST',async()=>{const f=fixture({sub:{provider_id:null,status:'creating'},recoveryEmpty:true});assert.equal((await f.handler(f.request())).status,409);assert.ok(!f.calls.some(x=>x.url.includes('api-sandbox')&&x.init.method==='POST'));});
for(const provider of [{value:1},{customer:'other'},{cycle:'YEARLY'},{externalReference:'other'},{billingType:'BOLETO'}])test('assinatura divergente não é aplicada '+JSON.stringify(provider),async()=>{const f=fixture({provider});assert.equal((await f.handler(f.request())).status,502);assert.ok(!f.calls.some(x=>x.url.endsWith('/app_sandbox_subscription_server')&&JSON.parse(x.init.body).p_action==='save'));});
test('cobrança de outra assinatura é recusada na conciliação',async()=>{const f=fixture({payment:{subscription:'sub_other'}});assert.equal((await f.handler(f.request())).status,502);assert.ok(!f.calls.some(x=>x.url.endsWith('/app_ingest_sandbox_subscription_payment')));});
test('payload não aceita preço, fazenda ou dados de cartão',async()=>{const f=fixture();assert.equal((await f.handler(f.request({action:'create',plan:'monthly',method:'CREDIT_CARD',name:'Teste',cpfCnpj:'12345678909',value:1,creditCard:{number:'secret'}}))).status,400);assert.ok(!f.calls.some(x=>x.url.includes('api-sandbox')));});
