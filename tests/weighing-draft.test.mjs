import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync(new URL('../src/lib/weighing-draft.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.ESNext,target: ts.ScriptTarget.ES2022},
}).outputText;
const {readWeighingDraft,writeWeighingDraft,weighingDraftKey} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const draft = {lotId:'lot',kind:'individual',date:'2026-10-19',headCount:'',avgWeight:'',
  weights:{a:'365,5'},inputs:{a:'365,5',b:'38'},cursor:'b',requestId:'12345678-1234-1234-1234-123456789abc'};
test('recupera pesos confirmados e campo incompleto sem misturar usuários ou fazendas', () => {
  const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
  const key=weighingDraftKey('user1','farm1');
  assert.equal(writeWeighingDraft(storage,key,draft),true);
  assert.deepEqual(readWeighingDraft(storage,key),draft);
  assert.equal(readWeighingDraft(storage,weighingDraftKey('user2','farm1')),null);
  assert.equal(readWeighingDraft(storage,weighingDraftKey('user1','farm2')),null);
});
test('rascunho inválido ou armazenamento bloqueado não interrompe o formulário', () => {
  for(const raw of ['null','{broken',JSON.stringify({...draft,weights:[]}),JSON.stringify({...draft,inputs:{b:38}})]){
    assert.equal(readWeighingDraft({getItem:()=>raw},'key'),null);
  }
  const unavailable=()=>{throw new Error('blocked');};
  assert.equal(readWeighingDraft({getItem:unavailable},'key'),null);
  assert.equal(writeWeighingDraft({setItem:unavailable},'key',draft),false);
});
