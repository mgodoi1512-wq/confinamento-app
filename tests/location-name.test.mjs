import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/location-name.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText;
const {locationName}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('exibe tipo antes do código sem alterar o cadastro original',()=>{
  for(const [type,label] of [['curral','Curral'],['piquete','Piquete'],['pasto','Pasto']]){
    const pen=Object.freeze({location_type:type,code:'01'});
    assert.equal(locationName(pen),`${label} 01`);assert.equal(pen.code,'01');
  }
});
test('evita duplicar nomes antigos e mantém fallback quando o local não existe',()=>{
  assert.equal(locationName({code:'Curral 01'}),'Curral 01');
  assert.equal(locationName({code:'curral · 01'}),'Curral 01');
  assert.equal(locationName({location_type:'pasto',code:'Pasto Norte'}),'Pasto Norte');
  assert.equal(locationName({code:'Curral'}),'Curral');
  assert.equal(locationName(null),'—');assert.equal(locationName(undefined,'Todos'),'Todos');
});
