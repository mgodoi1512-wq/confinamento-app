import {build} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
const result=await build({entryPoints:['src/pages/home/index.tsx'],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','react-router-dom','lucide-react','@radix-ui/react-dialog'],loader:{'.css':'empty'},plugins:[{name:'public-prices',setup(b){
 b.onResolve({filter:/^@\/hooks\/use-public-plan-prices$/},()=>({path:'prices',namespace:'fixture'}));
 b.onResolve({filter:/^@\/components\/app\/theme-toggle$/},()=>({path:'theme',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='prices'?'export const usePublicPlanPrices=()=>globalThis.__publicPrices;':'export const ThemeToggle=()=>null;'}));
 b.onResolve({filter:/^@\//},a=>({path:fileURLToPath(new URL('../src/'+a.path.slice(2)+(a.path.includes('navigation-icons')?'.tsx':'.ts'),import.meta.url))}));
}}]});
const dir=await fs.mkdtemp(new URL('./.tmp-home-prices-',import.meta.url));let Home;
try{const path=join(dir,'bundle.mjs');await fs.writeFile(path,result.outputFiles[0].contents);Home=(await import(pathToFileURL(path).href)).default;}finally{await fs.rm(dir,{recursive:true,force:true});}
const render=state=>{globalThis.__publicPrices=state;return renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(Home)));};
test('home exibe preços consultados e economia calculada; oculta desconto sem economia',()=>{
 let html=render({data:{monthly:3990,annual:39990}});assert.match(html,/39,90/);assert.match(html,/399,90/);assert.match(html,/78,90/);assert.doesNotMatch(html,/24,90/);
 html=render({data:{monthly:1000,annual:13000}});assert.doesNotMatch(html,/Economize|Melhor valor/);
});
test('home não anuncia valores antigos durante erro nem preços fixos ao carregar',()=>{
 const error=render({data:{monthly:2490,annual:24990},isError:true,isPending:false});assert.match(error,/Consulte o plano/);assert.match(error,/Tentar novamente/);assert.doesNotMatch(error,/24,90|249,90/);
 const loading=render({isPending:true});assert.match(loading,/Consultando/);assert.doesNotMatch(loading,/24,90|249,90/);
});

test('cartões encaminham cadastro com a escolha mensal ou anual',()=>{
 const html=render({data:{monthly:2490,annual:24990}});
 assert.match(html,/href="\/login\?modo=cadastro&amp;plano=monthly"/);assert.match(html,/Escolher mensal/);
 assert.match(html,/href="\/login\?modo=cadastro&amp;plano=annual"/);assert.match(html,/Escolher anual/);
});
