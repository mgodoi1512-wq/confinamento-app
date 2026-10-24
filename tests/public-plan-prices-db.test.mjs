import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const guard=setTimeout(()=>{console.error('Tempo excedido nos testes de preços públicos');process.exit(1);},60000);
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;grant usage on schema public to anon,authenticated;
 create table public.platform_billing_settings(singleton boolean primary key,monthly_cents integer,annual_cents integer,mode text,integration_ready boolean);
 alter table public.platform_billing_settings enable row level security;
 revoke all on public.platform_billing_settings from public,anon,authenticated;
 insert into public.platform_billing_settings values(true,2490,24990,'automatic',true);`);
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261024030000_public_plan_prices.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const read=async()=> (await db.query('select public.app_public_plan_prices() as value')).rows[0].value;
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);assert.deepEqual(await read(),{monthlyCents:2490,annualCents:24990});
  await assert.rejects(db.query('select * from public.platform_billing_settings'),/permission denied/);
  await assert.rejects(db.query('update public.platform_billing_settings set monthly_cents=100'),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('update public.platform_billing_settings set monthly_cents=3990,annual_cents=39990');
 await db.exec('set role anon');assert.deepEqual(await read(),{monthlyCents:3990,annualCents:39990});await db.exec('reset role');
 await db.exec('delete from public.platform_billing_settings');assert.equal(await read(),null);
 console.log('PASS: preços atualizados sem deploy, retorno mínimo, consulta pública, tabela protegida, reaplicação e ausência de configuração.');
}finally{await db.close();clearTimeout(guard);}
