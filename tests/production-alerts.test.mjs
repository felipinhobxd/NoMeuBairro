import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectProduction, runProductionMonitor } from '../scripts/monitor-production.mjs';

const repository = 'felipinhobxd/NoMeuBairro';
const okSnapshot = { schemaVersion: 2, openIncidents: 0, criticalIncidents: 0, testSequence: 0 };
function fixture() {
  const state = { issues: [], writes: [], checks: 0, homeFailures: 0, entrySrc: './assets/index-abcdefgh.js', assetChecks: 0, brokenAsset: false, badHealth: false, monitoring: { ...okSnapshot }, durationMs: 100, failGitHub: false };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const fetcher = async (url, init = {}) => {
    const target = new URL(url);
    if (target.origin === 'https://nomeubairro.vercel.app') {
      assert.equal(init.headers?.Authorization, undefined, 'GitHub token must never go to production');
      if (target.pathname === '/') {
        state.checks++;
        if (state.homeFailures-- > 0) return new Response('private server error', { status: 500 });
        return new Response(`<html><div id="root"></div><script type="module" src="${state.entrySrc}"></script></html>`);
      }
      if (target.pathname.startsWith('/assets/')) {
        state.assetChecks++;
        assert.equal(init.method, 'HEAD');
        return new Response(null, { status: state.brokenAsset ? 404 : 200, headers: { 'content-type': 'application/javascript' } });
      }
      if (target.pathname === '/api/health') return state.badHealth ? new Response('<html>wrong route</html>') : json({
        service: 'NoMeuBairro', schemaVersion: 2, status: state.monitoring.openIncidents || state.durationMs >= 3000 ? 'degraded' : 'ok',
        checks: { database: 'ok', telemetry: 'ok' }, durationMs: state.durationMs, monitoring: state.monitoring,
        private: 'private@example.test ignored by parser',
      });
    }
    assert.equal(target.origin, 'https://api.github.com');
    assert.ok(target.pathname.startsWith('/repos/' + repository));
    if (state.failGitHub) return json({ message: 'private credential diagnostic' }, 403);
    if (init.method === 'GET') return json(state.issues);
    const body = JSON.parse(init.body);
    state.writes.push({ path: target.pathname, method: init.method, body });
    if (target.pathname.endsWith('/issues')) {
      const issue = { ...body, number: state.issues.length + 1, state: 'open', user: { login: 'github-actions[bot]' }, html_url: 'https://github.com/' + repository + '/issues/' + (state.issues.length + 1) };
      state.issues.push(issue);
      return json(issue, 201);
    }
    if (target.pathname.endsWith('/comments')) return json({ id: 1 }, 201);
    const number = Number(target.pathname.split('/').at(-1));
    const issue = state.issues.find(item => item.number === number);
    assert.ok(issue);
    Object.assign(issue, body);
    return json(issue);
  };
  const run = () => runProductionMonitor({ repository, token: 'fake-github-token', fetcher, sleep: async () => {}, runId: '123' });
  return { state, fetcher, run };
}

test('produção saudável não cria issues nem alertas', async () => {
  const { state, run } = fixture();
  assert.equal((await run()).status, 'ok');
  assert.equal(state.writes.length, 0);
});

test('falhas transitórias são conferidas novamente antes de notificar', async () => {
  const { state, run } = fixture();
  state.homeFailures = 1;
  assert.equal((await run()).status, 'ok');
  assert.equal(state.checks, 2);
  assert.equal(state.issues.length, 0);
});

test('incidente cria um aviso atribuído ao dono, não repete e fecha na recuperação', async () => {
  const { state, run } = fixture();
  state.monitoring = { ...okSnapshot, openIncidents: 2, criticalIncidents: 1 };
  const result = await run();
  assert.equal(result.status, 'attention');
  assert.deepEqual(state.issues[0].assignees, ['felipinhobxd']);
  assert.doesNotMatch(state.issues[0].body, /private@example|fake-github-token/);
  assert.match(state.issues[0].body, /Incidentes críticos/);
  const writes = state.writes.length;
  await run();
  assert.equal(state.writes.length, writes, 'estado estável não gera spam');
  state.monitoring = { ...okSnapshot };
  await run();
  assert.equal(state.issues[0].state, 'closed');
  assert.match(state.issues[0].body, /Recuperação verificada/);
  await run();
  assert.equal(state.issues.length, 1);
});

test('mudança de gravidade notifica sem abrir uma segunda issue', async () => {
  const { state, run } = fixture();
  state.monitoring.openIncidents = 1;
  await run();
  state.monitoring.criticalIncidents = 1;
  await run();
  assert.equal(state.issues.length, 1);
  assert.equal(state.writes.filter(write => write.path.endsWith('/comments')).length, 1);
});

test('teste de entrega é identificado, fechado e não reenvia o mesmo evento', async () => {
  const { state, run } = fixture();
  state.monitoring.testSequence = 7;
  const result = await run();
  assert.equal(result.status, 'ok');
  assert.match(result.testUrl, /issues\/1$/);
  assert.equal(state.issues[0].state, 'closed');
  assert.match(state.issues[0].title, /sem incidente real/);
  assert.match(state.issues[0].body, /Nenhuma falha real/);
  const writes = state.writes.length;
  await run();
  assert.equal(state.writes.length, writes);
});

test('issue criada por outra pessoa não pode ser fechada pelo monitor', async () => {
  const { state, run } = fixture();
  state.issues.push({ number: 99, state: 'open', user: { login: 'someone-else' }, body: '<!-- nmb-production-monitor:incident:v1 -->', html_url: 'https://github.com/example' });
  await run();
  assert.equal(state.issues[0].state, 'open');
  assert.equal(state.writes.length, 0);
});

test('arquivo principal ausente e health inválido são detectados', async () => {
  const { state, fetcher } = fixture();
  state.brokenAsset = true;
  state.badHealth = true;
  const result = await inspectProduction({ fetcher });
  assert.deepEqual(result.reasons, ['asset-unavailable', 'health-unavailable']);
});

test('latência persistente alerta e erros de permissão não são ocultados', async () => {
  const { state, run } = fixture();
  state.durationMs = 4000;
  assert.deepEqual((await run()).reasons, ['slow-health']);
  state.failGitHub = true;
  await assert.rejects(run, /^Error: github_403$/);
  await assert.rejects(() => runProductionMonitor({ repository: 'other/repo', token: 'fake' }), /monitor_configuration_missing/);
});

test('caminhos de script relativos do build Vite e absolutos usam o mesmo asset', async () => {
  for (const entrySrc of ['./assets/index-abcdefgh.js', '/assets/index-abcdefgh.js']) {
    const { state, run } = fixture();
    state.entrySrc = entrySrc;
    assert.equal((await run()).status, 'ok');
    assert.equal(state.assetChecks, 1, 'a verificação deve testar o JavaScript real');
    assert.equal(state.issues.length, 0, 'a base relativa não pode gerar falso incidente');
  }
});

test('script de origem externa não é aceito nem seguido pelo verificador', async () => {
  for (const entrySrc of ['https://other.example/assets/index-abcdefgh.js', '//other.example/assets/index-abcdefgh.js']) {
    const { state, fetcher } = fixture();
    state.entrySrc = entrySrc;
    assert.deepEqual((await inspectProduction({ fetcher })).reasons, ['site-unavailable']);
    assert.equal(state.assetChecks, 0);
  }
});
