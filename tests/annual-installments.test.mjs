import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const shared=fs.readFileSync(new URL('../supabase/functions/_shared/annual-reconcile.ts',import.meta.url),'utf8');
async function load(name){const handler=fs.readFileSync(new URL(`../supabase/functions/asaas-production-${name}/handler.ts`,import.meta.url),'utf8').replace(/^import .*annual-reconcile.*\n/m,'').replace(/^import .*coupon-payment.*\n/m,'');const code=ts.transpileModule(fs.readFileSync(new URL('../supabase/functions/_shared/coupon-payment.ts',import.meta.url),'utf8')+'\n'+shared+'\n'+handler,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {createProductionAnnualHandler}=await load('annual');const {createProductionWebhookHandler}=await load('webhook');
const id='11111111-1111-4111-8111-111111111111';const user='22222222-2222-4222-8222-222222222222';
const token='fixture-webhook-with-64-characters-no-real-secrets-0123456789012345';
const env={APP_ALLOWED_ORIGINS:'https://liben-agro.com',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-private',ASAAS_PRODUCTION_API_KEY:'$aact_prod_fixture',ASAAS_PRODUCTION_WEBHOOK_TOKEN:token};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
function fixture(options={}){
 const calls=[];let deleted=false;const count=options.count??12;const total=options.total??24990;
 const order={id,farm_id:'farm',user_id:user,plan:'annual',method:'CREDIT_CARD',amount_cents:total,installment_count:count,due_on:'2026-10-18',annual_base_from:'2026-10-18',annual_members:[],annual_cancel_state:null,customer_id:options.fresh===false?'cus_fixture':null,payment_id:null,provider_installment_id:null,fresh:options.fresh!==false,status:'creating',...options.order};
 const group=count>1?'group_fixture':null;
 const payments=Array.from({length:count},(_,i)=>({id:'pay_annual_'+i,customer:'cus_fixture',billingType:'CREDIT_CARD',value:(i===count-1?total-Math.round(total/count)*(count-1):Math.round(total/count))/100,installment:group,installmentNumber:i+1,externalReference:id,invoiceUrl:'https://www.asaas.com/i/annual_'+i,dueDate:new Date(Date.UTC(2026,9+i,18)).toISOString().slice(0,10),status:'PENDING'}));
 if(options.change)options.change(payments);
 if(options.order?.payment_id)order.annual_members=payments.map(p=>({id:p.id,customerId:p.customer,method:p.billingType,amountCents:Math.round(p.value*100),installmentId:p.installment,externalReference:p.externalReference,invoiceUrl:p.invoiceUrl,dueDate:p.dueDate,status:p.status,refundedCents:0}));
 const now=()=>new Date('2026-10-18T00:00:00Z');
 const handler=createProductionAnnualHandler({env:k=>({...env,...options.env})[k],now,fetch:async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return json({id:user},options.authStatus??200);
  if(url.endsWith('/app_annual_purchase_server')){
   const body=JSON.parse(init.body);assert.equal(body.p_user_id,user);if(options.dbDenied)return json({},403);
   if(body.p_action==='customer'){order.customer_id=body.p_payload.customerId;order.fresh=false;}
   if(body.p_action==='cancel_begin')order.annual_cancel_state='canceling';
   return json(order);
  }
  if(url.endsWith('/app_apply_annual_snapshot')){
   const snap=JSON.parse(init.body).p_snapshot;
   order.annual_members=snap.payments;order.payment_id=snap.paymentId;order.provider_installment_id=snap.installmentId;order.fresh=false;order.status=snap.payments.every(x=>x.status==='DELETED')?'DELETED':'PENDING';return json(order);
  }
  if(url==='https://api.asaas.com/v3/customers')return json({id:'cus_fixture'});
  if(url==='https://api.asaas.com/v3/payments'&&init.method==='POST'){if(options.timeout)throw Error(env.ASAAS_PRODUCTION_API_KEY);return json(payments[0]);}
  if(url.includes('/payments?externalReference='))return json({data:options.ambiguous?[payments[0],{...payments[0],id:'pay_other',installment:'group_other'}]:payments,hasMore:false});
  if(url==='https://api.asaas.com/v3/installments/group_fixture/payments'||url==='https://api.asaas.com/v3/payments?installment=group_fixture&limit=100'){
   if(init.method==='DELETE'){deleted=true;return json({deleted:true});}
   return deleted?json({},404):json({data:payments,hasMore:false});
  }
  const p=payments.find(x=>url==='https://api.asaas.com/v3/payments/'+x.id);
  if(p){if(init.method==='DELETE'){deleted=true;return json({deleted:true});}return deleted?json({},404):json(p);}
  throw Error(url);
 }});
 const create={action:'create',installmentCount:count,name:'Pagador teste',cpfCnpj:'12345678909',priceVersion:'2026-10-18T00:00:00Z',productionConsent:true};
 const request=(body=create,headers={})=>new Request('https://fixture.supabase.co/functions/v1/asaas-production-annual',{method:'POST',headers:{origin:'https://liben-agro.com',authorization:'Bearer fixture-user',...headers},body:JSON.stringify(body)});
 return {handler,request,calls,payments,order};
}
const apiCalls=f=>f.calls.filter(x=>x.url.includes('api.asaas.com'));
test('anual 12x usa total do servidor, sem juros e sem dados de cartão no LiBen',async()=>{const f=fixture();const r=await f.handler(f.request());assert.equal(r.status,200,await r.text());const created=apiCalls(f).find(x=>x.url.endsWith('/payments'));const body=JSON.parse(created.init.body);assert.equal(body.totalValue,249.9);assert.equal(body.installmentCount,12);assert.equal(body.value,undefined);assert.deepEqual(body.interest,{value:0});assert.deepEqual(body.fine,{value:0});assert.equal(body.billingType,'CREDIT_CARD');assert.equal(body.externalReference,id);assert.ok(!('creditCard' in body));assert.equal(f.order.annual_members.reduce((sum,x)=>sum+x.amountCents,0),24990);assert.equal(f.order.annual_members[11].amountCents,2077);});
for(const count of [1,2,3,6,10,12])test('total é preservado em '+count+'x',async()=>{const f=fixture({count});assert.equal((await f.handler(f.request())).status,200);const body=JSON.parse(apiCalls(f).find(x=>x.url.endsWith('/payments')).init.body);if(count===1){assert.equal(body.value,249.9);assert.ok(!('installmentCount' in body));assert.ok(!('totalValue' in body));}else{assert.equal(body.totalValue,249.9);assert.equal(body.installmentCount,count);}assert.equal(f.order.annual_members.reduce((n,x)=>n+x.amountCents,0),24990);});
test('consulta após resposta perdida recupera grupo sem POST no Asaas',async()=>{const f=fixture({fresh:false});assert.equal((await f.handler(f.request({action:'refresh',id}))).status,200);assert.ok(apiCalls(f).every(x=>x.init.method==='GET'));assert.ok(f.calls.some(x=>x.url.includes('externalReference='+id)));assert.equal(f.order.payment_id,'pay_annual_0');});
test('segunda submissão usa a reserva existente e não cria outra operação',async()=>{const f=fixture();assert.equal((await f.handler(f.request())).status,200);const creates=apiCalls(f).filter(x=>x.init.method==='POST').length;assert.equal((await f.handler(f.request())).status,200);assert.equal(apiCalls(f).filter(x=>x.init.method==='POST').length,creates);});
test('recuperação com dois grupos fica em conferência, sem POST',async()=>{const f=fixture({fresh:false,ambiguous:true});assert.equal((await f.handler(f.request({action:'refresh',id}))).status,502);assert.ok(apiCalls(f).every(x=>x.init.method==='GET'));});
for(const patch of [{installmentCount:13},{installmentCount:0},{installmentCount:2.5},{productionConsent:false},{totalValue:1},{farmId:'other'},{creditCard:{number:'secret'}},{baseUrl:'https://evil.invalid'}])test('pedido inválido não cria operação '+JSON.stringify(patch),async()=>{const f=fixture();assert.equal((await f.handler(f.request({action:'create',installmentCount:12,name:'Teste',cpfCnpj:'12345678909',priceVersion:'version',productionConsent:true,...patch}))).status,400);assert.equal(apiCalls(f).length,0);});
for(const options of [{dbDenied:true},{authStatus:401},{env:{ASAAS_PRODUCTION_API_KEY:'$aact_hmlg_forbidden'}}])test('negação não chega ao Asaas '+JSON.stringify(options),async()=>{const f=fixture(options);assert.ok((await f.handler(f.request())).status>=400);assert.equal(apiCalls(f).length,0);});
for(const change of [p=>p[1].customer='other',p=>p[1].value=1,p=>p[1].billingType='PIX',p=>p[1].externalReference='other',p=>p[1].installment='other',p=>p[1].id=p[0].id,p=>p.pop()])test('grupo divergente não é aplicado ao banco',async()=>{const f=fixture({fresh:false,change});assert.equal((await f.handler(f.request({action:'refresh',id}))).status,502);assert.ok(!f.calls.some(x=>x.url.endsWith('/app_apply_annual_snapshot')));});
for(const count of [1,12])test('desistência de '+count+'x remove só pendentes e confirma todos os IDs antes de concluir',async()=>{const f=fixture({count,fresh:false,order:{payment_id:'pay_annual_0',provider_installment_id:count>1?'group_fixture':null}});const r=await f.handler(f.request({action:'cancel',id,confirm:true}));assert.equal(r.status,200,await r.text());assert.equal(f.order.status,'DELETED');const deleted=apiCalls(f).filter(x=>x.init.method==='DELETE');assert.equal(deleted.length,1);assert.equal(deleted[0].url,count>1?'https://api.asaas.com/v3/installments/group_fixture/payments':'https://api.asaas.com/v3/payments/pay_annual_0');assert.ok(f.order.annual_members.every(x=>x.status==='DELETED'));});
test('timeout não expõe chave nem tenta novo POST',async()=>{const f=fixture({timeout:true});const r=await f.handler(f.request());assert.equal(r.status,502);assert.ok(!(await r.text()).includes('$aact_'));assert.equal(apiCalls(f).filter(x=>x.url.endsWith('/payments')&&x.init.method==='POST').length,1);});
function webhookFixture(options={}){
 const base=fixture({fresh:false,order:{payment_id:'pay_annual_0',provider_installment_id:'group_fixture'}});const calls=[];
 const paymentList=base.payments.map(x=>({...x,status:'CONFIRMED'}));if(options.change)options.change(paymentList);
 const handler=createProductionWebhookHandler({env:k=>env[k],now:()=>new Date('2026-10-18T00:00:00Z'),fetch:async(url,init)=>{
 calls.push({url,init});if(url.endsWith('/app_production_webhook')){const action=JSON.parse(init.body).p_action;if(action==='claim')return json({claimToken:user,order:base.order});return json({processed:true});}
 if(url.endsWith('/app_apply_annual_snapshot'))return json({id});
 if(url==='https://api.asaas.com/v3/payments/pay_annual_0')return json(paymentList[0]);
 if(url==='https://api.asaas.com/v3/payments?installment=group_fixture&limit=100')return json({data:paymentList,hasMore:false});
 throw Error(url);
 }});
 const request=()=>new Request('https://fixture.supabase.co/functions/v1/asaas-production-webhook',{method:'POST',headers:{'asaas-access-token':token},body:JSON.stringify({id:'evt_annual',event:'PAYMENT_CONFIRMED',payment:{id:'pay_annual_5',installment:'group_fixture'}})});
 return{handler,request,calls};
}
test('webhook de parcela intermediária verifica todo o grupo e conclui o evento anual',async()=>{const f=webhookFixture();assert.equal((await f.handler(f.request())).status,200);const claim=JSON.parse(f.calls[0].init.body).p_payload;assert.equal(claim.providerInstallmentId,'group_fixture');const applied=JSON.parse(f.calls.find(x=>x.url.endsWith('/app_apply_annual_snapshot')).init.body);assert.equal(applied.p_snapshot.source,'webhook');assert.equal(applied.p_snapshot.payments.length,12);assert.equal(applied.p_snapshot.payments.reduce((n,x)=>n+x.amountCents,0),24990);assert.ok(f.calls.some(x=>x.url.endsWith('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='complete_annual'));});
test('webhook com parcela de outro grupo não confirma contratação',async()=>{const f=webhookFixture({change:p=>p[5].installment='other'});assert.equal((await f.handler(f.request())).status,503);assert.ok(!f.calls.some(x=>x.url.endsWith('/app_apply_annual_snapshot')));assert.ok(f.calls.some(x=>x.url.endsWith('/app_production_webhook')&&JSON.parse(x.init.body).p_action==='fail'));});

test('cupom anual usa o total líquido do servidor antes de dividir as 12 parcelas',async()=>{
 const f=fixture({total:19990});const q='33333333-3333-4333-8333-333333333333';
 const r=await f.handler(f.request({action:'create',installmentCount:12,name:'Teste',cpfCnpj:'12345678909',priceVersion:'version',productionConsent:true,couponQuoteId:q}));assert.equal(r.status,200,await r.text());
 assert.equal(JSON.parse(f.calls.find(c=>c.url.endsWith('/app_annual_purchase_server')).init.body).p_payload.couponQuoteId,q);
 assert.equal(JSON.parse(apiCalls(f).find(c=>c.url.endsWith('/payments')&&c.init.method==='POST').init.body).totalValue,199.9);
 assert.equal(f.order.annual_members.reduce((sum,x)=>sum+x.amountCents,0),19990);
});
