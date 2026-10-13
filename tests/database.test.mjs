import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Banco PostgreSQL local e descartável. Nenhuma conexão ao Supabase real.
process.on('uncaughtException', (error) => { console.error(error.message, error.where ?? '', error.internalQuery ?? ''); process.exit(1); });
const textProfiles = process.argv.includes('--text-profiles');
const db = new PGlite();
const manager='00000000-0000-4000-8000-000000000001';
const operator='00000000-0000-4000-8000-000000000002';
const outsider='00000000-0000-4000-8000-000000000003';
await db.exec(`create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create role authenticated; create role anon;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;`);
for (const name of ['20261010173428_schema_base.sql','20261010173434_enable_rls.sql']) {
  let schema = fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
  if (textProfiles && name.includes('schema_base')) {
    schema = schema.replace('id uuid primary key references auth.users(id) on delete cascade,', 'id text primary key,')
      .replaceAll('recorded_by uuid references public.profiles(id)', 'recorded_by text references public.profiles(id)')
      .replaceAll('p.id = auth.uid()', 'p.id = auth.uid()::text')
      .replaceAll('auth.uid() = id', 'auth.uid()::text = id');
  }
  await db.exec(schema);
}
if (textProfiles) {
  for (const table of ['animals','diet_items','diets','farms','feed_logs','health_events','lots','pens','protocol_items','protocols','trough_readings','weighings','weight_records']) {
    await db.exec(`alter table public.${table} add column owner_id text;`);
  }
  for (const table of ['diets','lots','pens','protocols']) {
    await db.exec(`alter table public.${table} add column farm_id uuid references public.farms(id);`);
  }
}
await db.query(`insert into auth.users(id,email) values($1,'manager@test.invalid'),($2,'operator@test.invalid')`,[manager,operator]);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261012220000_integrity_and_access.sql', import.meta.url), 'utf8'));
if (process.argv.includes('--upgrade')) {
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261013010000_weight_record_corrections.sql', import.meta.url), 'utf8'));
}
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261013020000_edit_weight_only.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261013030000_trough_application_feedback.sql', import.meta.url), 'utf8'));
const as = async (id) => { await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
const rpc = async (op,payload,id=crypto.randomUUID()) => (await db.query('select public.app_mutate($1,$2::jsonb,$3::uuid) as result',[op,JSON.stringify(payload),id])).rows[0].result;
const count = async (table,clause='true') => Number((await db.query(`select count(*) as n from public.${table} where ${clause}`)).rows[0].n);
const today=(await db.query('select public.app_today()::text as day')).rows[0].day;
await as(manager);
assert.equal((await db.query('select public.has_app_access() as access')).rows[0].access,true);
const applyFeedback = async (day=today,key=crypto.randomUUID()) =>
  (await db.query('select public.app_apply_readings($1,$2) as result',[day,key])).rows[0].result;
assert.deepEqual(await applyFeedback(),{created:0,alreadyApplied:0,zeroAdjustment:0},'sem leituras não informa criação de trato');
assert.equal((await db.query(`select data_type from information_schema.columns where table_schema='public' and table_name='app_members' and column_name='user_id'`)).rows[0].data_type,textProfiles ? 'text' : 'uuid');
assert.equal((await db.query(`select data_type from information_schema.columns where table_schema='public' and table_name='lot_exits' and column_name='recorded_by'`)).rows[0].data_type,textProfiles ? 'text' : 'uuid');
await rpc('update_profile',{id:operator,enabled:true});
const penId=await rpc('save_pen',{code:'P1',capacity_head:20,status:'vazio'});
const pen2=await rpc('save_pen',{code:'P2',capacity_head:20,status:'vazio'});
const penSmall=await rpc('save_pen',{code:'P3',capacity_head:1,status:'vazio'});
const base={code:'L1',head_count:3,entry_avg_weight_kg:400,target_weight_kg:520,entry_date:today,pen_id:penId};
const animals=['A1','A2','A3'].map(ear_tag=>({ear_tag,entry_weight_kg:400,sex:'macho'}));
const requestId=crypto.randomUUID();
const lot=await rpc('create_lot',{lot:base,animals,applyProtocol:false},requestId);
assert.equal((await rpc('create_lot',{lot:base,animals,applyProtocol:false},requestId)).id,lot.id);
assert.equal(await count('lots'),1);
await assert.rejects(rpc('create_lot',{lot:{...base,code:'LFAIL'},animals:[...animals],applyProtocol:false}),/duplicate/i);
assert.equal(await count('lots'),1,'falha em animais desfaz o lote');
const current=(await db.query('select * from public.animals order by ear_tag')).rows;
const exitPayload={lot:{id:lot.id},reason:'venda',headCount:1,animalIds:[current[0].id],date:today,closeLot:false};
await rpc('register_exit',exitPayload);
assert.equal((await db.query('select head_count from public.lots where id=$1',[lot.id])).rows[0].head_count,2);
assert.equal(await count('animals',"status='vendido'"),1,'saída parcial baixa somente o selecionado');
await assert.rejects(rpc('register_exit',{...exitPayload,headCount:3}),/Saída inválida/);
await assert.rejects(rpc('register_exit',{...exitPayload,animalIds:[current[1].id],closeLot:true}),/saldo/);
await assert.rejects(db.query('update public.lots set head_count=0'),/permission denied/);
const end=(await db.query('select (public.app_today()+30)::text as day')).rows[0].day;
await rpc('save_health_event',{event:{animal_id:current[1].id,kind:'tratamento',product:'P',event_date:today,withdrawal_until:end}});
await rpc('save_health_event',{event:{animal_id:current[1].id,kind:'vacina',product:'V',event_date:today,withdrawal_until:null}});
const treated=(await db.query('select * from public.animals where id=$1',[current[1].id])).rows[0];
assert.equal(treated.status,'tratamento');assert.equal(treated.withdrawal_until.toISOString().slice(0,10),end);
await assert.rejects(rpc('register_exit',{...exitPayload,reason:'abate',animalIds:[current[1].id]}),/carência/);
await assert.rejects(rpc('transfer_lot',{lot:{id:lot.id},penId:penSmall}),/Capacidade/);
await rpc('transfer_lot',{lot:{id:lot.id},penId:pen2});
assert.equal((await db.query('select pen_id from public.animals where id=$1',[current[1].id])).rows[0].pen_id,pen2,'animal em tratamento também é transferido');
const weighing={lot_id:lot.id,date:today,kind:'individual',head_count_weighed:1,avg_weight_kg:450};
const ws=await rpc('save_weighing',{weighing,records:[{animal_id:current[2].id,weight_kg:450}]});
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[current[2].id])).rows[0].current_weight_kg,'450.00');
await rpc('delete_weighing',{id:ws.id});
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[current[2].id])).rows[0].current_weight_kg,'400.00');
await assert.rejects(rpc('save_weighing',{weighing,records:[{animal_id:current[0].id,weight_kg:450}]}),/baixado/);
assert.equal(await count('weighings'),0,'pesagem inválida não deixa sessão parcial');
await rpc('save_health_event',{event:{animal_id:current[2].id,kind:'obito',diagnosis:'Teste',event_date:today}});
assert.equal((await db.query('select head_count from public.lots where id=$1',[lot.id])).rows[0].head_count,1);
await assert.rejects(rpc('save_health_event',{event:{animal_id:current[2].id,kind:'obito',event_date:today}}),/indisponível/);
const diet=await rpc('save_diet',{diet:{name:'D1'},items:[{ingredient:'Milho',kg_per_head_day:5}]});
await assert.rejects(rpc('save_diet',{diet:{id:diet,name:'D1'},items:[{ingredient:'Milho',kg_per_head_day:-1}]}),/inválida/);
assert.equal(await count('diet_items'),1,'falha não apaga composição anterior');
const protocolId=await rpc('save_protocol',{protocol:{name:'Entrada'},items:[{kind:'vacina',product:'Vac',withdrawal_days:10,dose:'1'}]});
const lotProtocol=await rpc('create_lot',{lot:{...base,code:'LPRO',head_count:1,pen_id:penId,protocol_id:protocolId},animals:[{ear_tag:'PRO',entry_weight_kg:400,sex:'macho'}],applyProtocol:true});
assert.equal(await count('health_events',`lot_id='${lotProtocol.id}' and kind='protocolo'`),1);
assert.equal((await db.query('select withdrawal_until is not null as present from public.animals where lot_id=$1',[lotProtocol.id])).rows[0].present,true);
const reading=await rpc('save_reading',{pen_id:pen2,date:today,score:0,base_kg_per_head:10,adjustment_pct:6});
await rpc('apply_readings',{date:today});await rpc('apply_readings',{date:today});
assert.equal(await count('feed_logs'),1,'aplicação repetida não duplica nem acumula ajuste');
await assert.rejects(rpc('save_reading',{pen_id:pen2,date:today,score:1,base_kg_per_head:10,adjustment_pct:2}),/reaplicada/);
await assert.rejects(rpc('update_profile',{id:manager,enabled:false}),/pelo menos um gestor/);
// Pesagem retroativa não substitui a medição mais recente.
const earlier=(await db.query('select (public.app_today()-20)::text as day')).rows[0].day;
const mid=(await db.query('select (public.app_today()-10)::text as day')).rows[0].day;
const retro=await rpc('create_lot',{lot:{...base,code:'RETRO',head_count:1,entry_date:earlier,pen_id:penId},animals:[{ear_tag:'RETRO',entry_weight_kg:400,sex:'macho'}],applyProtocol:false});
const retroAnimal=(await db.query('select id from public.animals where lot_id=$1',[retro.id])).rows[0].id;
const recent=await rpc('save_weighing',{weighing:{...weighing,lot_id:retro.id,date:today},records:[{animal_id:retroAnimal,weight_kg:460}]});
await rpc('save_weighing',{weighing:{...weighing,lot_id:retro.id,date:mid},records:[{animal_id:retroAnimal,weight_kg:430}]});
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[retroAnimal])).rows[0].current_weight_kg,'460.00');
await rpc('delete_weighing',{id:recent.id});
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[retroAnimal])).rows[0].current_weight_kg,'430.00');
// Óbito coletivo conta cabeças e fecha saldo; abate sem identificação é bloqueado.
const anonymousLot=await rpc('create_lot',{lot:{...base,code:'ANON',head_count:2,pen_id:penId},animals:[],applyProtocol:false});
await assert.rejects(rpc('register_exit',{lot:{id:anonymousLot.id},reason:'abate',headCount:1,animalIds:[],date:today,closeLot:false}),/identificação/);
await rpc('register_exit',{lot:{id:anonymousLot.id},reason:'obito',headCount:2,animalIds:[],date:today,closeLot:true});
assert.equal((await db.query('select status from public.lots where id=$1',[anonymousLot.id])).rows[0].status,'encerrado');
assert.equal((await db.query('select head_count from public.health_events where lot_id=$1 and kind=$2',[anonymousLot.id,'obito'])).rows[0].head_count,2);
// Edição da leitura antes da aplicação e trato manual validados.
await rpc('save_reading',{pen_id:penId,date:today,score:1,base_kg_per_head:5,adjustment_pct:2});
await rpc('save_reading',{pen_id:penId,date:today,score:2,base_kg_per_head:6,adjustment_pct:0});
assert.equal(await count('trough_readings',`pen_id='${penId}'`),1);
const feed=await rpc('save_feed',{pen_id:penId,lot_id:retro.id,date:today,shift:'tarde',head_count:1,kg_per_head:5});
await rpc('delete_feed',{id:feed});
const standAlone=await rpc('save_animal',{ear_tag:'SOLO',status:'ativo',health_status:'saudavel',entry_weight_kg:300,current_weight_kg:300});
await rpc('save_animal',{id:standAlone,ear_tag:'SOLO',status:'ativo',health_status:'saudavel',entry_weight_kg:300,current_weight_kg:310});
await rpc('delete_animal',{id:standAlone});
await assert.rejects(rpc('delete_animal',{id:retroAnimal}),/histórico/);
await rpc('save_farm',{id:(await db.query('select id from public.farms limit 1')).rows[0].id,name:'Fazenda corrigida'});
await assert.rejects(rpc('save_diet',{diet:{name:'NaN'},items:[{ingredient:'Invalido',kg_per_head_day:'NaN'}]}),/finite_/);
await assert.rejects(rpc('create_lot',{lot:{...base,code:'DIF'},animals,applyProtocol:false},requestId),/outros dados/);
const emptyPen=await rpc('save_pen',{code:'EMPTY',capacity_head:10,status:'vazio'});
await rpc('delete_pen',{id:emptyPen});
const emptyDiet=await rpc('save_diet',{diet:{name:'EMPTY'},items:[]});await rpc('delete_diet',{id:emptyDiet});
const emptyProtocol=await rpc('save_protocol',{protocol:{name:'EMPTY'},items:[]});await rpc('delete_protocol',{id:emptyProtocol});
// A nova aplicação comunica gravação real e repetição sem criar duplicatas.
assert.deepEqual(await applyFeedback(),{created:0,alreadyApplied:1,zeroAdjustment:1},'aplicação anterior também é reconhecida');
const feedbackLot=await rpc('create_lot',{lot:{...base,code:'FEEDBACK',head_count:1,pen_id:penSmall},animals:[],applyProtocol:false});
await rpc('save_reading',{pen_id:penSmall,date:today,score:0,base_kg_per_head:5,adjustment_pct:6});
const feedbackKey=crypto.randomUUID();
const feedbackFirst=await applyFeedback(today,feedbackKey);
assert.deepEqual(feedbackFirst,{created:1,alreadyApplied:1,zeroAdjustment:1});
assert.deepEqual(await applyFeedback(today,feedbackKey),feedbackFirst,'replay retorna o resultado original');
const feedbackAgain=await applyFeedback();
assert.deepEqual(feedbackAgain,{created:0,alreadyApplied:2,zeroAdjustment:1},'novo clique reconhece o que já foi aplicado');
assert.equal(await count('feed_logs',`pen_id='${penSmall}'`),1);
const adjustedFeed=(await db.query('select * from public.feed_logs where pen_id=$1',[penSmall])).rows[0];
assert.equal(adjustedFeed.kg_per_head,'5.300');assert.equal(adjustedFeed.total_kg,'5.30');
await assert.rejects(applyFeedback(earlier),/dia atual/);
// Correção de um registro mantém os demais e respeita pesagens posteriores.
const correctionLot = await rpc('create_lot', {lot:{...base,code:'CORRECAO',head_count:2,entry_date:earlier,pen_id:penId},
  animals:[{ear_tag:'COR1',entry_weight_kg:410,sex:'macho'},{ear_tag:'COR2',entry_weight_kg:390,sex:'macho'}],applyProtocol:false});
const correctionAnimals=(await db.query('select * from public.animals where lot_id=$1 order by ear_tag',[correctionLot.id])).rows;
const correctionSession=await rpc('save_weighing',{weighing:{...weighing,lot_id:correctionLot.id,date:mid,head_count_weighed:2},
  records:[{animal_id:correctionAnimals[0].id,weight_kg:420},{animal_id:correctionAnimals[1].id,weight_kg:400}]});
let correctionRecords=(await db.query('select * from public.weight_records where weighing_id=$1 order by weight_kg desc',[correctionSession.id])).rows;
const nextSession=await rpc('save_weighing',{weighing:{...weighing,lot_id:correctionLot.id,date:today},records:[{animal_id:correctionAnimals[0].id,weight_kg:450}]});
const correct = async (record,count,weight,deleteRecord=false,removeEmpty=false,requestId=crypto.randomUUID()) =>
  (await db.query('select public.app_correct_weight_record($1,$2,$3,$4,$5,$6,$7) as result',
    [record.id,weight,deleteRecord,removeEmpty,record.weight_kg,count,requestId])).rows[0].result;
const originalCorrectionRecord={...correctionRecords[0]};
const editKey=crypto.randomUUID();
const corrected=await correct(originalCorrectionRecord,2,430,false,false,editKey);
assert.equal(corrected.headCount,2);assert.equal(corrected.avgWeight,415);assert.equal(corrected.weighingDeleted,false);
assert.deepEqual(await correct(originalCorrectionRecord,2,430,false,false,editKey),corrected,'editar novamente com mesma chave retorna resultado, sem nova alteração');
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[correctionAnimals[0].id])).rows[0].current_weight_kg,'450.00','correção antiga preserva o último peso');
await assert.rejects(correct(originalCorrectionRecord,2,440),/mudou/);
correctionRecords=(await db.query('select * from public.weight_records where weighing_id=$1 order by weight_kg desc',[correctionSession.id])).rows;
await assert.rejects(correct(correctionRecords[0],2,-1),/positivo/);
await assert.rejects(correct(correctionRecords[0],2,'NaN'),/positivo/);
assert.equal((await db.query('select avg_weight_kg from public.weighings where id=$1',[correctionSession.id])).rows[0].avg_weight_kg,'415.00');
// Exclusão individual é bloqueada, mesmo para gestor; quantidade não muda.
await assert.rejects(correct(correctionRecords[1],2,null,true,false),/Exclusão individual desabilitada/);
await assert.rejects(correct(correctionRecords[1],2,null,true,true),/Exclusão individual desabilitada/);
assert.equal(await count('weight_records',`weighing_id='${correctionSession.id}'`),2);
assert.equal((await db.query('select head_count_weighed from public.weighings where id=$1',[correctionSession.id])).rows[0].head_count_weighed,2);
const lastCorrectionRecord=(await db.query('select * from public.weight_records where weighing_id=$1',[nextSession.id])).rows[0];
const editedLast=await correct(lastCorrectionRecord,1,460);
assert.equal(editedLast.avgWeight,460);assert.equal(editedLast.headCount,1);assert.equal(editedLast.weighingDeleted,false);
await assert.rejects(correct({...lastCorrectionRecord,weight_kg:460},1,null,true,true),/Exclusão individual desabilitada/);
assert.equal(await count('weight_records',`weighing_id='${nextSession.id}'`),1,'exclusão do único peso também é bloqueada');
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[correctionAnimals[0].id])).rows[0].current_weight_kg,'460.00');
// Exclusão da sessão completa continua funcionando e restaura os pesos anteriores.
await rpc('delete_weighing',{id:correctionSession.id});
assert.equal(await count('weight_records',`weighing_id='${correctionSession.id}'`),0);
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[correctionAnimals[1].id])).rows[0].current_weight_kg,'390.00');
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[correctionAnimals[0].id])).rows[0].current_weight_kg,'460.00');
await rpc('delete_weighing',{id:nextSession.id});
assert.equal((await db.query('select current_weight_kg from public.animals where id=$1',[correctionAnimals[0].id])).rows[0].current_weight_kg,'410.00');
// Pesagem amostral não pode ser alterada pela correção individual.
const sample=await rpc('save_weighing',{weighing:{...weighing,lot_id:correctionLot.id,kind:'amostral',head_count_weighed:1},records:[]});
await db.exec('reset role');
const sampleRecord=(await db.query('insert into public.weight_records(weighing_id,animal_id,weight_kg) values($1,$2,410) returning *',[sample.id,correctionAnimals[0].id])).rows[0];
await as(manager);
await assert.rejects(correct(sampleRecord,1,420),/apenas em pesagens individuais/);
await db.exec('reset role');
await db.query('insert into auth.users(id,email) values($1,$2)',[outsider,'outsider@test.invalid']);
assert.equal((await db.query('select role from public.profiles where id=$1',[outsider])).rows[0].role,'operador');
await as(outsider);
assert.equal(await count('lots'),0,'cadastro livre não concede leitura');
await assert.rejects(rpc('save_farm',{name:'Invasor'}),/não autorizado/);
await assert.rejects(correct(sampleRecord,1,420),/não autorizado/);
await assert.rejects(applyFeedback(),/não autorizado/);
await as(operator);
await assert.rejects(rpc('save_diet',{diet:{name:'Não autorizado'},items:[]}),/Somente gestor/);
console.log(`Esquema de perfis: ${textProfiles ? 'TEXT' : 'UUID'}`);
console.log('PASSOU: feedback de ajuste criado, já aplicado, compatibilidade com aplicação anterior e ausência de duplicação.');
console.log('PASSOU: edição individual mantendo quantidade, exclusão individual bloqueada, exclusão de sessão permitida, peso vigente, dados desatualizados, repetição idempotente e autorização.');
console.log('PASSOU: migrações, autorização, rollback, replay, saída parcial, carência, transferência, pesagem, óbito, dieta, protocolo e leitura.');
await db.close();
