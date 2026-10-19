import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
export async function testProductionSystems({db,as,rpc,tenant,ownerA,ownerB,staffA,admin,farmA,farmB,today}){
 await as(ownerB);
 const oldPen=await rpc('save_pen',{code:'SYS-LEGACY-PEN',capacity_head:100,status:'vazio'});
 const oldLot=await rpc('create_lot',{lot:{code:'SYS-LEGACY',head_count:2,entry_date:today,entry_avg_weight_kg:300,target_weight_kg:500,pen_id:oldPen},animals:[],applyProtocol:false});
 const oldLot2=await rpc('create_lot',{lot:{code:'SYS-LEGACY-PLANNED',head_count:1,entry_date:today,entry_avg_weight_kg:400,target_weight_kg:600,pen_id:oldPen},animals:[],applyProtocol:false});
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261018150000_farm_production_systems.sql',import.meta.url),'utf8');await db.exec('reset role');await db.exec(sql);await as(ownerB);
 const settings=async p=>(await db.query('select app_production_settings($1) result',[JSON.stringify(p)])).rows[0].result;
 const change=async(p,key=crypto.randomUUID())=>(await db.query('select app_change_lot_system($1,$2) result',[JSON.stringify(p),key])).rows[0].result;
 const farm=async()=>(await db.query('select * from farms where id=$1',[farmB])).rows[0];
 const readLot=async id=>(await db.query('select * from lots where id=$1',[id])).rows[0];
 const histories=async id=>(await db.query('select * from lot_system_history where lot_id=$1 order by created_at',[id])).rows;
 assert.deepEqual((await farm()).production_systems,[]);assert.equal((await readLot(oldLot.id)).production_system,null);assert.equal((await db.query('select location_type from pens where id=$1',[oldPen])).rows[0].location_type,'curral');
 const input={lot:{code:'SYS-NEW',head_count:2,entry_date:today,entry_avg_weight_kg:400,target_weight_kg:600,pen_id:oldPen},animals:[{ear_tag:'SYS-A',entry_weight_kg:400,sex:'macho'},{ear_tag:'SYS-B',entry_weight_kg:400,sex:'macho'}],applyProtocol:false};
 await assert.rejects(rpc('create_lot',input),/Informe os sistemas/);
 for(const bad of [{systems:[],default_system:''},{systems:['pasto','pasto'],default_system:'pasto'},{systems:['pasto'],default_system:'confinamento'},{systems:['invalido'],default_system:'invalido'}])await assert.rejects(settings({...bad,expected:null}));
 let config=await settings({systems:['confinamento','semiconfinamento','pasto'],default_system:'confinamento',expected:null});
 const key=crypto.randomUUID(),conf=await rpc('create_lot',input,key);assert.equal(conf.production_system,'confinamento');assert.equal((await rpc('create_lot',input,key)).production_system,'confinamento');assert.equal((await histories(conf.id)).length,1);
 const pasture=await rpc('save_pen',{code:'SYS-PASTO',capacity_head:100,status:'vazio',location_type:'pasto'}),paddock=await rpc('save_pen',{code:'SYS-PIQUETE',capacity_head:100,status:'vazio',location_type:'piquete'});
 const grass=await rpc('create_lot',{...input,lot:{...input.lot,code:'SYS-GRASS',pen_id:pasture,production_system:'pasto'},animals:[]});assert.equal(grass.production_system,'pasto');
 await assert.rejects(rpc('create_lot',{...input,lot:{...input.lot,code:'SYS-WRONG',pen_id:oldPen,production_system:'pasto'},animals:[]}),/exige|exigem/);assert.equal((await db.query("select count(*)::int n from lots where code='SYS-WRONG'")).rows[0].n,0);
 await assert.rejects(rpc('save_pen',{id:pasture,code:'SYS-ALTERED',capacity_head:100,status:'ativo',location_type:'curral'}),/incompatível/);assert.equal((await db.query('select code from pens where id=$1',[pasture])).rows[0].code,'SYS-PASTO');
 await assert.rejects(settings({systems:['confinamento'],default_system:'confinamento',expected:config.systems_updated_at}),/lotes ativos/);
 await assert.rejects(settings({systems:['confinamento','pasto'],default_system:'pasto',expected:null}),/outro gestor/);
 const transition={lot_id:conf.id,system:'semiconfinamento',pen_id:paddock,effective_date:today,expected:conf.system_updated_at};const transitionKey=crypto.randomUUID();await change(transition,transitionKey);await change(transition,transitionKey);
 let after=await readLot(conf.id);assert.equal(after.production_system,'semiconfinamento');assert.equal(after.pen_id,paddock);assert.equal((await histories(conf.id)).length,2);assert.equal((await db.query('select count(*)::int n from animals where lot_id=$1 and pen_id=$2',[conf.id,paddock])).rows[0].n,2);
 await assert.rejects(change({...transition,system:'pasto'}),/Recarregue/);
 await assert.rejects(change({...transition,system:'pasto'},transitionKey),/já utilizado/);
 await change({lot_id:conf.id,system:'pasto',pen_id:paddock,effective_date:today,expected:after.system_updated_at});assert.equal((await histories(conf.id)).length,3);
 await change({lot_id:oldLot.id,system:'confinamento',pen_id:oldPen,effective_date:today,expected:null});assert.equal((await histories(oldLot.id)).length,1,'lote legado é identificado explicitamente');
 // Plano do dia já iniciado bloqueia troca de manejo e também transferência comum.
 const stockId=crypto.randomUUID();await db.query("select app_finance_workspace('save_item',$1)",[JSON.stringify({id:stockId,name:'SYS-INGREDIENTE',category:'ingrediente',minimum_kg:0,expected:null})]);await db.query("select app_finance_workspace('move',$1)",[JSON.stringify({id:crypto.randomUUID(),item_id:stockId,kind:'entrada',quantity_kg:100,unit_cost:2,movement_date:today,notes:'Teste sistemas'})]);
 const diet=await rpc('save_diet',{stockLinked:true,diet:{name:'SYS-DIETA',is_active:true},items:[{ingredient:'SYS-INGREDIENTE',kg_per_head_day:3,stock_item_id:stockId}]});
 const oldPlanPayload={date:today,lotId:oldLot2.id,dietId:diet,shift:'manha',mealCount:3,schedule:[{shift:'manha',percent:33.33},{shift:'tarde',percent:33.33},{shift:'noite',percent:33.34}],referenceWeight:400,headCount:1,dailyKgPerHead:3,ingredients:[{name:'SYS-INGREDIENTE',bodyWeightPct:null,dailyKgPerHead:3}],actualKgPerHead:1,notes:null};
 const oldFeed=(await db.query('select app_record_planned_feed($1,$2) result',[JSON.stringify(oldPlanPayload),crypto.randomUUID()])).rows[0].result;
 await change({lot_id:oldLot2.id,system:'confinamento',pen_id:oldPen,effective_date:today,expected:null});assert.equal((await readLot(oldLot2.id)).production_system,'confinamento');assert.equal((await db.query('select stock_mapping from daily_feed_plans where id=$1',[oldFeed.day_plan_id])).rows[0].stock_mapping['SYS-INGREDIENTE'],stockId);
 const planned=await rpc('create_lot',{lot:{...input.lot,code:'SYS-PLANNED',production_system:'confinamento',diet_id:diet,head_count:1},animals:[],applyProtocol:false});
 await db.query('select app_record_planned_feed($1,$2)',[JSON.stringify({date:today,lotId:planned.id,dietId:diet,shift:'manha',mealCount:3,schedule:[{shift:'manha',percent:33.33},{shift:'tarde',percent:33.33},{shift:'noite',percent:33.34}],referenceWeight:400,headCount:1,dailyKgPerHead:3,ingredients:[{name:'SYS-INGREDIENTE',bodyWeightPct:null,dailyKgPerHead:3}],actualKgPerHead:1,notes:null}),crypto.randomUUID()]);
 await assert.rejects(change({lot_id:planned.id,system:'pasto',pen_id:pasture,effective_date:today,expected:planned.system_updated_at}),/trato de hoje/);
 const another=await rpc('save_pen',{code:'SYS-OUTRO-CURRAL',capacity_head:100,status:'vazio'});await assert.rejects(rpc('transfer_lot',{lot:planned,penId:another}),/trato de hoje/);assert.equal((await readLot(planned.id)).pen_id,oldPen);
 // Dados de outra fazenda não podem ser usados como destino, nem lidos no histórico.
 await as(ownerA);await assert.rejects(change({lot_id:conf.id,system:'pasto',pen_id:paddock,effective_date:today,expected:null}),/indisponível/);assert.equal((await histories(conf.id)).length,0);
 const foreignPen=await rpc('save_pen',{code:'SYS-FOREIGN',capacity_head:100,status:'vazio',location_type:'pasto'});
 await as(ownerB);after=await readLot(conf.id);await assert.rejects(change({lot_id:conf.id,system:'pasto',pen_id:foreignPen,effective_date:today,expected:after.system_updated_at}),/indisponível/);
 // Novo cadastro exige a seleção, sem alterar a aprovação vigente da conta.
 const newOwner=crypto.randomUUID();await db.exec('reset role');await db.query('insert into auth.users(id,email) values($1,$2)',[newOwner,'systems@test.invalid']);await as(admin);await tenant('decide_request',{userId:newOwner,status:'approved'});await as(newOwner);
 await assert.rejects(tenant('create_farm',{name:'Fazenda incompleta'}),/sistemas de criação/);
 const created=await tenant('create_farm',{name:'Fazenda a pasto',production_systems:['pasto'],default_production_system:'pasto'});const newFarm=(await db.query('select * from farms where id=$1',[created.farmId])).rows[0];assert.deepEqual(newFarm.production_systems,['pasto']);assert.equal(newFarm.default_production_system,'pasto');assert.equal((await db.query('select count(*)::int n from diets where farm_id=$1',[created.farmId])).rows[0].n,0,'nova fazenda só a pasto não recebe dietas automáticas de confinamento');
 await as(staffA);await assert.rejects(settings({systems:['pasto'],default_system:'pasto',expected:null}),/gestores/);await assert.rejects(change({lot_id:conf.id,system:'pasto',pen_id:paddock,effective_date:today,expected:null}),/gestores/);await assert.rejects(db.query('update lots set production_system=$2 where id=$1',[conf.id,'confinamento']),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(settings({systems:['pasto'],default_system:'pasto',expected:null}),/permission denied/);
 await db.exec('reset role');await db.exec(sql);await as(ownerB);assert.equal((await readLot(conf.id)).production_system,'pasto');assert.equal((await histories(conf.id)).length,3);assert.deepEqual((await farm()).production_systems,config.production_systems);
 console.log('SISTEMAS: legado sem inferência, seleção obrigatória, padrão, tipos de local, compatibilidade, histórico, animais, replay, versões, isolamento, papéis e reaplicação aprovados.');
}
