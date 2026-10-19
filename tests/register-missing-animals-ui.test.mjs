import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const logic=url(compile(read('../src/lib/animal-registration.ts')));
const mock=url(`
export const useState=initial=>{const h=globalThis.__missingLot,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>{h.state[i]=typeof v==='function'?v(h.state[i]):v;}];};
export class DuplicateEarTagsError extends Error{constructor(matches){super('duplicado');this.matches=matches;}}
export const useNextEarTag=()=>({data:{next:'101'},isLoading:false,refetch:async()=>{}});
export const useRegisterMissingLotAnimals=()=>({isPending:false,mutateAsync:async p=>{const h=globalThis.__missingLot;h.calls.push(p);if(h.conflict&&!p.confirmedDuplicateEarTags.length)throw new DuplicateEarTagsError([{earTag:'101',lotCode:'Lote antigo'}]);if(h.fail)throw new Error('Falha de rede');return{created:p.tags.length};}});
export const toast={success:()=>{},error:e=>globalThis.__missingLot.errors.push(e)};
${['AnimalTagsEditor','Button','Dialog','DialogContent','DialogDescription','DialogHeader','DialogTitle'].map(n=>`export function ${n}(){}`).join('\n')}
`);
const code=compile(read('../src/components/lots/register-missing-animals-dialog.tsx')).replace(/from\s+(['"])(.*?)\1/g,(_,q,name)=>`from "${name==='react/jsx-runtime'?import.meta.resolve(name):name==='@/lib/animal-registration'?logic:mock}"`);
const {RegisterMissingAnimalsDialog:C}=await import(url(code));
const fixture=()=>({state:[],cursor:0,calls:[],errors:[],closed:false});const draw=h=>{globalThis.__missingLot=h;h.cursor=0;return C({lotId:'lot',lotCode:'Lote 1',count:3,onClose:()=>h.closed=true});};
const nodes=root=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(root);return out;};
const button=(h,text)=>nodes(draw(h)).find(n=>n.type.name==='Button'&&n.props.children===text),flush=()=>new Promise(r=>setImmediate(r));
test('faltantes envia quantidade original, preserva requisição na falha e fecha só no sucesso',async()=>{const h=fixture();h.fail=true;button(h,'Cadastrar 3 animais').props.onClick();await flush();assert.equal(h.closed,false);assert.deepEqual(h.calls[0].tags,['101','102','103']);assert.equal(h.calls[0].expected_missing,3);h.fail=false;button(h,'Cadastrar 3 animais').props.onClick();await flush();assert.equal(h.closed,true);assert.equal(h.calls[0].requestId,h.calls[1].requestId);});
test('conflito mantém modal aberto até confirmação explícita',async()=>{const h=fixture();h.conflict=true;button(h,'Cadastrar 3 animais').props.onClick();await flush();assert.equal(h.closed,false);assert.equal(h.calls.length,1);button(h,'Cadastrar mesmo assim').props.onClick();await flush();assert.equal(h.closed,true);assert.deepEqual(h.calls[1].confirmedDuplicateEarTags,['101']);assert.equal(h.calls[0].requestId,h.calls[1].requestId);});
test('lista incompleta não permite gravar',async()=>{const h=fixture();nodes(draw(h)).find(n=>n.type.name==='AnimalTagsEditor').props.onChange({kind:'list',start:null,list:'ABC-1'});const b=button(h,'Cadastrar 3 animais');assert.equal(b.props.disabled,true);b.props.onClick();await flush();assert.equal(h.calls.length,0);assert.equal(h.closed,false);});
