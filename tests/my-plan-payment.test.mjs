import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../supabase/functions/asaas-sandbox-payment/handler.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createSandboxPaymentHandler}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const id='11111111-1111-4111-8111-111111111111', user='22222222-2222-4222-8222-222222222222';
const json=(x,status=200)=>new Response(JSON.stringify(x),{status});
function fixture(options={}){
 const calls=[];const order={id,farm_id:'farm',method:'PIX',plan:'monthly',amount_cents:2490,customer_id:'cus_fixture',fresh:false,payment_id:'pay_fixture',...options.order};
 const payment={id:'pay_fixture',externalReference:id,customer:'cus_fixture',billingType:'PIX',value:24.9,invoiceUrl:'https://sandbox.asaas.com/i/fixture',status:'PENDING',...options.payment};
 const env={APP_ALLOWED_ORIGINS:'https://liben-agro.com',SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service-private',ASAAS_SANDBOX_API_KEY:'$aact_hmlg_fixture',...options.env};
 const handler=createSandboxPaymentHandler({env:x=>env[x],now:()=>new Date('2026-10-17T18:00:00Z'),fetch:async(url,init)=>{
   calls.push({url,init});
   if(url.endsWith('/auth/v1/user'))return options.badAuth?json({},401):json({id:user});
   if(url.endsWith('/is_platform_admin'))return json(options.admin??true);
   if(url.endsWith('/app_billing_sandbox_server')){const body=JSON.parse(init.body);assert.equal(body.p_user_id,user);if(options.dbDenied)return json({},403);if(body.p_action==='customer')order.customer_id=body.p_payload.customerId;return json(order);}
   if(url.endsWith('/customers'))return json({id:'cus_fixture'});
   if(url.includes('/payments?'))return json({data:options.empty?[]:[payment]});
   if(url.includes('/payments')){if(options.timeout)throw new Error(env.ASAAS_SANDBOX_API_KEY);return json(payment);}
   throw Error('unexpected '+url);
 }});
 const request=(body={action:'refresh',id},headers={})=>new Request('https://test.supabase.co/functions/v1/asaas-sandbox-payment',{method:'POST',headers:{origin:'https://liben-agro.com',authorization:'Bearer user-jwt',...headers},body:JSON.stringify(body)});
 return{handler,request,calls};
}
test('consulta real confere cobrança e sincroniza no banco sem vazar dados',async()=>{const f=fixture();const r=await f.handler(f.request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,environment:'sandbox',id});const sync=f.calls.filter(x=>x.url.endsWith('/app_billing_sandbox_server')).map(x=>JSON.parse(x.init.body)).find(x=>x.p_action==='sync');assert.equal(sync.p_payload.amountCents,2490);assert.equal(f.calls.filter(x=>x.url.includes('api-sandbox')&&x.init.method==='POST').length,0);});
for(const options of [{admin:false},{badAuth:true},{env:{ASAAS_SANDBOX_API_KEY:'$aact_prod_no'}},{dbDenied:true}])test('acesso negado não cria pagamentos '+JSON.stringify(options),async()=>{const f=fixture(options);assert.ok((await f.handler(f.request())).status>=400);assert.equal(f.calls.filter(x=>x.url.includes('api-sandbox')).length,0);});
test('origem não autorizada e ausência de sessão não alcançam rede',async()=>{const f=fixture();assert.equal((await f.handler(f.request(undefined,{origin:'https://evil.invalid'}))).status,403);assert.equal((await f.handler(f.request(undefined,{authorization:''}))).status,401);assert.equal(f.calls.length,0);});
for(const payment of [{value:1},{customer:'other'},{externalReference:'other'},{billingType:'BOLETO'},{invoiceUrl:'https://evil.invalid'}])test('rejeita divergência '+JSON.stringify(payment),async()=>{const f=fixture({payment});assert.equal((await f.handler(f.request())).status,502);assert.ok(!f.calls.some(x=>x.url.endsWith('/app_billing_sandbox_server')&&JSON.parse(x.init.body).p_action==='sync'));});
test('primeira criação usa preço do banco e destino fixo Sandbox',async()=>{const f=fixture({order:{fresh:true,payment_id:null,customer_id:null}});const r=await f.handler(f.request({action:'create',plan:'monthly',method:'PIX',name:'Pagador de teste',cpfCnpj:'12345678909'}));assert.equal(r.status,200);const create=f.calls.find(x=>x.url.endsWith('/payments'));assert.equal(JSON.parse(create.init.body).value,24.9);assert.equal(JSON.parse(create.init.body).externalReference,id);assert.equal(JSON.parse(create.init.body).dueDate,'2026-10-17');assert.ok(create.init.signal);});
test('recuperação após resposta perdida só consulta, nunca cria outra cobrança',async()=>{const f=fixture({order:{fresh:false,payment_id:null}});assert.equal((await f.handler(f.request())).status,200);assert.ok(f.calls.some(x=>x.url.includes('externalReference=')));assert.equal(f.calls.filter(x=>x.url.includes('api-sandbox')&&x.init.method==='POST').length,0);});
test('ausência de cobrança na recuperação pede conferência sem novo POST',async()=>{const f=fixture({order:{fresh:false,payment_id:null},empty:true});assert.equal((await f.handler(f.request())).status,409);assert.equal(f.calls.filter(x=>x.url.includes('api-sandbox')&&x.init.method==='POST').length,0);});
test('payload não aceita preço, fazenda, chave nem dados de cartão',async()=>{for(const extra of [{value:1},{farmId:'other'},{creditCard:{number:'secret'}},{baseUrl:'https://evil.invalid'}]){const f=fixture();assert.equal((await f.handler(f.request({action:'refresh',id,...extra}))).status,400);assert.equal(f.calls.filter(x=>x.url.includes('api-sandbox')).length,0);}});
test('falhas de rede não expõem chave ou corpo do provedor',async()=>{const f=fixture({timeout:true});const r=await f.handler(f.request());assert.equal(r.status,502);assert.ok(!(await r.text()).includes('$aact_hmlg'));});
