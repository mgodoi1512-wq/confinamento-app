import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const mock=url(`
export const lazy=()=>function DeferredChart(){};export function Suspense(){}export function EmptyState(){}export function LineChart(){}
export const useRef=()=>({current:{id:'chart'}});
export const useState=initial=>{const h=globalThis.__deferredChart,i=h.cursor++;if(!(i in h.state))h.state[i]=initial;return[h.state[i],v=>h.state[i]=v];};
export const useEffect=fn=>globalThis.__deferredChart.effect=fn;
`);
let code=ts.transpileModule(fs.readFileSync(new URL('../src/components/app/weight-chart.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
code=code.replace(/from\s+(['"])(.*?)\1/g,(_,q,n)=>`from "${n==='react/jsx-runtime'?import.meta.resolve(n):mock}"`);
const {WeightChart}=await import(url(code));
const nodes=root=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(root);return out;};
const fixture=()=>{const h={state:[],cursor:0,effect:null};globalThis.__deferredChart=h;return{h,draw:props=>{h.cursor=0;return WeightChart(props);}};};
test('gráfico espera aproximação à tela e conserva os pontos e alvo',()=>{
 const {h,draw}=fixture();let callback,options,observed=false;
 globalThis.IntersectionObserver=class{constructor(fn,o){callback=fn;options=o;}observe(){observed=true;}disconnect(){}};
 const props={points:[{date:'2026-10-24',weight:400}],target:550,height:240};
 assert.ok(!nodes(draw(props)).some(n=>n.type.name==='DeferredChart'));h.effect();assert.equal(observed,true);assert.equal(options.rootMargin,'200px');
 callback([{isIntersecting:false}]);assert.ok(!nodes(draw(props)).some(n=>n.type.name==='DeferredChart'));
 callback([{isIntersecting:true}]);const chart=nodes(draw(props)).find(n=>n.type.name==='DeferredChart');assert.deepEqual(chart.props,props);
 delete globalThis.IntersectionObserver;
});
test('sem medições mostra estado vazio; sem observer navegador carrega normalmente',()=>{
 const {h,draw}=fixture();delete globalThis.IntersectionObserver;
 assert.ok(nodes(draw({points:[]})).some(n=>n.type.name==='EmptyState'));h.effect();
 assert.ok(!nodes(draw({points:[]})).some(n=>n.type.name==='DeferredChart'));
 assert.ok(nodes(draw({points:[{date:'2026-10-24',weight:400}]})).some(n=>n.type.name==='DeferredChart'));
});
