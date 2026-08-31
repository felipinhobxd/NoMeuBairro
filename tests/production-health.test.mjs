import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createHealthHandler } from '../api/health.js';
import { parseIncidentSnapshot, readLimitedText } from '../server/monitoringHealth.js';
import { createRequestLogger, reportServerIncident } from '../server/structuredLog.js';

const env = { VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) };
const snapshot = { schemaVersion: 2, openIncidents: 0, criticalIncidents: 0, testSequence: 0 };
function recorder() {
  return { headers: {}, statusCode: 200, body: undefined,
    setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; },
    json(v) { this.body = v; return this; }, end() { return this; },
  };
}
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('health valida REST e schema, sem revelar dados da amostra ou configuração', async () => {
  const requests = [];
  const handler = createHealthHandler({ env, fetcher: async (url, init) => {
    requests.push({ url, init });
    return response(url.includes('/posts?') ? [{ id: 'private-id' }] : snapshot);
  } });
  const res = recorder();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.release, 'a'.repeat(12));
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /select=id&limit=1/);
  assert.doesNotMatch(JSON.stringify(res.body), /private-id|fixture-public-key|fixture\.supabase/);
});

test('health não confunde fallback HTML ou schema antigo com produção saudável', async () => {
  for (const invalid of ['<html>fallback</html>', JSON.stringify({ schemaVersion: 1 }), JSON.stringify({ ...snapshot, openIncidents: -1 })]) {
    const res = recorder();
    await createHealthHandler({ env, fetcher: async url => url.includes('/posts?') ? response([]) : new Response(invalid) })({ method: 'GET' }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.status, 'unavailable');
  }
});

test('health reporta indisponibilidade sem propagar erros privados do upstream', async () => {
  const res = recorder();
  await createHealthHandler({ env, fetcher: async () => { throw new Error('token-secret user@example.test'); } })({ method: 'GET' }, res);
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(res.body), /token-secret|@/);
  const missing = recorder();
  await createHealthHandler({ env: {}, fetcher: async () => { assert.fail('sem configuração não deve consultar'); } })({ method: 'GET' }, missing);
  assert.equal(missing.statusCode, 503);
});

test('health possui timeout e resposta HEAD sem corpo', async () => {
  const res = recorder();
  await createHealthHandler({ env, timeoutMs: 10, fetcher: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })) })({ method: 'HEAD' }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body, undefined);
  const method = recorder();
  await createHealthHandler({ env, fetcher: async () => assert.fail('método não permitido') })({ method: 'POST' }, method);
  assert.equal(method.statusCode, 405);
  assert.equal(method.headers.Allow, 'GET, HEAD');
});

test('health diferencia incidentes reais de testes e detecta conexão lenta', async () => {
  for (const [monitoring, times, status] of [
    [{ ...snapshot, testSequence: 3 }, [0, 100], 'ok'],
    [{ ...snapshot, openIncidents: 1, criticalIncidents: 1 }, [0, 100], 'degraded'],
    [snapshot, [0, 3500], 'degraded'],
  ]) {
    const res = recorder();
    await createHealthHandler({ env, clock: () => times.shift() ?? 0, fetcher: async url => response(url.includes('/posts?') ? [] : monitoring) })({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, status);
  }
});

test('protocolo rejeita contadores inválidos e limita tamanho de resposta', async () => {
  assert.equal(parseIncidentSnapshot({ ...snapshot, criticalIncidents: 2 }), null);
  assert.equal(parseIncidentSnapshot({ ...snapshot, testSequence: '123' }), null);
  assert.deepEqual(parseIncidentSnapshot({ ...snapshot, private: 'secret' }), snapshot);
  await assert.rejects(() => readLimitedText(new Response('x'.repeat(2049)), 2048), /response_too_large/);
});

test('logs estruturados não incluem URL, query, conteúdo, tokens nem mensagem livre', async () => {
  const logs = [], pending = [], reports = [], times = [100, 5100];
  const res = new EventEmitter();
  res.statusCode = 503;
  const logger = createRequestLogger({ log: line => logs.push(line), clock: () => times.shift(), wait: promise => pending.push(promise), report: (...args) => reports.push(args) });
  logger({ method: 'GET', url: '/api/post-image?id=private', query: { token: 'secret' }, headers: { 'x-vercel-id': 'gru1::valid', authorization: 'Bearer secret' }, body: { email: 'email@example.test' } }, res, '/api/post-image');
  res.emit('finish');
  await Promise.all(pending);
  assert.equal(logs.length, 2);
  assert.equal(JSON.parse(logs[1]).level, 'error');
  assert.equal(JSON.parse(logs[1]).durationMs, 5000);
  assert.doesNotMatch(logs.join(''), /private|secret|@|authorization|query/);
  assert.deepEqual(reports, [['/api/post-image', 503, 5000]]);
});

test('falhas no envio de telemetria não quebram a resposta da API', async () => {
  const res = new EventEmitter(), pending = [];
  res.statusCode = 500;
  createRequestLogger({ log: () => {}, wait: promise => pending.push(promise), report: () => { throw new Error('offline'); } })({ method: 'GET' }, res, '/api/share-post');
  assert.doesNotThrow(() => res.emit('finish'));
  await assert.doesNotReject(() => Promise.all(pending));
});

test('coleta do servidor funciona só em produção e não monitora o próprio health', async () => {
  const sent = [];
  const fetcher = async (_url, init) => { sent.push(JSON.parse(init.body)); return response({ accepted: true }); };
  await reportServerIncident('/api/share-post', 502, 300, { env: { ...env, VERCEL_ENV: 'preview' }, fetcher });
  await reportServerIncident('/api/health', 503, 300, { env: { ...env, VERCEL_ENV: 'production' }, fetcher });
  await reportServerIncident('/api/share-post', 404, 300, { env: { ...env, VERCEL_ENV: 'production' }, fetcher });
  assert.equal(sent.length, 0);
  await reportServerIncident('/api/share-post', 502, 300, { env: { ...env, VERCEL_ENV: 'production' }, fetcher });
  await reportServerIncident('/api/share-post', 502, 300, { env: { ...env, VERCEL_ENV: 'production' }, fetcher });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].p_message, 'api.http');
  assert.equal(sent[0].p_target, '/api/share-post');
});
