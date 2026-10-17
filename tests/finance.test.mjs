import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/finance.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {computeFinance,computeIngredient,computeSilage,validateFinance}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
const ingredient=(changes={})=>({name:'Ingrediente',bagKg:50,bagPrice:100,sharePct:80,freight:0,freightUnit:'bag',loadKg:null,...changes});
const input=()=>({energy:ingredient({name:'Milho',freight:10}),protein:ingredient({name:'Proteína',bagKg:30,bagPrice:90,sharePct:15,freight:30,freightUnit:'ton'}),nucleus:ingredient({name:'Núcleo',bagKg:25,bagPrice:200,sharePct:5,freight:1000,freightUnit:'load',loadKg:10000}),silage:{price:180,priceUnit:'ton',freight:40,freightUnit:'ton',loadKg:null}});
test('ração inclui 80% de energia, 15% de proteína e 5% de núcleo com os fretes',()=>{
 const result=computeFinance(input());
 near(result.ingredients.energy.pricePerKg,2.2);near(result.ingredients.protein.pricePerKg,3.03);near(result.ingredients.nucleus.pricePerKg,8.1);
 near(result.rationPerKg,2.6195);near(result.costPer100Kg,261.95);near(result.rationPerTon,2619.5);near(result.silage.pricePerKg,.22);
});
test('fretes equivalentes por saca, tonelada ou carga resultam no mesmo preço por kg',()=>{
 for(const freight of [{freight:5,freightUnit:'bag'},{freight:100,freightUnit:'ton'},{freight:1000,freightUnit:'load',loadKg:10000}])near(computeIngredient(ingredient(freight)).pricePerKg,2.1);
});
test('silagem aceita compra por kg ou tonelada e frete por kg, tonelada ou carga',()=>{
 for(const price of [{price:.2,priceUnit:'kg'},{price:200,priceUnit:'ton'}])for(const freight of [{freight:.03,freightUnit:'kg'},{freight:30,freightUnit:'ton'},{freight:300,freightUnit:'load',loadKg:10000}])near(computeSilage({loadKg:null,...price,...freight}).pricePerKg,.23);
});
test('silagem é opcional e valores zero explícitos são preservados',()=>{
 const data=input();data.silage=null;assert.equal(computeFinance(data).silage,null);
 for(const key of ['energy','protein','nucleus']){data[key].bagPrice=0;data[key].freight=0;}
 assert.equal(computeFinance(data).rationPerKg,0);
});
test('validação rejeita mistura fora de 100%, frete sem peso, preços vazios e não finitos',()=>{
 for(const change of [{bagPrice:null},{bagPrice:''},{bagKg:0},{bagPrice:-1},{bagPrice:NaN},{freight:-1},{sharePct:101},{freight:1,freightUnit:'load',loadKg:null},{freight:1,freightUnit:'load',loadKg:0},{freightUnit:'kg'}])assert.throws(()=>computeIngredient(ingredient(change)));
 const data=input();data.nucleus.sharePct=4;assert.throws(()=>validateFinance(data),/100%/);
});
