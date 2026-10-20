import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText;
const mock = url(`
export const useState=initial=>{const h=globalThis.__individualWeighing,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>h.state[i]=typeof v==='function'?v(h.state[i]):v];};
export const useEffect=fn=>fn();
export const parseNumberInput=s=>s.trim()&&Number.isFinite(Number(s.replace(',','.')))?Number(s.replace(',','.')):null;
export const formatNumber=n=>String(n);
${['ArrowLeft','ArrowRight','Check','Pencil','NumericField','Button'].map(name => `export function ${name}(){}`).join('\n')}
`);
const source = compile(fs.readFileSync(new URL('../src/pages/weighings/new/individual-weighing.tsx', import.meta.url), 'utf8'))
  .replace(/from\s+(['"])(.*?)\1/g, (_, q, name) => `from "${name === 'react/jsx-runtime' ? import.meta.resolve(name) : mock}"`);
const { IndividualWeighing } = await import(url(source));
const nodes = tree => { const all=[]; const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){all.push(n);visit(n.props.children);}};visit(tree);return all; };
const state = () => ({state:[],cursor:0});
const draw = (component, props, h) => {globalThis.__individualWeighing=h;h.cursor=0;return component(props);};
const animals = [{id:'a',ear_tag:'16',current_weight_kg:350},{id:'b',ear_tag:'17',current_weight_kg:360}];

test('registra um animal, avança ao próximo e termina na revisão sem criar registros para os pulados', () => {
  const h=state(), weights={}, props={animals,weights,inputs:{},cursor:'',average:null,onCursorChange:value=>{props.cursor=value;},onInputChange:(id,value)=>{props.inputs[id]=value;},onRegister:(id,value)=>{weights[id]=value;},onPendingChange:()=>{}};
  let tree=draw(IndividualWeighing,props,h), card=nodes(tree).find(n=>n.type.name==='AnimalWeight');
  assert.equal(card.props.animal.ear_tag,'16');
  card.props.onRegister('365,5');
  tree=draw(IndividualWeighing,props,h);card=nodes(tree).find(n=>n.type.name==='AnimalWeight');
  assert.equal(card.props.animal.ear_tag,'17');
  nodes(tree).find(n=>n.type.name==='Button'&&n.props.children?.includes('Pular animal ')).props.onClick();
  tree=draw(IndividualWeighing,props,h);
  assert.equal(nodes(tree).some(n=>n.type.name==='AnimalWeight'),false);
  assert.deepEqual(weights,{a:'365,5'});
  assert.ok(nodes(tree).some(n=>n.props.children?.includes?.('Não pesado')));
  const edit=nodes(tree).find(n=>n.type==='button');edit.props.onClick();
  card=nodes(draw(IndividualWeighing,props,h)).find(n=>n.type.name==='AnimalWeight');
  assert.equal(card.props.savedWeight,'365,5');
});

test('peso vazio, zero ou negativo não avança; Enter confirma um peso positivo', () => {
  const wizard=state(), calls=[], pending=[];
  const props={animals,weights:{},inputs:{},cursor:'',average:null,onCursorChange:value=>{props.cursor=value;},onInputChange:(id,value)=>{props.inputs[id]=value;},onRegister:(id,value)=>calls.push([id,value]),onPendingChange:v=>pending.push(v)};
  const card=nodes(draw(IndividualWeighing,props,wizard)).find(n=>n.type.name==='AnimalWeight');
  const h=state(), cardProps={...card.props};
  cardProps.onInputChange=value=>{cardProps.value=value;};
  for(const invalid of ['', '0', '-2', 'abc']){
    let field=nodes(draw(card.type,cardProps,h)).find(n=>n.type.name==='NumericField');field.props.onValueChange(invalid);
    field=nodes(draw(card.type,cardProps,h)).find(n=>n.type.name==='NumericField');field.props.onEnter();
  }
  assert.equal(calls.length,0);
  let field=nodes(draw(card.type,cardProps,h)).find(n=>n.type.name==='NumericField');field.props.onValueChange('380,5');
  field=nodes(draw(card.type,cardProps,h)).find(n=>n.type.name==='NumericField');field.props.onEnter();
  assert.deepEqual(calls,[['a','380,5']]);assert.equal(pending.at(-1),false);
});


test('recupera animal e peso digitado e muda a ação do último animal para revisar', () => {
  const props={animals,weights:{a:'365'},inputs:{b:'382,2'},cursor:'b',average:365,
    onCursorChange:()=>{},onInputChange:()=>{},onRegister:()=>{},onPendingChange:()=>{}};
  const card=nodes(draw(IndividualWeighing,props,state())).find(n=>n.type.name==='AnimalWeight');
  assert.equal(card.props.animal.id,'b');assert.equal(card.props.value,'382,2');
  assert.equal(card.props.willReview,true);
  const tree=draw(card.type,card.props,state());
  assert.ok(nodes(tree).some(n=>n.props.children?.includes?.('Registrar e revisar')));
});
