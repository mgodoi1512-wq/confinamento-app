import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const mock=url(`
export const useState=initial=>{const h=globalThis.__projection,i=h.cursor++;if(!(i in h.state))h.state[i]=initial;return[h.state[i],v=>h.state[i]=v];};
export const useTranslation=()=>({t:key=>key});export const cn=(...args)=>args.filter(Boolean).join(' ');
export const WEIGHT_SCENARIOS=[{value:'conservative',factor:.9,labelKey:'Conservador'},{value:'realistic',factor:1,labelKey:'Realista'},{value:'optimistic',factor:1.1,labelKey:'Otimista'}];
export const computeProjection=()=>({days:10,date:'2026-11-01',arroba:18,ready:false});
export const formatDate=v=>v,formatNumber=v=>String(v),todayIso=()=> '2026-10-20';
export const parseNumberInput=s=>s.trim()&&Number.isFinite(Number(s.replace(',','.')))?Number(s.replace(',','.')):null;
${['BovineSlaughterIcon','CalendarClock','Beef','LightbulbCogIcon','TrendingUp','NumericField','StatCard','Button'].map(n=>`export function ${n}(){}`).join('\n')}
`);
const source=ts.transpileModule(fs.readFileSync(new URL('../src/pages/lots/detail/projection-card.tsx',import.meta.url),'utf8'),{
  compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText.replace(/from\s+(['"])(.*?)\1/g,(_,q,name)=>`from "${name==='react/jsx-runtime'?import.meta.resolve(name):mock}"`);
const {ProjectionCard}=await import(url(source));
const nodes=tree=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(tree);return out;};
const draw=(props,h)=>{globalThis.__projection=h;h.cursor=0;return nodes(ProjectionCard(props));};
const props={targetWeight:520,metrics:{gmd:2,currentAvgWeight:400},scenario:'realistic',onScenarioChange:()=>{},onTargetChange:()=>{}};
test('GMD exibido acompanha o fator usado por cenário',()=>{
  for(const [scenario,expected] of [['conservative','1.8'],['realistic','2'],['optimistic','2.2']]){
    const card=draw({...props,scenario},{state:[],cursor:0}).find(n=>n.props.labelKey==='GMD usado na projeção');
    assert.equal(card.props.value,expected);
  }
});
test('não salva peso alvo vazio ou negativo; aceita novo peso positivo',()=>{
  const calls=[],p={...props,onTargetChange:value=>calls.push(value)},h={state:[],cursor:0};
  for(const value of ['', '-1', 'abc']){
    draw(p,h).find(n=>n.type.name==='NumericField').props.onValueChange(value);
    const save=draw(p,h).find(n=>n.type.name==='Button');assert.equal(save.props.disabled,true);save.props.onClick();
  }
  assert.deepEqual(calls,[]);
  draw(p,h).find(n=>n.type.name==='NumericField').props.onValueChange('540,5');
  const save=draw(p,h).find(n=>n.type.name==='Button');assert.equal(save.props.disabled,false);save.props.onClick();
  assert.deepEqual(calls,[540.5]);
});
