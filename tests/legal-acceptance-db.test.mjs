import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const db=new PGlite();
try{
await db.exec(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`);
const sql=fs.readFileSync(new URL('../supabase/migrations/20261023010000_legal_acceptances.sql',import.meta.url),'utf8');
const legacy=randomUUID();await db.query('insert into auth.users(id) values($1)',[legacy]);await db.exec(sql);await db.exec(sql);
assert.equal((await db.query('select count(*)::int n from public.app_legal_acceptances')).rows[0].n,0);
await db.query('insert into auth.users(id) values($1)',[randomUUID()]);
await db.exec('update public.app_legal_versions set enforce_on_signup=true');
const valid={terms_accepted:true,privacy_notice_acknowledged:true,terms_version:'2026-10-23.1',privacy_version:'2026-10-23.1',accepted_at:'2000-01-01'};
for(const metadata of [{},{...valid,terms_accepted:false},{...valid,privacy_notice_acknowledged:false},{...valid,terms_version:'old'},{...valid,privacy_version:'old'},{...valid,terms_version:null}]){
 const id=randomUUID();await assert.rejects(db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify(metadata)]),/Leia e aceite/);assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[id])).rows[0].n,0);
}
const a=randomUUID(),b=randomUUID();for(const id of [a,b])await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify(valid)]);
const receipt=(await db.query('select * from public.app_legal_acceptances where user_id=$1',[a])).rows[0];assert.equal(receipt.terms_version,valid.terms_version);assert.ok(new Date(receipt.accepted_at).getFullYear()>2000);
await db.query("update auth.users set raw_user_meta_data='{}' where id=$1",[a]);assert.deepEqual((await db.query('select * from public.app_legal_acceptances where user_id=$1',[a])).rows[0],receipt);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);await db.exec('set role authenticated');
assert.deepEqual((await db.query('select user_id from public.app_legal_acceptances')).rows.map(x=>x.user_id),[a]);
await assert.rejects(db.query('update public.app_legal_acceptances set terms_version=$1',['fake']),/permission denied/);await assert.rejects(db.query('delete from public.app_legal_acceptances'),/permission denied/);await assert.rejects(db.query('insert into public.app_legal_acceptances(user_id,terms_version,privacy_version) values($1,$2,$3)',[a,'fake','fake']),/permission denied/);await assert.rejects(db.query('update public.app_legal_versions set enforce_on_signup=false'),/permission denied/);
console.log('PASS: migração idempotente, sem aceite retroativo, transição de publicação, rejeição de aceite ausente/antigo, horário servidor, evidência independente de metadata e RLS por titular.');
}finally{await db.close();}
