import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const mock='data:text/javascript;base64,'+Buffer.from('export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:"user"}}}})},rpc:async(_,body)=>globalThis.__earTagTest.rpc(body)};').toString('base64');
const source=fs.readFileSync(new URL('../src/lib/mutations.ts',import.meta.url),'utf8').replace('"@/integrations/supabase/client"',JSON.stringify(mock));
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {mutateApp}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const warning='BRINCOS_OUTROS_LOTES:'+JSON.stringify([{earTag:'100',lotCode:'Lote 1'},{earTag:'100',lotCode:'Lote 2'}]);
function setup(accept,message=warning){
 const calls=[],prompts=[];
 globalThis.window={confirm:text=>{prompts.push(text);return accept;}};
 globalThis.__earTagTest={rpc:async body=>{calls.push(body);return calls.length===1?{error:{message}}:{data:{id:'new-lot'},error:null};}};
 return{calls,prompts};
}
test('confirmar repete somente a gravação avisada, com os mesmos dados e request id',async()=>{
 const f=setup(true),payload={lot:{code:'novo'},animals:[{ear_tag:'100'}]};
 const saved=await mutateApp('create_lot',payload,'confirm-1');assert.equal(saved.id,'new-lot');assert.equal(f.calls.length,2);assert.equal(f.prompts.length,1);
 assert.ok(f.prompts[0].includes('100 — Lote 1'));assert.ok(f.prompts[0].includes('100 — Lote 2'));
 assert.equal(f.calls[0].p_request_id,f.calls[1].p_request_id);assert.deepEqual(f.calls[1].p_payload,{...payload,confirmedDuplicateEarTags:['100']});
});
test('cancelar não tenta gravar uma segunda vez',async()=>{const f=setup(false);await assert.rejects(mutateApp('create_lot',{animals:[{ear_tag:'100'}]},'cancel-1'),/Cadastro cancelado/);assert.equal(f.calls.length,1);});
test('bloqueio dentro do lote não abre confirmação',async()=>{const f=setup(true,'Não é permitido repetir o mesmo brinco dentro do lote.');await assert.rejects(mutateApp('save_animal',{ear_tag:'100'},'same-1'),/mesmo brinco/);assert.equal(f.prompts.length,0);assert.equal(f.calls.length,1);});
test('resposta inválida não autoriza cadastro',async()=>{const f=setup(true,'BRINCOS_OUTROS_LOTES:invalid');await assert.rejects(mutateApp('create_lot',{animals:[]},'invalid-1'));assert.equal(f.prompts.length,0);assert.equal(f.calls.length,1);});
test('não modifica outras operações e não entra em repetição de confirmações',async()=>{
 const f=setup(true);await assert.rejects(mutateApp('save_diet',{name:'Dieta'},'diet-1'));assert.equal(f.prompts.length,0);
 const g=setup(true);await assert.rejects(mutateApp('save_animal',{ear_tag:'100',confirmedDuplicateEarTags:['100']},'already-1'));assert.equal(g.prompts.length,0);assert.equal(g.calls.length,1);
});
