import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=fs.readFileSync(new URL('../src/lib/public-plan-prices.ts',import.meta.url),'utf8');
const {parsePublicPlanPrices}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
test('preços de catálogo novos e economia usam os centavos recebidos',()=>{
 const old=parsePublicPlanPrices({monthlyCents:2490,annualCents:24990});assert.equal(old.monthly*12-old.annual,4890);
 const next=parsePublicPlanPrices({monthlyCents:3990,annualCents:39990,secret:'never copied'});assert.deepEqual(next,{monthly:3990,annual:39990});assert.equal(next.monthly*12-next.annual,7890);
});
test('respostas ausentes ou inválidas não viram preço zero nem valor de fallback',()=>{
 for(const value of [null,{},[],{monthlyCents:'2490',annualCents:24990},{monthlyCents:-1,annualCents:24990},{monthlyCents:2490.5,annualCents:24990},{monthlyCents:2490,annualCents:Infinity}])assert.throws(()=>parsePublicPlanPrices(value));
});
