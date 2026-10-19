import {PGlite} from '@electric-sql/pglite';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
process.on('uncaughtException',e=>{console.error(e.message,e.where??'');process.exit(1);});
const db=new PGlite(),a=crypto.randomUUID(),b=crypto.randomUUID(),owner=crypto.randomUUID(),uid=()=>crypto.randomUUID();
await db.exec(`create schema auth;create schema app_private;create role authenticated;create role anon;create role app_farm_executor;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.current_farm_id() returns uuid language sql stable as $$select nullif(current_setting('test.farm',true),'')::uuid$$;
create function public.is_gestor() returns boolean language sql stable as $$select current_setting('test.manager',true)='true'$$;
create function public.app_today() returns date language sql stable as $$select date '2026-10-18'$$;
create table farms(id uuid primary key);create table lots(id uuid primary key,farm_id uuid references farms(id),unique(id,farm_id));
create table diets(id uuid primary key,farm_id uuid references farms(id),unique(id,farm_id));
create table diet_items(id uuid primary key,diet_id uuid,farm_id uuid,ingredient text);
create table feed_logs(id uuid primary key,farm_id uuid,diet_id uuid,date date,ingredient_quantities jsonb,notes text);
grant usage on schema public,auth to authenticated,anon;
insert into farms values('${a}'),('${b}');select set_config('test.uid','${owner}',false);select set_config('test.manager','true',false);`);
const base=fs.readFileSync(new URL('../supabase/migrations/20261018060000_cash_flow_inventory.sql',import.meta.url),'utf8'),sql=fs.readFileSync(new URL('../supabase/migrations/20261018130000_stock_feed_production.sql',import.meta.url),'utf8');await db.exec(base);await db.exec(sql);
const as=async f=>{await db.exec('reset role');await db.query("select set_config('test.farm',$1,false)",[f]);await db.exec('set role authenticated');};
const rpc=async(action,p={})=>(await db.query('select app_stock_production($1,$2) result',[action,JSON.stringify(p)])).rows[0].result;
const workspace=async(action,p={})=>(await db.query('select app_finance_workspace($1,$2) result',[action,JSON.stringify(p)])).rows[0].result;
const create=async(name,cost,qty=1000,category='ingrediente')=>{const item=await workspace('save_item',{id:uid(),name,category,minimum_kg:0,expected:null});await workspace('move',{id:uid(),item_id:item.id,kind:'entrada',quantity_kg:qty,unit_cost:cost,movement_date:'2026-10-18',notes:'Inicial'});return item.id;};
await as(a);const milho=await create('Milho',2),torta=await create('Torta de algodão',3),nucleo=await create('Núcleo',4),sorgo=await create('Sorgo',1.5),vol=await create('Silagem',.3,100,'volumoso');
const composition=[{item_id:milho,role:'energia',percent:80},{item_id:torta,role:'proteina',percent:15},{item_id:nucleo,role:'nucleo',percent:5}];
const payload={id:uid(),quantity_kg:500,production_date:'2026-10-18',notes:'Mistura teste',composition};
const first=await rpc('produce',payload);assert.equal(first.quantity_kg,500);assert.equal(first.total_cost,1125);
assert.deepEqual(first.composition.map(c=>c.quantity_kg),[400,75,25]);
let state=await workspace('snapshot'),recipes=await rpc('list'),product=state.items.find(i=>i.id===recipes[0].item_id);
assert.equal(product.name,'Ração 80-15-5');assert.equal(product.category,'racao');assert.equal(product.quantity_kg,500);assert.equal(product.stock_value,1125);assert.equal(state.items.find(i=>i.id===milho).quantity_kg,600);assert.equal(state.items.find(i=>i.id===torta).quantity_kg,925);assert.equal(state.items.find(i=>i.id===nucleo).quantity_kg,975);assert.equal(state.movements.filter(m=>m.production_id===first.id).length,4);assert.equal(state.entries.length,0);
assert.equal(state.items.reduce((s,i)=>s+i.stock_value,0),10530,'produção transfere valor sem criar patrimônio');
assert.equal((await rpc('produce',payload)).id,first.id);assert.equal((await workspace('snapshot')).movements.length,state.movements.length);
await assert.rejects(rpc('produce',{...payload,quantity_kg:501}),/já utilizado/);
const retry={...payload,id:uid(),quantity_kg:5,composition:[composition[2],composition[0],composition[1]]};await rpc('produce',retry);assert.equal((await rpc('list')).length,1,'ordem do payload não cria composição duplicada');
// Normalização de escala decimal no JSON mantém a identidade da composição.
await db.query(`select app_stock_production('produce',$1::jsonb)`,[JSON.stringify({...payload,id:uid(),quantity_kg:1}).replace('"percent":80','"percent":80.000')]);assert.equal((await rpc('list')).length,1);
// Ingredientes diferentes com proporções iguais produzem outro item.
await rpc('produce',{...payload,id:uid(),quantity_kg:100,composition:[{...composition[0],item_id:sorgo},...composition.slice(1)]});recipes=await rpc('list');assert.equal(recipes.length,2);assert.ok(recipes.some(r=>r.name==='Ração 80-15-5 (2)'));
const snapshot=()=>workspace('snapshot');let baseline=await snapshot();
for(const bad of [{quantity_kg:100000},{quantity_kg:0},{quantity_kg:NaN},{quantity_kg:.0001},{quantity_kg:.001},{production_date:'2026-10-19'},{notes:'x'.repeat(2001)},{composition:composition.map((c,i)=>i===0?{...c,percent:79}:c)},{composition:composition.map((c,i)=>i===1?{...c,item_id:milho}:c)},{composition:composition.map((c,i)=>i===0?{...c,item_id:vol}:c)},{composition:composition.map(c=>({...c,percent:-1}))},{composition:composition.slice(1)},{composition:[{...composition[0],role:'outros'},...composition.slice(1)]}]){await assert.rejects(rpc('produce',{...payload,id:uid(),...bad}));assert.deepEqual(await snapshot(),baseline,'falha não altera saldos ou histórico');}
// Falha após as baixas também precisa estornar toda a transação.
await db.exec('reset role');await db.exec(`create function app_private.fail_output() returns trigger language plpgsql as $$begin if new.category='racao' then raise exception 'falha simulada na entrada';end if;return new;end$$;create trigger fail_output before update on stock_items for each row execute function app_private.fail_output();`);await as(a);
await assert.rejects(rpc('produce',{...payload,id:uid(),quantity_kg:1}),/falha simulada/);assert.deepEqual(await snapshot(),baseline);await db.exec('reset role;drop trigger fail_output on stock_items');await as(a);
// Rateio: 1 kg -> 333g + 333g + 334g, sem criar ou perder massa.
const thirds=await rpc('produce',{...payload,id:uid(),quantity_kg:1,composition:composition.map((c,i)=>({...c,percent:i===2?33.334:33.333}))});assert.deepEqual(thirds.composition.map(c=>c.quantity_kg),[.333,.333,.334]);assert.equal(thirds.composition.reduce((s,c)=>s+Math.round(c.quantity_kg*1000),0),1000);
const extra=await rpc('produce',{...payload,id:uid(),quantity_kg:10,composition:[{...composition[0],percent:70},...composition.slice(1),{item_id:sorgo,role:'outros',percent:10}]});assert.equal(extra.composition.reduce((s,c)=>s+Math.round(c.quantity_kg*1000),0),10000);assert.ok((await rpc('list')).some(r=>r.name==='Ração 70-15-5-10'));
// Categoria da receita fica protegida; nome do produto pode ser alterado.
product=(await snapshot()).items.find(i=>i.id===product.id);await assert.rejects(workspace('save_item',{...product,category:'ingrediente',expected:product.updated_at}),/categoria/);
await workspace('save_item',{...product,name:'Ração da fazenda',expected:product.updated_at});await rpc('produce',{...payload,id:uid(),quantity_kg:1});assert.ok((await rpc('list')).some(r=>r.name==='Ração da fazenda'));
await assert.rejects(db.query('update stock_feed_productions set quantity_kg=9999'),/permission denied/);
await as(b);assert.deepEqual(await rpc('list'),[]);assert.equal((await db.query('select count(*)::int n from stock_feed_productions')).rows[0].n,0);await assert.rejects(rpc('produce',payload),/já utilizado/);await assert.rejects(rpc('produce',{...payload,id:uid()}),/ingredientes/);
const bm=await create('Milho',1),bt=await create('Torta',1),bn=await create('Núcleo',1);const other=await rpc('produce',{...payload,id:uid(),farm_id:a,composition:composition.map((c,i)=>({...c,item_id:[bm,bt,bn][i]}))});assert.equal(other.farm_id,b,'fazenda é determinada pela sessão');
// Custo confirmado usa o saldo atual, inclusive após reposição com outro preço.
await workspace('move',{id:uid(),item_id:bm,kind:'entrada',quantity_kg:400,unit_cost:5,movement_date:'2026-10-18',notes:'Reposição com preço novo'});
const repriced=await rpc('produce',{...payload,id:uid(),composition:composition.map((c,i)=>({...c,item_id:[bm,bt,bn][i]}))});assert.equal(repriced.total_cost,1140);const outputB=(await snapshot()).items.find(i=>i.category==='racao');assert.equal(outputB.quantity_kg,1000);assert.equal(outputB.stock_value,1640);
await db.exec("select set_config('test.manager','false',false)");await assert.rejects(rpc('list'),/gestores/);assert.equal((await db.query('select count(*)::int n from stock_feed_recipes')).rows[0].n,0);await db.exec('reset role;set role anon');await assert.rejects(rpc('list'),/permission denied/);
await db.exec('reset role');await db.exec(sql);await db.exec("select set_config('test.manager','true',false)");await as(a);assert.equal((await rpc('list')).length,4,'reaplicação preserva composições');
await db.close();console.log('Produção: 500 kg, custos, transferência de valor, rateio, reenvio, composições, saldo insuficiente, rollback após baixa, isolamento, RLS, permissões e reaplicação aprovados.');
