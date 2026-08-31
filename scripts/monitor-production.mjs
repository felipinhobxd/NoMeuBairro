import { pathToFileURL } from 'node:url';
import { parseIncidentSnapshot, readLimitedText } from '../server/monitoringHealth.js';

const SITE = 'https://nomeubairro.vercel.app';
const REPOSITORY = 'felipinhobxd/NoMeuBairro';
const OWNER = 'felipinhobxd';
const INCIDENT_MARKER = '<!-- nmb-production-monitor:incident:v1 -->';
const TEST_MARKER = '<!-- nmb-production-monitor:delivery-test:';
const labels = {
  'site-unavailable': 'Página principal indisponível ou inválida',
  'asset-unavailable': 'Arquivo principal do aplicativo indisponível',
  'health-unavailable': 'Verificação do serviço indisponível ou inválida',
  'database-unavailable': 'Conexão com o banco indisponível',
  'telemetry-unavailable': 'Coleta de monitoramento indisponível',
  'active-incidents': 'Incidentes aguardando revisão na administração',
  'critical-incidents': 'Incidentes críticos aguardando revisão na administração',
  'slow-health': 'Verificação do serviço acima de três segundos',
};

async function request(fetcher, url, init = {}, { json = false, maxBytes = 64000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal, redirect: 'error' });
    const text = init.method === 'HEAD' ? '' : await readLimitedText(response, maxBytes);
    return { ok: response.ok, status: response.status, data: json && text ? JSON.parse(text) : text, type: response.headers.get('content-type') || '' };
  } finally { clearTimeout(timer); }
}

export async function inspectProduction({ fetcher = globalThis.fetch } = {}) {
  const reasons = new Set();
  let snapshot = null;
  await Promise.all([
    (async () => {
      let asset;
      try {
        const page = await request(fetcher, `${SITE}/`);
        if (!page.ok || !/id=["']root["']/.test(page.data)) throw new Error('invalid_page');
        asset = page.data.match(/<script\b[^>]*\bsrc=["'](?:\.)?(\/assets\/index-[A-Za-z0-9_-]+\.js)["'][^>]*>/)?.[1];
        if (!asset) throw new Error('missing_entrypoint');
      } catch { reasons.add('site-unavailable'); return; }
      try {
        const result = await request(fetcher, `${SITE}${asset}`, { method: 'HEAD' });
        if (!result.ok || !/javascript|ecmascript/.test(result.type)) reasons.add('asset-unavailable');
      } catch { reasons.add('asset-unavailable'); }
    })(),
    (async () => {
      try {
        const result = await request(fetcher, `${SITE}/api/health`, {}, { json: true, maxBytes: 4096 });
        const body = result.data;
        if (![200, 503].includes(result.status) || body?.service !== 'NoMeuBairro' || body.schemaVersion !== 2
          || !['ok', 'degraded', 'unavailable'].includes(body.status)
          || !['ok', 'unavailable'].includes(body.checks?.database) || !['ok', 'unavailable'].includes(body.checks?.telemetry)
          || !Number.isFinite(body.durationMs) || body.durationMs < 0) throw new Error('invalid_health');
        if (body.checks.database !== 'ok') reasons.add('database-unavailable');
        if (body.checks.telemetry !== 'ok') reasons.add('telemetry-unavailable');
        snapshot = parseIncidentSnapshot(body.monitoring);
        if (body.checks.telemetry === 'ok' && !snapshot) throw new Error('invalid_snapshot');
        if (snapshot?.criticalIncidents > 0) reasons.add('critical-incidents');
        else if (snapshot?.openIncidents > 0) reasons.add('active-incidents');
        if (body.durationMs >= 3000) reasons.add('slow-health');
        if (result.status === 503 || body.status === 'unavailable') reasons.add('health-unavailable');
      } catch { reasons.add('health-unavailable'); }
    })(),
  ]);
  return { reasons: [...reasons].sort(), snapshot };
}

function managed(issue, marker) {
  return !issue.pull_request && issue.user?.login === 'github-actions[bot]'
    && typeof issue.body === 'string' && issue.body.startsWith(marker);
}

export async function runProductionMonitor({
  repository = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN,
  fetcher = globalThis.fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  runId = process.env.GITHUB_RUN_ID,
} = {}) {
  if (repository !== REPOSITORY || !token) throw new Error('monitor_configuration_missing');
  let state = await inspectProduction({ fetcher });
  if (state.reasons.length) {
    await sleep(1500);
    state = await inspectProduction({ fetcher }); // A transient failure must survive a second check.
  }
  const github = async (path, method = 'GET', body) => {
    const result = await request(fetcher, `https://api.github.com/repos/${REPOSITORY}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, { json: true, maxBytes: 2_000_000 });
    if (!result.ok) throw new Error(`github_${result.status}`); // Never print response bodies or the token.
    return result.data;
  };
  const issues = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await github(`/issues?state=all&creator=github-actions%5Bbot%5D&per_page=100&sort=created&direction=desc&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('invalid_issue_list');
    issues.push(...batch);
    if (batch.length < 100) break;
    if (page === 5) throw new Error('monitor_issue_history_limit'); // Fail closed instead of duplicating an old alert.
  }
  const runLink = /^\d+$/.test(runId || '') ? `https://github.com/${REPOSITORY}/actions/runs/${runId}` : `https://github.com/${REPOSITORY}/actions/workflows/production-monitor.yml`;
  const links = `\n\n[Administração](${SITE}/#/admin) · [Verificação do serviço](${SITE}/api/health) · [Execução](${runLink})\n\nDetalhes técnicos restritos à administração. Este aviso não contém dados de usuários.`;
  const open = issues.find(issue => issue.state === 'open' && managed(issue, INCIDENT_MARKER));
  let incidentUrl = open?.html_url || null;
  if (state.reasons.length) {
    const signature = `<!-- state:${state.reasons.join(',')} -->`;
    const body = `${INCIDENT_MARKER}\n${signature}\nO monitor encontrou uma condição que precisa de verificação:\n\n${state.reasons.map(reason => `- ${labels[reason]}`).join('\n')}${links}`;
    if (!open) {
      const created = await github('/issues', 'POST', { title: '[Produção] NoMeuBairro requer atenção', body, assignees: [OWNER] });
      incidentUrl = created.html_url;
    } else if (!open.body.includes(signature)) {
      await github(`/issues/${open.number}`, 'PATCH', { body });
      await github(`/issues/${open.number}/comments`, 'POST', { body: `O estado do monitoramento mudou:\n\n${state.reasons.map(reason => `- ${labels[reason]}`).join('\n')}${links}` });
    }
  } else if (open) {
    await github(`/issues/${open.number}`, 'PATCH', { state: 'closed', state_reason: 'completed', body: `${open.body}\n\n**Recuperação verificada:** página, arquivo principal e banco responderam corretamente; nenhum incidente permanece aberto na administração. [Execução](${runLink}).` });
  }

  let testUrl = null;
  const sequence = state.snapshot?.testSequence;
  if (sequence > 0) {
    const marker = `${TEST_MARKER}${sequence} -->`;
    let delivery = issues.find(issue => managed(issue, marker));
    if (!delivery) delivery = await github('/issues', 'POST', {
      title: '[Teste] Entrega do monitoramento — sem incidente real', assignees: [OWNER],
      body: `${marker}\nTeste solicitado pela administração do NoMeuBairro. O evento atravessou o banco, a verificação de produção e este canal de alertas. **Nenhuma falha real foi provocada.**\n\nEsta issue é encerrada automaticamente; o registro de teste pode ser marcado como resolvido no painel.${links}`,
    });
    testUrl = delivery.html_url;
    if (delivery.state !== 'closed') await github(`/issues/${delivery.number}`, 'PATCH', { state: 'closed', state_reason: 'completed' });
  }
  return { status: state.reasons.length ? 'attention' : 'ok', reasons: state.reasons, incidentUrl, testUrl };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionMonitor().then(result => console.log(JSON.stringify(result))).catch(error => {
    const code = /^github_\d+$|^monitor_[a-z_]+$|^invalid_issue_list$/.test(error?.message || '') ? error.message : 'monitor_failed';
    console.error(code);
    process.exitCode = 1;
  });
}
