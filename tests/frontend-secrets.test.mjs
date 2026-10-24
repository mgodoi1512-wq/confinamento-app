import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/supabase-config.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readSupabaseConfig } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const env = { VITE_SUPABASE_URL: 'https://example.supabase.co' };
const token = role => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ role })).toString('base64url'), 'fake-signature-for-local-tests'].join('.');
test('não permite publicar chave service_role legada, secret nova ou JWT de usuário', () => {
  for (const key of [token('service_role'), token('authenticated'), token('supabase_admin'), 'sb_secret_local_fixture']) {
    assert.throws(() => readSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }), /chave pública/);
  }
});
test('aceita anon legado e publishable; a assinatura é validada pelo Supabase, não pelo frontend', () => {
  for (const key of [token('anon'), 'sb_publishable_local_fixture']) {
    assert.equal(readSupabaseConfig({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }).key, key);
  }
});
test('impede transporte HTTP externo, permitindo somente desenvolvimento local', () => {
  const key = 'sb_publishable_local_fixture';
  assert.throws(() => readSupabaseConfig({ VITE_SUPABASE_URL: 'http://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: key }), /HTTPS/);
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(readSupabaseConfig({ VITE_SUPABASE_URL: `http://${host}:54321`, VITE_SUPABASE_PUBLISHABLE_KEY: key }).url, `http://${host}:54321`);
  }
});
