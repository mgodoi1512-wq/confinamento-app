import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const mock=url(`
export const useState=initial=>{const h=globalThis.__legalCombined,i=h.cursor++;if(!(i in h.state))h.state[i]=initial;return[h.state[i],v=>h.state[i]=v];};
export const useRef=()=>({current:null});export const useEffect=()=>{};export const useCallback=fn=>fn;
export const LEGAL_VERSION='test';
export function LegalDocumentContent(){}export function Button(){}
export function ArrowDown(){}export function CheckCircle2(){}export function ShieldCheck(){}export function X(){}
export function Root(){}export function Portal(){}export function Overlay(){}export function Content(){}export function Title(){}export function Description(){}export function Close(){}
`);
const source=fs.readFileSync(new URL('../src/components/legal/legal-document-dialog.tsx',import.meta.url),'utf8');
let compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
compiled=compiled.replace(/from\s+(['"])(.*?)\1/g,(_,q,n)=>`from "${n==='react/jsx-runtime'?import.meta.resolve(n):mock}"`);
const {LegalDocumentDialog}=await import(url(compiled));
const nodes=root=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(root);return out;};
const setup=()=>{const h={state:[],cursor:0,accepted:0,closed:0};globalThis.__legalCombined=h;const draw=()=>{h.cursor=0;return LegalDocumentDialog({onClose:()=>h.closed++,onComplete:()=>h.accepted++});};return{h,draw};};
const accept=tree=>nodes(tree).find(n=>n.props.children==='Li e aceito');
test('mesma janela contém termos e privacidade e exige chegar ao final',()=>{
 const {h,draw}=setup();let tree=draw();assert.deepEqual(nodes(tree).filter(n=>n.type.name==='LegalDocumentContent').map(n=>n.props.kind),['terms','privacy']);
 assert.equal(accept(tree).props.disabled,true);accept(tree).props.onClick();assert.equal(h.accepted,0);
 const scroll=nodes(tree).find(n=>n.props.role==='region').props.onScroll;
 scroll({currentTarget:{clientHeight:400,scrollHeight:2000,scrollTop:500}});assert.equal(accept(draw()).props.disabled,true);
 scroll({currentTarget:{clientHeight:400,scrollHeight:2000,scrollTop:1600}});tree=draw();assert.equal(accept(tree).props.disabled,false);assert.equal(h.accepted,0);
 accept(tree).props.onClick();assert.equal(h.accepted,1);
});
test('fechar ou voltar não confirma o aceite',()=>{const{h,draw}=setup();const tree=draw();nodes(tree).find(n=>n.props.children==='Voltar').props.onClick();assert.equal(h.closed,1);nodes(tree).find(n=>n.type.name==='Root').props.onOpenChange(false);assert.equal(h.closed,2);assert.equal(h.accepted,0);});
