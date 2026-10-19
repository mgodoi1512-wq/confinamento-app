import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
export async function testDietFeedStock({db,as,ownerA,ownerB,staffA,farmA,farmB,today,rpc}){
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261018140000_diet_feed_stock_integration.sql',import.meta.url),'utf8');
 await db.exec('reset role');await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261018130000_stock_feed_production.sql',import.meta.url),'utf8'));await db.exec(sql);await as(ownerB);
 const run=async(action,p={})=>(await db.query('select app_finance_workspace($1,$2) result',[action,JSON.stringify(p)])).rows[0].result;
 const catalog=async()=>(await db.query('select app_feed_stock() result')).rows[0].result;
 const create=async(name,category,quantity=100,cost=2)=>{const id=crypto.randomUUID();await run('save_item',{id,name,category,minimum_kg:0,expected:null});await run('move',{id:crypto.randomUUID(),item_id:id,kind:'entrada',quantity_kg:quantity,unit_cost:cost,movement_date:today,notes:'Teste de integração'});return id;};
 const milho=await create('Integração Milho','ingrediente',1000),torta=await create('Integração Torta','ingrediente',1000),nucleo=await create('Integração Núcleo','ingrediente',1000);
 const production={id:crypto.randomUUID(),quantity_kg:100,production_date:today,notes:'Teste',composition:[{item_id:milho,role:'energia',percent:80},{item_id:torta,role:'proteina',percent:15},{item_id:nucleo,role:'nucleo',percent:5}]};
 const produce=async()=>(await db.query("select app_stock_production('produce',$1) result",[JSON.stringify(production)])).rows[0].result;await produce();const racao=(await run('snapshot')).items.find(i=>i.name==='Ração 80-15-5').id,vol=await create('Integração Silagem','volumoso',100),alt=await create('Integração Ração alternativa','racao',100);
 const dietPayload={stockLinked:true,diet:{name:'Integração estoque dieta',is_active:true,dry_matter_pct:60},items:[{ingredient:'RAÇÃO',kg_per_head_day:3,body_weight_pct:null,stock_item_id:racao},{ingredient:'VOLUMOSO',kg_per_head_day:6,body_weight_pct:null,stock_item_id:vol}]};
 const key=crypto.randomUUID(),diet=await rpc('save_diet',dietPayload,key);assert.equal((await catalog()).links.filter(l=>l.diet_id===diet).length,2);assert.equal(await rpc('save_diet',dietPayload,key),diet,'reenvio não duplica dieta');
 await assert.rejects(rpc('save_diet',{...dietPayload,diet:{...dietPayload.diet,name:'Inválida'},items:[{...dietPayload.items[0],stock_item_id:crypto.randomUUID()}]}),/item do estoque/);assert.equal((await db.query("select count(*)::int n from diets where name='Inválida'")).rows[0].n,0);
 const pen=await rpc('save_pen',{code:'PEN-ESTOQUE-DIETA',capacity_head:100,status:'vazio'}),lot=await rpc('create_lot',{lot:{code:'LOT-ESTOQUE-DIETA',head_count:2,entry_date:today,entry_avg_weight_kg:300,target_weight_kg:500,pen_id:pen,diet_id:diet},animals:[],applyProtocol:false});
 const feedPayload={date:today,lotId:lot.id,dietId:diet,shift:'manha',mealCount:3,schedule:[{shift:'manha',percent:33.33},{shift:'tarde',percent:33.33},{shift:'noite',percent:33.34}],referenceWeight:300,headCount:2,dailyKgPerHead:9,ingredients:[{name:'RAÇÃO',bodyWeightPct:null,dailyKgPerHead:3},{name:'VOLUMOSO',bodyWeightPct:null,dailyKgPerHead:6}],actualKgPerHead:3,notes:null};
 const feed=async(p,k=crypto.randomUUID())=>(await db.query('select app_record_planned_feed($1,$2) result',[JSON.stringify(p),k])).rows[0].result;
 const before=(await run('snapshot')).items;const qty=async id=>(await catalog()).items.find(i=>i.id===id).quantity_kg;
 const request=crypto.randomUUID(),morning=await feed(feedPayload,request);assert.equal(await qty(racao),98);assert.equal(await qty(vol),96);assert.equal(await qty(milho),before.find(i=>i.id===milho).quantity_kg,'trato de ração pronta não baixa milho de novo');assert.equal((await feed(feedPayload,request)).id,morning.id);assert.equal(await qty(racao),98);
 const mapped=(await db.query('select stock_mapping from daily_feed_plans where id=$1',[morning.day_plan_id])).rows[0].stock_mapping;assert.equal(mapped.RAÇÃO,racao);
 // Alterar vínculo da dieta não altera os destinos do planejamento fixado.
 await rpc('save_diet',{...dietPayload,diet:{...dietPayload.diet,id:diet},items:[{...dietPayload.items[0],stock_item_id:alt},dietPayload.items[1]]});
 const afternoon=await feed({...feedPayload,shift:'tarde'});assert.equal(await qty(racao),96);assert.equal(await qty(alt),100);
 await rpc('delete_feed',{id:afternoon.id});assert.equal(await qty(racao),98);assert.equal(await qty(vol),96);
 // Insuficiência em um componente não deixa baixa parcial em nenhum outro.
 const baseline=await run('snapshot');await assert.rejects(feed({...feedPayload,shift:'tarde',actualKgPerHead:1000}),/insuficiente/);assert.deepEqual(await run('snapshot'),baseline);
 // Corrigir detalhes como gestor estorna e reaplica; trocar só total é recusado.
 await db.exec('reset role');const details=morning.ingredient_quantities.map(c=>({...c,totalKg:c.totalKg*2}));await db.query('update feed_logs set total_kg=12,kg_per_head=6,ingredient_quantities=$2 where id=$1',[morning.id,JSON.stringify(details)]);await as(ownerB);assert.equal(await qty(racao),96);assert.equal(await qty(vol),92);
 await db.exec('reset role');await assert.rejects(db.query('update feed_logs set total_kg=50 where id=$1',[morning.id]),/soma dos ingredientes/);await as(ownerB);assert.equal(await qty(racao),96);
 await rpc('delete_feed',{id:morning.id});assert.equal(await qty(racao),100);assert.equal(await qty(vol),100);
 const legacyPen=await rpc('save_pen',{code:'PEN-ESTOQUE-LEGADO',capacity_head:100,status:'vazio'}),legacyLot=await rpc('create_lot',{lot:{code:'LOT-ESTOQUE-LEGADO',head_count:2,entry_date:today,entry_avg_weight_kg:300,target_weight_kg:500,pen_id:legacyPen,diet_id:diet},animals:[],applyProtocol:false});
 // Via legada/leitura sem detalhamento é calculada no servidor.
 const legacy=await rpc('save_feed',{pen_id:legacyPen,lot_id:legacyLot.id,diet_id:diet,date:today,shift:'tarde',head_count:2,kg_per_head:3});assert.equal(await qty(alt),98);assert.equal(await qty(vol),96);await rpc('delete_feed',{id:legacy});
 // Componentes diferentes podem apontar para o mesmo item; a necessidade é somada.
 const grouped=await rpc('save_diet',{stockLinked:true,diet:{name:'Integração componentes agrupados',is_active:true},items:[{ingredient:'Energia',kg_per_head_day:2,stock_item_id:milho},{ingredient:'Proteína',kg_per_head_day:2,stock_item_id:milho}]});
 const mBefore=await qty(milho);const groupFeed=await rpc('save_feed',{pen_id:legacyPen,lot_id:legacyLot.id,diet_id:grouped,date:today,shift:'noite',head_count:2,kg_per_head:2});assert.equal(await qty(milho),mBefore-4);await rpc('delete_feed',{id:groupFeed});assert.equal(await qty(milho),mBefore);
 const unlinked=await rpc('save_diet',{diet:{name:'Integração legado sem vínculo',is_active:true},items:[{ingredient:'SEM-VÍNCULO',kg_per_head_day:1}]});await assert.rejects(rpc('save_feed',{pen_id:legacyPen,lot_id:legacyLot.id,diet_id:unlinked,date:today,shift:'tarde',head_count:2,kg_per_head:1}),/não está vinculado/);
 const multiDiet=await rpc('save_diet',{stockLinked:true,diet:{name:'Integração percentual multi-lote',is_active:true},items:[{ingredient:'Ração percentual',kg_per_head_day:0,body_weight_pct:1,stock_item_id:alt},{ingredient:'Volumoso fixo',kg_per_head_day:2,body_weight_pct:null,stock_item_id:vol}]});
 const multiPen=await rpc('save_pen',{code:'PEN-ESTOQUE-MULTI',capacity_head:100,status:'vazio'});
 for(const [code,heads,weight] of [['MULTI-1',2,300],['MULTI-2',3,500]])await rpc('create_lot',{lot:{code,head_count:heads,entry_date:today,entry_avg_weight_kg:weight,target_weight_kg:600,pen_id:multiPen,diet_id:multiDiet},animals:[],applyProtocol:false});
 // Peso ponderado = 420 kg; 1% PV = 4,2 kg e volumoso fixo = 2 kg.
 const beforeMulti=await qty(alt),beforeVol=await qty(vol);const multiFeed=await rpc('save_feed',{pen_id:multiPen,lot_id:null,diet_id:multiDiet,date:today,shift:'noite',head_count:5,kg_per_head:6.2});assert.equal(await qty(alt),beforeMulti-21);assert.equal(await qty(vol),beforeVol-10);await rpc('delete_feed',{id:multiFeed});assert.equal(await qty(alt),beforeMulti);
 await as(ownerA);const ca=await catalog();assert.ok(!ca.items.some(i=>i.id===racao));await assert.rejects(rpc('save_diet',{...dietPayload,diet:{...dietPayload.diet,name:'Tentativa cruzada'}}),/item do estoque/);
 // Operador vê apenas quantidades e pode tratar, sem acesso ao financeiro.
 await as(staffA);const operational=await catalog();assert.ok(operational.items.some(i=>i.id===racao));assert.ok(operational.items.every(i=>!('stock_value' in i)&&!('unit_cost' in i)));await assert.rejects(run('snapshot'),/gestores/);const opFeed=await feed(feedPayload);assert.ok(opFeed.id);
 await as(ownerB);assert.equal(await qty(racao),98);await rpc('delete_feed',{id:opFeed.id});
 await db.exec('reset role;set role anon');await assert.rejects(catalog(),/permission denied/);
 await db.exec('reset role');await db.exec(sql);await as(ownerB);assert.equal(await qty(racao),100);assert.ok((await catalog()).links.some(l=>l.diet_id===diet));
 console.log('DIETA/TRATO/ESTOQUE: vínculos atômicos, operador sem custos, ração sem dupla baixa, plano fixo, leitura legada, insuficiência sem baixa parcial, correção, exclusão, agrupamento, reenvio e isolamento aprovados.');
}
