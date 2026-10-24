// Ensaio exclusivamente local: reutiliza o banco fictício completo do teste de rebanho.
// Não lê .env, não conecta ao Supabase e não exporta dados de usuários reais.
import fs from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const path=new URL('./.tmp-restore-'+randomUUID()+'.mjs',import.meta.url);
const source=await fs.readFile(new URL('./herd-integrity-db.test.mjs',import.meta.url),'utf8');
const drill=String.raw`
const snapshot=async conn=>{
 const tables=(await conn.query("select schemaname,tablename from pg_tables where schemaname in ('public','app_private','auth') order by schemaname,tablename")).rows;
 const state={};
 for(const t of tables){const key=t.schemaname+'.'+t.tablename;state[key]=(await conn.query('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),\'[]\'::jsonb) as data from "'+t.schemaname+'"."'+t.tablename+'" r')).rows[0].data;}
 state.policies=(await conn.query("select * from pg_policies where schemaname in ('public','app_private') order by schemaname,tablename,policyname")).rows;
 state.permissions=(await conn.query("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,p.proacl::text as acl,md5(pg_get_functiondef(p.oid)) as hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind='f' order by n.nspname,p.proname,args")).rows;
 return state;
};
const before=await snapshot(db);
await db.exec(fs.readFileSync(new URL('../scripts/conferir-rebanho-todos-lotes.sql',import.meta.url),'utf8'));
assert.deepEqual(await snapshot(db),before,'conferência não deve modificar nenhum dado');
const backup=await db.dumpDataDir('gzip');
assert.ok(backup.size>0);
const recovered=new PGlite({loadDataDir:backup});
try{
 assert.deepEqual(await snapshot(recovered),before,'dados, políticas e funções restaurados devem ser idênticos');
 await recovered.exec('set role anon');
 await assert.rejects(recovered.query('select public.app_mutate($1,$2,$3)',['delete_animal',JSON.stringify({id:herdAnimals[0].id}),crypto.randomUUID()]),/permission denied/);
 await recovered.exec('reset role');
 await recovered.query("select set_config('request.jwt.claim.sub',$1,false)",[ownerB]);await recovered.exec('set role authenticated');
 await recovered.query('select public.app_mutate($1,$2,$3)',['delete_animal',JSON.stringify({id:herdAnimals[0].id}),key]);
 await recovered.exec('reset role');
 assert.equal((await recovered.query('select head_count from public.lots where id=$1',[herdId])).rows[0].head_count,0,'replay restaurado não pode baixar novamente');
 console.log('RESTAURO LOCAL: banco fictício exportado e restaurado em instância separada; dados, RLS, funções, permissões e replay conferidos. Não comprova recuperação do Supabase real.');
}finally{await recovered.close();}
`;
const guard=setTimeout(()=>{console.error('Tempo excedido no ensaio local de restauração');process.exit(1);},60000);
try{
 await fs.writeFile(path,source.replace(/await db\.close\(\);\s*$/,drill+'\nawait db.close();'));
 await import(pathToFileURL(fileURLToPath(path)).href);
}finally{clearTimeout(guard);await fs.rm(path,{force:true});}
