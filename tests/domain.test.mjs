import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Compila os módulos reais, sem manter uma cópia das fórmulas nos testes.
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const formatSource = fs.readFileSync(new URL('../src/lib/format.ts', import.meta.url), 'utf8');
const formatUrl = moduleUrl(formatSource);
const constantsUrl = moduleUrl(fs.readFileSync(new URL('../src/lib/constants.ts', import.meta.url), 'utf8'));
const domainSource = fs.readFileSync(new URL('../src/lib/domain.ts', import.meta.url), 'utf8')
  .replace('from "./constants"', `from "${constantsUrl}"`).replace('from "./format"', `from "${formatUrl}"`);
const format = await import(formatUrl);
const domain = await import(moduleUrl(domainSource));

test('data civil de São Paulo não muda ao entrar no dia seguinte em UTC', () => {
  assert.equal(format.todayIso(new Date('2026-10-13T00:30:00Z')), '2026-10-12');
  assert.equal(format.todayIso(new Date('2026-10-13T03:00:00Z')), '2026-10-13');
});
test('datas e carência mantêm dias civis e validam datas impossíveis', () => {
  assert.equal(format.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(format.daysBetween('2026-10-01', '2026-10-11'), 10);
  assert.equal(format.isValidIsoDate('2026-02-30'), false);
  assert.throws(() => format.addDays('2026-10-01', -1));
  assert.equal(domain.isUnderWithdrawal({withdrawal_until:'2026-10-13'}, '2026-10-12'), true);
  assert.equal(domain.isUnderWithdrawal({withdrawal_until:'2026-10-12'}, '2026-10-12'), false);
});
test('números pt-BR e decimais com ponto, entradas inválidas são rejeitadas', () => {
  for (const [raw, expected] of [['1.234,5',1234.5],['512,4',512.4],['512.4',512.4],['12 kg',12],['-3%',-3],['',null],['1,2,3',null],['1e3',null],['Infinity',null]]) {
    assert.equal(format.parseNumberInput(raw), expected, raw);
  }
});
const lot={id:'l1',entry_date:'2026-10-01',entry_avg_weight_kg:400,head_count:100,initial_head_count:100,status:'ativo',target_weight_kg:520};
const weighing={id:'w1',lot_id:'l1',date:'2026-10-11',avg_weight_kg:430,created_at:'2026-10-11T12:00:00Z'};
test('GMD permanece ligado à data da pesagem, mesmo dez dias depois', () => {
  assert.equal(domain.computeLotMetrics(lot,[weighing],'2026-10-11').gmd,3);
  assert.equal(domain.computeLotMetrics(lot,[weighing],'2026-10-21').gmd,3);
  assert.equal(domain.computeLotMetrics(lot,[],'2026-10-21').gmd,null);
  assert.equal(domain.computeLotMetrics(lot,[weighing],'2026-10-10').gmd,null);
});
test('mortalidade contabiliza cabeças e prontidão respeita carência', () => {
  const animals=[{id:'a1',lot_id:'l1',status:'ativo',current_weight_kg:550,withdrawal_until:'2026-10-30'},
    {id:'a2',lot_id:'l1',status:'ativo',current_weight_kg:550,withdrawal_until:null}];
  const summary=domain.computeHerdSummary([lot],animals,[weighing],[],[{kind:'obito',head_count:5,lot_id:'l1'}],'2026-10-21');
  assert.equal(summary.deaths,5);assert.equal(summary.mortalityRate,5);assert.equal(summary.readyForSlaughter,1);
});
test('GMD negativo não desaparece do indicador agregado', () => {
  const summary=domain.computeHerdSummary([lot],[],[{...weighing,avg_weight_kg:390}],[],[],'2026-10-21');
  assert.equal(summary.avgGmd,-1);
});


test('ingredientes percentuais calculam individualmente sobre o peso vivo', () => {
  assert.equal(domain.dietItemKg({kg_per_head_day:0,body_weight_pct:1.6},450),7.2);
  assert.equal(domain.dietItemKg({kg_per_head_day:0,body_weight_pct:0.1},450),0.45);
  assert.equal(domain.dietItemKg({kg_per_head_day:0,body_weight_pct:1.6},500),8);
  assert.equal(domain.dietItemKg({kg_per_head_day:2,body_weight_pct:null},450),2);
});
test('dieta soma kg fixos e percentuais; sem peso não inventa quantidade', () => {
  const items=[{kg_per_head_day:0,body_weight_pct:1},{kg_per_head_day:0,body_weight_pct:0.1},{kg_per_head_day:2}];
  assert.equal(domain.dietTotalKg(items,400),6.4);
  assert.equal(domain.dietTotalKg(items),null);
  assert.equal(domain.dietTotalKg([{kg_per_head_day:2}]),2);
  assert.equal(domain.dietItemKg({kg_per_head_day:0,body_weight_pct:0},null),0);
  assert.equal(domain.dietItemKg({kg_per_head_day:0,body_weight_pct:101},400),null);
  assert.equal(domain.dietItemKg({kg_per_head_day:0,body_weight_pct:-1},400),null);
});

test('nomes de dietas normalizam caixa e espaços sem remover palavras ou acentos', () => {
  assert.equal(domain.normalizeDietName('  DIETA   Inicial  '),'dieta inicial');
  assert.equal(domain.normalizeDietName('Dieta\tInicial'),'dieta inicial');
  assert.equal(domain.normalizeDietName('Ração 01'),'ração 01');
});

const config = await import(moduleUrl(fs.readFileSync(new URL('../src/lib/supabase-config.ts', import.meta.url), 'utf8')));
test('Supabase usa o projeto configurado no ambiente e não um endereço fixo', () => {
  assert.deepEqual(config.readSupabaseConfig({VITE_SUPABASE_URL:' https://exemplo.supabase.co/ ',VITE_SUPABASE_ANON_KEY:' publica '}),{url:'https://exemplo.supabase.co',key:'publica'});
  assert.equal(config.readSupabaseConfig({VITE_SUPABASE_URL:'http://localhost:54321',VITE_SUPABASE_PUBLISHABLE_KEY:'nova'}).url,'http://localhost:54321');
  assert.equal(config.readSupabaseConfig({VITE_SUPABASE_URL:'https://outro.supabase.co',VITE_SUPABASE_ANON_KEY:'antiga',VITE_SUPABASE_PUBLISHABLE_KEY:'nova'}).key,'nova');
  for(const env of [{},{VITE_SUPABASE_URL:'errada',VITE_SUPABASE_ANON_KEY:'x'},{VITE_SUPABASE_URL:'https://exemplo.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_secret_nao-usar'},{VITE_SUPABASE_URL:'https://exemplo.supabase.co/rest',VITE_SUPABASE_ANON_KEY:'x'}]) assert.throws(()=>config.readSupabaseConfig(env));
});
test('resumo do trato distingue oferta média por lançamento do total diário', () => {
  const result=domain.summarizeFeedLogs([{kg_per_head:3,total_kg:30},{kg_per_head:3,total_kg:30}]);
  assert.equal(result.totalKg,60);assert.equal(result.averageKgPerHeadPerLog,3);
  assert.deepEqual(domain.summarizeFeedLogs([]),{totalKg:0,averageKgPerHeadPerLog:null});
  const mixed=domain.summarizeFeedLogs([{kg_per_head:4,total_kg:40},{kg_per_head:5,total_kg:25}]);
  assert.equal(mixed.totalKg,65);assert.equal(mixed.averageKgPerHeadPerLog,4.5);
});


const feedFixture=()=>({
 lots:[{...lot,id:'l1',pen_id:'p',head_count:10,diet_id:'d'}],
 diets:[{id:'d',name:'Adaptação',is_active:true}],
 items:[{diet_id:'d',ingredient:'RAÇÃO',kg_per_head_day:0,body_weight_pct:0.3},{diet_id:'d',ingredient:'VOLUMOSO',kg_per_head_day:0,body_weight_pct:3}],
 logs:[],weights:[],
});
const penFeed=f=>domain.computePenDailyFeeding('p',f.lots,f.logs,f.diets,f.items,f.weights,'2026-10-15');
const feedLog=(shift,total=44,extra={})=>({pen_id:'p',lot_id:'l1',date:'2026-10-15',shift,total_kg:total,diet_id:'d',...extra});
test('barra diária converte ingredientes e soma três tratos sem multiplicar recomendação por turno',()=>{
 const f=feedFixture();let r=penFeed(f);assert.equal(r.recommendedKg,132);assert.equal(r.percent,0);assert.ok(r.shifts.every(s=>!s.complete));
 f.logs=[feedLog('manha')];r=penFeed(f);assert.ok(Math.abs(r.percent-100/3)<1e-9);assert.deepEqual(r.shifts.map(s=>s.complete),[true,false,false]);
 f.logs.push(feedLog('tarde'),feedLog('noite'));r=penFeed(f);assert.equal(r.percent,100);assert.equal(r.suppliedKg,132);assert.ok(r.shifts.every(s=>s.complete));
 f.logs.push(feedLog('noite',44));assert.ok(penFeed(f).percent>100);
});
test('tratos antigos e de outro curral não sinalizam fornecimento; parcial exige todos os lotes',()=>{
 const f=feedFixture();f.lots.push({...f.lots[0],id:'l2',head_count:5});
 f.logs=[feedLog('manha'),feedLog('tarde',44,{date:'2026-10-14'}),feedLog('noite',44,{pen_id:'outro'})];
 let r=penFeed(f);assert.equal(r.recommendedKg,198);assert.equal(r.suppliedKg,44);assert.equal(r.shifts[0].served,1);assert.equal(r.shifts[0].complete,false);assert.equal(r.shifts[1].served,0);
 f.logs.push(feedLog('manha',22,{lot_id:'l2'}));assert.equal(penFeed(f).shifts[0].complete,true);
});
test('barra usa dieta selecionada no trato e peso da última pesagem válida',()=>{
 const f=feedFixture();f.diets.push({id:'d2'});f.items.push({diet_id:'d2',kg_per_head_day:0,body_weight_pct:2});f.logs=[feedLog('manha',30,{diet_id:'d2'})];
 f.weights=[{...weighing,avg_weight_kg:450}];assert.equal(penFeed(f).recommendedKg,90);
});
test('sem dieta, ingredientes ou peso não apresenta porcentagem falsa',()=>{
 const f=feedFixture();f.lots[0].diet_id=null;assert.equal(penFeed(f).percent,null);
 f.lots[0].diet_id='d';f.lots[0].entry_avg_weight_kg=0;assert.equal(penFeed(f).percent,null);
 f.lots=[];assert.equal(penFeed(f).percent,null);assert.equal(penFeed(f).shifts[0].total,0);
});
test('dietas divergentes no mesmo dia não geram comparação enganosa',()=>{
 const f=feedFixture();f.logs=[feedLog('manha'),feedLog('tarde',44,{diet_id:'outra'})];
 assert.equal(penFeed(f).percent,null);assert.equal(penFeed(f).suppliedKg,88);
});


test('barra usa total congelado do plano e respeita turnos não previstos',()=>{
 const f=feedFixture();f.lots[0].entry_avg_weight_kg=999;
 f.logs=[feedLog('manha',132)];
 const r=domain.computePenDailyFeeding('p',f.lots,f.logs,f.diets,f.items,f.weights,'2026-10-15',[{lot_id:'l1',pen_id:'p',date:'2026-10-15',daily_total_kg:132,schedule:[{shift:'manha',percent:100},{shift:'tarde',percent:0},{shift:'noite',percent:0}]}]);
 assert.equal(r.percent,100);assert.equal(r.shifts[0].complete,true);assert.equal(r.shifts[1].total,0);
});

const planning=await import(moduleUrl(fs.readFileSync(new URL('../src/lib/feed-planning.ts',import.meta.url),'utf8')));
test('planejamento de um a três tratos soma 100% e valida períodos',()=>{
 for(const count of [1,2,3]){const slots=planning.splitFeedSchedule(count);assert.equal(slots.filter(s=>s.percent>0).length,count);assert.equal(planning.validateFeedSchedule(slots),null);}
 assert.ok(planning.validateFeedSchedule(planning.defaultFeedSchedule().map(s=>({...s,percent:20}))));
 assert.ok(planning.validateFeedSchedule(planning.defaultFeedSchedule().map(s=>({...s,shift:'invalido'}))));
 assert.equal(planning.validateFeedSchedule(planning.defaultFeedSchedule().map(s=>({...s,time:'08:00'}))),null);
});
test('parcela é do dia e ingredientes mantêm proporção ao ajustar oferta',()=>{
 assert.equal(planning.portionPerHead(13.2,33.33),4.4);
 const items=planning.feedIngredientPortions([{name:'Ração',bodyWeightPct:0.3,dailyKgPerHead:1.2},{name:'Volumoso',bodyWeightPct:3,dailyKgPerHead:12}],6.6);
 assert.ok(Math.abs(items[0].kgPerHead-.6)<1e-9);assert.ok(Math.abs(items[1].kgPerHead-6)<1e-9);
});

test('escolha de períodos cobre qualquer combinação sem excluir a noite por posição',()=>{
 for(const selected of [['manha'],['tarde'],['noite'],['manha','tarde'],['manha','noite'],['tarde','noite'],['manha','tarde','noite']]){
  const slots=planning.selectFeedPeriods(selected);assert.equal(planning.validateFeedSchedule(slots),null);assert.deepEqual(slots.filter(s=>s.percent>0).map(s=>s.shift),['manha','tarde','noite'].filter(s=>selected.includes(s)));
 }
 assert.deepEqual(planning.selectFeedPeriods(['noite']).map(s=>s.percent),[0,0,100]);
 assert.deepEqual(planning.selectFeedPeriods(['manha','noite']).map(s=>s.percent),[50,0,50]);
});

test('quantidade flexível encerra o dia sem exigir um período específico',()=>{
 const f=feedFixture();f.logs=[feedLog('noite',132)];
 const plans=[{lot_id:'l1',pen_id:'p',date:'2026-10-15',daily_total_kg:132,meal_count:1,schedule:[{shift:'manha',percent:100},{shift:'tarde',percent:0},{shift:'noite',percent:0}]}];
 const r=domain.computePenDailyFeeding('p',f.lots,f.logs,f.diets,f.items,f.weights,'2026-10-15',plans);
 assert.equal(r.percent,100);assert.equal(r.shifts[0].total,0);assert.equal(r.shifts[1].total,0);assert.equal(r.shifts[2].complete,true);
});
