import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/monitoringCore.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const core = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('monitoramento remove IDs, parâmetros e rotas não reconhecidas', () => {
  assert.equal(core.canonicalProductionPath('#/post/123?email=private@example.test'), '/post/:id');
  assert.equal(core.canonicalProductionPath('/relato/123'), '/post/:id');
  assert.equal(core.canonicalProductionPath('/perfil/private-user#secret'), '/perfil/:id');
  assert.equal(core.canonicalProductionPath('/empresa/secret'), '/empresa/:id');
  assert.equal(core.canonicalProductionPath('/token-secret'), '/');
  assert.equal(core.canonicalProductionPath('#/mapa?lat=123'), '/mapa');
});

test('erros geram códigos fixos, nunca mensagens livres', () => {
  for (const error of [new TypeError('senha-do-usuario'), new Error('email@example.test'), 'documento 12345678901']) {
    const result = core.classifyProductionError(error);
    assert.ok(core.monitoringCodes.includes(result));
    assert.doesNotMatch(result, /senha|@|123/);
  }
  assert.equal(core.classifyProductionError(new ReferenceError('nome privado')), 'js.reference_error');
  assert.equal(core.classifyProductionError(new Error('Failed to fetch dynamically imported module: https://secret')), 'resource.chunk');
});

test('local do erro mantém apenas o arquivo compilado e linha, nunca a pilha inteira', () => {
  assert.equal(core.safeAssetTarget('at f (https://nomeubairro.vercel.app/assets/Feed-abcdefgh.js:35:712)\nprivate@example.test'), 'asset/Feed-abcdefgh.js:35:712');
  assert.equal(core.safeAssetTarget('https://outside.example/token'), 'app');
  assert.equal(core.safeProductionTarget('/storage/v1/object/photos/private-person/file.jpg'), 'app');
  assert.equal(core.safeProductionTarget('/rest/v1/posts?private=secret'), 'app');
});

test('alvos de API descartam filtros, CEP, usuários e caminhos de arquivos', () => {
  const backend = 'https://fixture.supabase.co';
  const origin = 'https://nomeubairro.vercel.app';
  const target = url => core.productionApiTarget(url, backend, origin);
  assert.equal(target(backend + '/rest/v1/posts?id=eq.private&select=*'), '/rest/v1/posts');
  assert.equal(target(backend + '/storage/v1/object/private/secret.jpg?token=secret'), '/storage/v1/object');
  assert.equal(target(backend + '/auth/v1/user/private'), '/auth/v1/user');
  assert.equal(target('https://viacep.com.br/ws/12345678/json/'), '/external/viacep');
  assert.equal(target('https://unrelated.example/path'), null);
  assert.equal(target('/api/post-image?id=secret'), '/api/post-image');
  assert.equal(core.productionApiTarget(origin + '/supabase-mock/rest/v1/posts', origin + '/supabase-mock', origin), '/rest/v1/posts');
});

test('telemetria, analytics e painel não geram chamadas recursivas', () => {
  for (const rpc of ['log_production_event', 'log_client_error', 'track_page_view', 'get_production_monitoring', 'get_production_health', 'test_production_monitoring', 'resolve_production_alert']) {
    assert.equal(core.productionApiTarget('https://fixture.supabase.co/rest/v1/rpc/' + rpc, 'https://fixture.supabase.co', 'https://nomeubairro.vercel.app'), null);
  }
});

test('limites de latência diferenciam leitura, funções e upload', () => {
  assert.equal(core.slowApiThreshold('/rest/v1/posts', 'GET'), 4000);
  assert.equal(core.slowApiThreshold('/functions/v1/lookup', 'GET'), 8000);
  assert.equal(core.slowApiThreshold('/storage/v1/object', 'POST'), 12000);
  assert.equal(core.slowApiThreshold('/rest/v1/posts', 'POST'), 12000);
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(core.isIncidentStatus(status), false);
  for (const status of [408, 429, 500, 503]) assert.equal(core.isIncidentStatus(status), true);
});

test('cada página limita volume e deduplica repetições por um minuto', () => {
  const allow = core.createReportBudget();
  assert.equal(allow('same', 100000), true);
  assert.equal(allow('same', 100010), false);
  for (let i = 1; i < 20; i++) assert.equal(allow('event-' + i, 100020), true);
  assert.equal(allow('extra', 100030), false);
  assert.equal(allow('same', 160000), true);
});

test('contratos de privacidade e isolamento de ambientes permanecem explícitos', async () => {
  const [client, migration, panel] = await Promise.all([
    readFile(new URL('../src/utils/productionMonitoring.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260831004928_production_monitoring_alerts.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ProductionMonitoringPanel.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(client, /window\.location\.hostname === 'nomeubairro\.vercel\.app'/);
  assert.match(client, /backend === `\$\{window\.location\.origin\}\/supabase-mock`/);
  assert.match(client, /navigator\.onLine === false/);
  assert.doesNotMatch(client, /p_message:.*\.message|Authorization:|user_id:/);
  assert.match(migration, /pg_try_advisory_xact_lock/);
  assert.match(migration, /daily_samples >= 10000/);
  assert.match(migration, /minute_samples >= 120/);
  assert.match(migration, /daily_cardinality_limit/);
  assert.match(migration, /interval '15 minutes'/);
  assert.match(migration, /revoke all on function public\.test_production_monitoring\(\) from public, anon/);
  assert.match(panel, /document\.visibilityState === 'visible'/);
  assert.match(panel, /if \(pending\.current\) return pending\.current/);
  assert.doesNotMatch(panel, /Produção saudável/);
});
