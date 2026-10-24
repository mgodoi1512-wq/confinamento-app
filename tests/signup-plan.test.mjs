import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=fs.readFileSync(new URL('../src/lib/signup-plan.ts',import.meta.url),'utf8');
const {signupPlan,signupPlanFromSearch,initialSignupPlan}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
test('preferência aceita somente planos conhecidos, sem preço ou URL arbitrária',()=>{
 for(const bad of [null,undefined,'ANNUAL','free','https://evil.invalid','monthly&value=1',2490])assert.equal(signupPlan(bad),null);
 assert.equal(signupPlanFromSearch('?modo=cadastro&plano=annual&value=1'),'annual');
 assert.equal(initialSignupPlan('invalid','annual'),'annual');assert.equal(initialSignupPlan('monthly','annual'),'monthly');assert.equal(initialSignupPlan(null,null),'monthly');
});
