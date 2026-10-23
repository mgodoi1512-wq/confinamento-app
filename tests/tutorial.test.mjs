import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const tutorialUrl = url(compile(read('../src/lib/tutorial.ts')));
const { tutorialChapters, tutorialJourney, chapterForPath, tutorialPage, lotDemoReducer, initialLotDemo } = await import(tutorialUrl);
const chapter = path => tutorialChapters[chapterForPath(path)].id;

test('ciclo inicial cobre dez etapas e todos os atalhos abrem capítulos existentes', () => {
  assert.equal(tutorialChapters[0].demo, 'cycle');
  assert.equal(tutorialJourney.length, 10);
  for (const step of tutorialJourney) {
    assert.ok(step.result.trim());
    assert.ok(step.chapters.length);
    for (const id of step.chapters) assert.ok(tutorialChapters.some(entry => entry.id === id), id);
  }
  assert.equal(chapter('/sanidade/ocorrencias'), 'health');
  assert.equal(chapter('/config/plano'), 'plan');
  assert.equal(chapter('/config/usuarios'), 'team');
});

test('tutorial contextual distingue leitura, trato e detalhes sem coincidir prefixos de outra página', () => {
  for (const [path, expected] of Object.entries({ '/': 'dashboard', '/trato': 'feed', '/trato/leitura?dia=hoje': 'reading', '/lotes/novo/': 'lots', '/lotes/123': 'lots', '/currais': 'pens', '/pesagens/123': 'weighings', '/config/dietas': 'diets', '/lotes-extra': 'welcome', '/desconhecida': 'welcome' })) assert.equal(chapter(path), expected, path);
  assert.equal(tutorialPage(-1), 0);
  assert.equal(tutorialPage(100), tutorialChapters.length - 1);
});

test('atalhos dos capítulos correspondem a rotas existentes', () => {
  const router = read('../src/router.tsx');
  assert.equal(new Set(tutorialChapters.map(entry => entry.id)).size, tutorialChapters.length);
  for (const entry of tutorialChapters.filter(entry => entry.route)) {
    assert.ok(router.includes(`path: "${entry.route.slice(1)}"`), entry.route);
    assert.ok(entry.steps.length > 0);
  }
});

test('demonstração impede concluir sem curral e pode ser reiniciada', () => {
  let state = { ...initialLotDemo };
  for (const action of ['create', 'next', 'choose-pen']) assert.deepEqual(lotDemoReducer(state, action), initialLotDemo);
  for (const action of ['start', 'next', 'next']) state = lotDemoReducer(state, action);
  assert.equal(state.stage, 3);
  assert.equal(lotDemoReducer(state, 'create').stage, 3);
  state = lotDemoReducer(state, 'choose-pen');
  assert.equal(lotDemoReducer(lotDemoReducer(state, 'clear-pen'), 'create').stage, 3);
  state = lotDemoReducer(state, 'create');
  assert.equal(state.stage, 4);
  assert.deepEqual(lotDemoReducer(state, 'reset'), initialLotDemo);
  assert.deepEqual(initialLotDemo, { stage: 0, penChosen: false });
});

// Renderiza os controles e executa seus handlers reais; não substitui QA visual.
const mockUrl = url(`
export const useReducer=(reduce,initial)=>{const h=globalThis.__tutorialHarness;if(!h.state)h.state={...initial};return[h.state,action=>{h.state=reduce(h.state,action)}];};
export function Button(){};export function ArrowLeft(){};export function ArrowRight(){};export function CheckCircle2(){};export function MousePointer2(){};export function Plus(){};export function RotateCcw(){};
`);
const componentSource = compile(read('../src/components/tutorial/lot-tutorial-demo.tsx')).replace(/from\s+(['"])(.*?)\1/g, (_, quote, name) => `from "${name === 'react/jsx-runtime' ? import.meta.resolve(name) : name === '@/lib/tutorial' ? tutorialUrl : mockUrl}"`);
const { LotTutorialDemo } = await import(url(componentSource));
const nodes = root => {
  if (!root || typeof root !== 'object') return [];
  if (Array.isArray(root)) return root.flatMap(nodes);
  return root.props ? [root, ...nodes(root.props.children)] : [];
};
const button = (tree, label) => nodes(tree).find(node => node.type.name === 'Button' && JSON.stringify(node.props.children).includes(label));

test('botões da demonstração percorrem o lote, exigem seleção e repetem o exemplo', () => {
  globalThis.__tutorialHarness = {};
  let tree = LotTutorialDemo();
  button(tree, 'Novo lote').props.onClick();
  tree = LotTutorialDemo(); button(tree, 'Avançar').props.onClick();
  tree = LotTutorialDemo(); button(tree, 'Avançar').props.onClick();
  tree = LotTutorialDemo();
  assert.equal(button(tree, 'Criar lote de exemplo').props.disabled, true);
  nodes(tree).find(node => node.type === 'select').props.onChange({ target: { value: 'example' } });
  tree = LotTutorialDemo();
  assert.equal(button(tree, 'Criar lote de exemplo').props.disabled, false);
  button(tree, 'Criar lote de exemplo').props.onClick();
  tree = LotTutorialDemo();
  assert.ok(nodes(tree).some(node => node.props.role === 'status'));
  button(tree, 'Repetir demonstração').props.onClick();
  assert.ok(button(LotTutorialDemo(), 'Novo lote'));
  delete globalThis.__tutorialHarness;
});
