import fs from 'node:fs';
import assert from 'node:assert/strict';
export async function testIdentifyLegacyLots({db,as,rpc,ownerA,ownerB,farmA,today}){
 await as(ownerA);
 const settings=async p=>(await db.query('select app_production_settings($1) result',[JSON.stringify(p)])).rows[0].result;
 let config=await settings({systems:['confinamento','pasto'],default_system:'confinamento',expected:null});
 const curral=await rpc('save_pen',{code:'AUTO-CURRAL',capacity_head:100,status:'vazio'});
 const pasture=await rpc('save_pen',{code:'AUTO-PASTO',capacity_head:100,status:'vazio',location_type:'pasto'});
 const create=async(code,pen_id,production_system)=>rpc('create_lot',{lot:{code,pen_id,production_system,head_count:1,entry_date:today,entry_avg_weight_kg:400,target_weight_kg:600},animals:[],applyProtocol:false});
 const legacy=await create('AUTO-LEGACY',curral,'confinamento'),incompatible=await create('AUTO-INCOMPATIBLE',pasture,'pasto'),known=await create('AUTO-KNOWN',curral,'confinamento');
 // Simula dados anteriores à identificação, sem tocar em registros operacionais.
 await db.exec('reset role');
 await db.query('delete from lot_system_history where lot_id=any($1::uuid[])',[[legacy.id,incompatible.id]]);
 await db.query('update lots set production_system=null,system_started_on=null,system_updated_at=null where id=any($1::uuid[])',[[legacy.id,incompatible.id]]);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261018160000_identify_legacy_lots_on_system_selection.sql',import.meta.url),'utf8'));
 await as(ownerB);const foreignBefore=(await db.query('select id,production_system,system_updated_at from lots order by id')).rows;
 await as(ownerA);
 const get=async id=>(await db.query('select production_system,system_started_on,system_updated_at,pen_id from lots where id=$1',[id])).rows[0];
 const knownBefore=await get(known.id);
 let result=await settings({systems:['confinamento','pasto'],default_system:'confinamento',expected:config.systems_updated_at});
 assert.equal(result.identified_lots,0);assert.equal((await get(legacy.id)).production_system,null,'vários sistemas não inferem manejo');
 result=await settings({systems:['confinamento'],default_system:'confinamento',expected:config.systems_updated_at});
 assert.ok(result.identified_lots>=1);assert.ok(result.pending_lots>=1);
 assert.equal((await get(legacy.id)).production_system,'confinamento');assert.equal(new Date((await get(legacy.id)).system_started_on).toISOString().slice(0,10),today);assert.equal((await get(legacy.id)).pen_id,curral);
 assert.equal((await get(incompatible.id)).production_system,null,'local incompatível fica pendente');
 assert.equal((await db.query('select location_type from pens where id=$1',[pasture])).rows[0].location_type,'pasto');
 assert.deepEqual(await get(known.id),knownBefore,'manejo existente preservado');
 const history=(await db.query('select * from lot_system_history where lot_id=$1',[legacy.id])).rows;
 assert.equal(history.length,1);assert.equal(history[0].created_by,ownerA);assert.equal(history[0].farm_id,farmA);
 const replay=await settings({systems:['confinamento'],default_system:'confinamento',expected:config.systems_updated_at});
 assert.equal(replay.identified_lots,0);assert.equal((await db.query('select count(*)::int n from lot_system_history where lot_id=$1',[legacy.id])).rows[0].n,1);
 await as(ownerB);assert.deepEqual((await db.query('select id,production_system,system_updated_at from lots order by id')).rows,foreignBefore,'outra fazenda preservada');
 console.log('IDENTIFICAÇÃO AUTOMÁTICA: sistema único, compatibilidade, vários sistemas, histórico, replay e isolamento aprovados.');
}
