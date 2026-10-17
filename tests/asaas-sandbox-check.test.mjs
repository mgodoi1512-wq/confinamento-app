import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync(new URL('../supabase/functions/asaas-sandbox-check/handler.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createSandboxCheckHandler } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const origin = 'https://liben-agro.com';
const testKey = '$aact_hmlg_fixture_not_a_real_key';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const fixture = (settings = {}) => {
  const calls = [];
  const env = { APP_ALLOWED_ORIGINS: origin, SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-fixture', ASAAS_SANDBOX_API_KEY: testKey, ...settings.env };
  const envReads = [];
  const handler = createSandboxCheckHandler({
    env: name => { envReads.push(name); return env[name]; },
    now: () => new Date('2026-10-17T18:00:00.000Z'),
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/auth/v1/user')) return settings.auth ?? json({ id: 'admin-fixture' });
      if (url.endsWith('/rest/v1/rpc/is_platform_admin')) return settings.admin ?? json(true);
      if (url.startsWith('https://api-sandbox.asaas.com/')) {
        if (settings.networkFailure) throw new Error(testKey);
        return settings.provider ?? json({ object: 'list', data: [{ id: 'private-customer', email: 'private@example.invalid', cpfCnpj: 'private-cpf' }] });
      }
      throw new Error('Unexpected destination: ' + url);
    },
  });
  const request = (overrides = {}) => new Request('https://example.supabase.co/functions/v1/asaas-sandbox-check', { method: 'POST', headers: { origin, authorization: 'Bearer signed-user-token', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'check_connection' }), ...overrides });
  return { handler, request, calls, envReads };
};

test('pré-voo CORS não consulta credenciais nem provedores', async () => {
  const f = fixture(); const response = await f.handler(f.request({ method: 'OPTIONS', body: undefined }));
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), origin); assert.equal(f.calls.length, 0);
  assert.ok(!f.envReads.includes('ASAAS_SANDBOX_API_KEY'));
});
test('origem estranha é recusada antes da autenticação e não recebe CORS', async () => {
  const f = fixture(); const response = await f.handler(f.request({ headers: { origin: 'https://another.invalid', authorization: 'Bearer stolen-token' } }));
  assert.equal(response.status, 403); assert.equal(response.headers.get('access-control-allow-origin'), null); assert.equal(f.calls.length, 0);
});
test('sessão ausente e sessão inválida não alcançam Asaas', async () => {
  const f = fixture(); assert.equal((await f.handler(f.request({ headers: { origin } }))).status, 401); assert.equal(f.calls.length, 0);
  const g = fixture({ auth: json({ error: 'expired' }, 401) }); assert.equal((await g.handler(g.request())).status, 401); assert.equal(g.calls.length, 1);
});
for (const admin of [false, null, { isAdmin: true }, 'true']) test(`RPC administrativo deve retornar booleano true: recusa ${JSON.stringify(admin)}`, async () => {
  const f = fixture({ admin: json(admin) }); assert.equal((await f.handler(f.request())).status, 403);
  assert.equal(f.calls.length, 2); assert.ok(!f.envReads.includes('ASAAS_SANDBOX_API_KEY'));
});
test('consulta de perfil usa o JWT do usuário e não eleva para service_role', async () => {
  const f = fixture(); await f.handler(f.request());
  for (const call of f.calls.slice(0, 2)) { assert.equal(call.options.headers.Authorization, 'Bearer signed-user-token'); assert.equal(call.options.headers.apikey, 'anon-fixture'); }
});
for (const key of ['', '$aact_prod_fixture', 'legacy_fixture', '$aact_hmlg_bad key']) test(`chave ausente ou de outro ambiente não é enviada: ${key ? key.split('_')[1] : 'ausente'}`, async () => {
  const f = fixture({ env: { ASAAS_SANDBOX_API_KEY: key } }); assert.equal((await f.handler(f.request())).status, 503); assert.equal(f.calls.length, 2);
});
test('sucesso somente leitura retorna prova de conexão sem clientes, chave ou alterações de acesso', async () => {
  const f = fixture(); const response = await f.handler(f.request()); const raw = await response.text();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(JSON.parse(raw), { ok: true, environment: 'sandbox', checkedAt: '2026-10-17T18:00:00.000Z', paymentCreationEnabled: false, accessModeChanged: false });
  assert.ok(!raw.includes('private')); assert.ok(!raw.includes(testKey)); assert.equal(f.calls.length, 3);
  const provider = f.calls[2]; assert.equal(provider.url, 'https://api-sandbox.asaas.com/v3/customers?limit=1&offset=0');
  assert.equal(provider.options.method, 'GET'); assert.equal(provider.options.body, undefined); assert.equal(provider.options.headers.access_token, testKey); assert.equal(provider.options.redirect, 'error'); assert.ok(provider.options.signal);
});
for (const status of [400, 401, 403, 404, 429, 500]) test(`erro ${status} do Asaas é sanitizado`, async () => {
  const f = fixture({ provider: json({ secret: testKey, email: 'private@example.invalid' }, status) }); const response = await f.handler(f.request()); const raw = await response.text();
  assert.equal(response.status, status === 429 ? 429 : 502); assert.ok(!raw.includes(testKey)); assert.ok(!raw.includes('private@example.invalid'));
});
test('erro de rede não expõe texto de exceção nem a chave', async () => {
  const f = fixture({ networkFailure: true }); const response = await f.handler(f.request()); assert.equal(response.status, 502); assert.ok(!(await response.text()).includes(testKey));
});
test('retorno 200 com corpo inválido não é tratado como conexão confirmada', async () => {
  const f = fixture({ provider: json({ object: 'payment', data: [] }) }); assert.equal((await f.handler(f.request())).status, 502);
});
test('cliente não pode escolher destino, método ou ação de cobrança', async () => {
  for (const payload of [{ action: 'create_payment' }, { action: 'check_connection', baseUrl: 'https://api.asaas.com/v3' }, []]) {
    const f = fixture(); const response = await f.handler(f.request({ body: JSON.stringify(payload) })); assert.equal(response.status, 400); assert.equal(f.calls.length, 2);
  }
  const f = fixture(); assert.equal((await f.handler(f.request({ method: 'GET', body: undefined }))).status, 405); assert.equal(f.calls.length, 0);
});
