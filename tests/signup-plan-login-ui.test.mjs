import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const plans=url(compile(read('../src/lib/signup-plan.ts')));
const mock=url(`
export const useState=initial=>{const h=globalThis.__signupPlanLogin,i=h.cursor++;if(!(i in h.state))h.state[i]=typeof initial==='function'?initial():initial;return[h.state[i],v=>h.state[i]=typeof v==='function'?v(h.state[i]):v];};
export const useRef=()=>({current:null});export const useEffect=()=>{};export const useLayoutEffect=()=>{};
export const useNavigate=()=>()=>{};export const useLocation=()=>({search:globalThis.__signupPlanLogin.search});
export const useAuth=()=>({session:null,loading:false,passwordRecovery:false});export const useTranslation=()=>({t:key=>key});
export const useReducedMotion=()=>true;export const motion={div:()=>null};
export const LEGAL_VERSION='test-version';
export const formatContactPhoneInput=s=>s;export const normalizeContactPhone=s=>s?'+5562999999999':null;
export const supabase={auth:{signUp:async input=>{globalThis.__signupPlanLogin.calls.push(input);return{data:{session:null},error:null};}}};
export function Link(){}export function ThemeToggle(){}export function Button(){}export function Input(){}
export function Tabs(){}export function TabsList(){}export function TabsTrigger(){}export function LegalDocumentDialog(){}
${['ArrowRight','BarChart3','Beef','Eye','EyeOff','LockKeyhole','Mail','Phone','UserRound','ShieldCheck','UtensilsCrossed'].map(n=>'export function '+n+'(){}').join('')}
`);
const source=compile(read('../src/pages/login/index.tsx').replace(/^import "\.\/login.css";$/m,''));
const {default:Login}=await import(url(source.replace(/from\s+(['"])(.*?)\1/g,(_,q,n)=>`from "${n==='react/jsx-runtime'?import.meta.resolve(n):n==='@/lib/signup-plan'?plans:mock}"`)));
const nodes=root=>{const out=[];const visit=n=>{if(Array.isArray(n))return n.forEach(visit);if(n?.props){out.push(n);visit(n.props.children);}};visit(root);return out;};
test('cadastro grava preferência junto à conta e exige confirmação explícita sem gerar cobrança',async()=>{
 globalThis.window={location:{origin:'https://example.invalid'}};globalThis.requestAnimationFrame=()=>{};
 for(const plan of ['monthly','annual',null]){
 const h={cursor:0,state:[],calls:[],search:'?modo=cadastro'+(plan?'&plano='+plan:'')};globalThis.__signupPlanLogin=h;
 const draw=()=>{h.cursor=0;return Login();};
 const change=(id,value)=>nodes(draw()).find(n=>n.props.id===id).props.onChange(id==='phone'?{currentTarget:{value,selectionStart:value.length}}:{target:{value}});
 change('fullName','Pessoa Teste');change('phone','62999999999');change('email','test@example.invalid');change('password','test-only-password');
 await nodes(draw()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.calls.length,0);
 nodes(draw()).find(n=>n.props.className?.includes('login-screen-legal-document')).props.onClick({currentTarget:{}});
 nodes(draw()).find(n=>n.type.name==='LegalDocumentDialog').props.onComplete();
 await nodes(draw()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(h.calls.length,1);const metadata=h.calls[0].options.data;assert.equal(metadata.preferred_plan,plan??undefined);assert.equal(metadata.terms_accepted,true);assert.equal(metadata.privacy_notice_acknowledged,true);assert.equal(metadata.amount,undefined);
 assert.equal(h.calls[0].options.emailRedirectTo,'https://example.invalid/conta-confirmada');
 }
 delete globalThis.window;delete globalThis.requestAnimationFrame;
});
