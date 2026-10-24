import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/contact-phone.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {normalizeContactPhone,formatContactPhone}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('aceita contato com DDD, símbolos e código do Brasil e normaliza sem perder dígitos',()=>{
  for(const input of ['62999991234','(62) 99999-1234','+55 (62) 99999-1234','5562999991234'])assert.equal(normalizeContactPhone(input),'+5562999991234');
  assert.equal(normalizeContactPhone('(11) 3456-7890'),'+551134567890');
});
test('recusa telefone vazio, sem DDD, país diferente, letras e tamanho inválido',()=>{
  for(const input of ['', '999991234','(00) 99999-1234','+1 202 555 0100','629999912345','62999991234abc'])assert.equal(normalizeContactPhone(input),null,input);
});
test('apresenta celular, fixo e legado sem contato',()=>{
  assert.equal(formatContactPhone('+5562999991234'),'(62) 99999-1234');assert.equal(formatContactPhone('+551134567890'),'(11) 3456-7890');assert.equal(formatContactPhone(null),'Não informado');
});

test('máscara acompanha digitação, colagem e limpeza sem alterar a normalização',async()=>{
  const {formatContactPhoneInput:mask}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  for(const [raw,expected] of [['',''],['6','(6'],['62','(62'],['629','(62) 9'],['629999','(62) 9999'],['62999991234','(62) 99999-1234'],['1134567890','(11) 3456-7890'],['+55 (62) 99999-1234','(62) 99999-1234'],['55999991234','(55) 99999-1234']])assert.equal(mask(raw),expected,raw);
  assert.equal(normalizeContactPhone(mask('62999991234')),'+5562999991234');
  let value=mask('62999991234');while(value)value=mask(value.slice(0,-1));assert.equal(value,'');
});
