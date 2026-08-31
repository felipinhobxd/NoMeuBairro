import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const adminId = '20000000-0000-4000-8000-000000000050';
async function setup(page: Page, authenticated = false, moderator = true) {
  const state = { events: [] as Record<string, unknown>[], reportHeaders: [] as Record<string, string>[], monitorReads: 0, failMonitor: false, testRequested: false, resolved: false, probeStatus: 200 };
  await page.addInitScript(({ authenticated, id }) => {
    localStorage.setItem('nmb-font-size-v1', 'medium');
    localStorage.setItem('anb-cookie-consent', 'essential');
    localStorage.setItem('nmb-onboarding-v6', 'done');
    localStorage.setItem('nmb-pwa-install-dismissed-at', String(Date.now()));
    if (authenticated) {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
      localStorage.setItem('sb-127-auth-token', JSON.stringify({
        access_token: encode({ alg: 'HS256' }) + '.' + encode({ sub: id, exp, role: 'authenticated' }) + '.fixture',
        refresh_token: 'fixture-only', expires_at: exp, expires_in: 3600, token_type: 'bearer',
        user: { id, email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Administrador de teste', account_type: 'resident' }, created_at: '2026-01-01T12:00:00Z' },
      }));
    }
  }, { authenticated, id: adminId });
  await page.routeWebSocket('**/supabase-mock/realtime/**', socket => { socket.onMessage(() => {}); });
  await page.route('**/supabase-mock/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [], status = 200;
    if (path.endsWith('/log_production_event')) {
      state.events.push(route.request().postDataJSON());
      state.reportHeaders.push(route.request().headers());
      body = { accepted: true };
    } else if (path.endsWith('/probe_fixture')) {
      status = state.probeStatus; body = { message: 'private@example.test', original: true };
    } else if (path.endsWith('/get_production_monitoring')) {
      state.monitorReads++;
      if (state.failMonitor) { status = 503; body = { message: 'fixture unavailable' }; }
      else body = {
        schemaVersion: 2, generatedAt: new Date().toISOString(),
        summary: { openAlerts: 0, criticalOpenAlerts: 0, clientErrorsToday: 0, apiFailuresToday: 0, slowPagesToday: 0, slowApisToday: 0, latestEventAt: null },
        alerts: state.testRequested ? [{ id: 1, fingerprint: 'test', event_type: 'client_error', severity: 'warning', path: '/admin', target: 'app', message: 'Teste de entrega; não é uma falha real', code: 'monitoring.self_test', is_test: true, status_code: null, occurrences: 1, status: state.resolved ? 'resolved' : 'open', first_triggered_at: '2026-08-31T00:00:00Z', last_triggered_at: '2026-08-31T00:00:00Z', resolved_at: state.resolved ? '2026-08-31T00:05:00Z' : null }] : [],
        events: [],
      };
    } else if (path.endsWith('/test_production_monitoring')) { state.testRequested = true; body = { accepted: true }; }
    else if (path.endsWith('/resolve_production_alert')) { state.resolved = true; body = true; }
    else if (path.endsWith('/is_moderator')) body = moderator;
    else if (path.endsWith('/app_roles')) body = moderator ? { role: 'admin' } : null;
    else if (path.endsWith('/users')) body = { id: adminId, name: 'Administrador de teste', avatar_url: null, reputation: 1, created_at: '2026-01-01T12:00:00Z' };
    else if (path.includes('/auth/v1/')) body = { user: null, session: null };
    else if (path.endsWith('/get_neighborhood_weekly_summary')) body = null;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return state;
}

test('erro de navegador envia código e rota genérica sem mensagem ou token', async ({ page }) => {
  const state = await setup(page, true);
  await page.goto('/');
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'senha secreta private@example.test', error: new TypeError('senha secreta private@example.test'), filename: location.origin + '/assets/Feed-abcdefgh.js', lineno: 7, colno: 18 }));
    window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('outra mensagem'), filename: location.origin + '/assets/Feed-abcdefgh.js', lineno: 7, colno: 18 }));
  });
  await expect.poll(() => state.events.filter(event => event.p_message === 'js.type_error').length).toBe(1);
  const event = state.events.find(event => event.p_message === 'js.type_error')!;
  expect(event.p_target).toBe('asset/Feed-abcdefgh.js:7:18');
  expect(JSON.stringify(state.events)).not.toMatch(/senha|private@example|admin@example|fixture-only/);
  expect(state.reportHeaders.every(headers => !headers.authorization)).toBe(true);
});

test('falha de API mantém a resposta original e oculta filtros e mensagem', async ({ page }) => {
  const state = await setup(page);
  state.probeStatus = 503;
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/utils/productionMonitoring.ts';
    const monitor = await import(modulePath);
    const response = await monitor.monitoredFetch('/supabase-mock/rest/v1/probe_fixture?email=private@example.test');
    return { status: response.status, body: await response.json() };
  });
  expect(result).toEqual({ status: 503, body: { message: 'private@example.test', original: true } });
  await expect.poll(() => state.events.some(event => event.p_message === 'api.http')).toBe(true);
  const event = state.events.find(event => event.p_message === 'api.http')!;
  expect(event.p_target).toBe('/rest/v1/probe_fixture');
  expect(event.p_status_code).toBe(503);
  expect(JSON.stringify(event)).not.toContain('private');
});

test('API lenta é medida sem consumir o corpo da resposta', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/utils/productionMonitoring.ts';
    const monitor = await import(modulePath);
    const original = performance.now;
    let calls = 0;
    performance.now = () => calls++ === 0 ? 100 : 5500;
    try {
      const response = await monitor.monitoredFetch('/supabase-mock/rest/v1/probe_fixture');
      return response.json();
    } finally { performance.now = original; }
  });
  expect(result.original).toBe(true);
  await expect.poll(() => state.events.some(event => event.p_message === 'api.slow')).toBe(true);
  expect(state.events.find(event => event.p_message === 'api.slow')?.p_duration_ms).toBe(5400);
});

test('cancelamento, respostas esperadas, fotos e extensões não geram incidentes', async ({ page }) => {
  const state = await setup(page);
  state.probeStatus = 403;
  await page.goto('/');
  await page.evaluate(async () => {
    const modulePath = '/src/utils/productionMonitoring.ts';
    const monitor = await import(modulePath);
    await monitor.monitoredFetch('/supabase-mock/rest/v1/probe_fixture');
    const controller = new AbortController(); controller.abort();
    await monitor.monitoredFetch('/supabase-mock/rest/v1/probe_fixture', { signal: controller.signal }).catch(() => {});
    const img = document.createElement('img'); document.body.append(img); img.dispatchEvent(new Event('error')); img.remove();
    window.dispatchEvent(new ErrorEvent('error', { filename: 'chrome-extension://fixture/code.js', error: new Error('extension') }));
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new DOMException('cancelled', 'AbortError') }));
  });
  await page.waitForTimeout(150);
  expect(state.events.filter(event => event.p_event_type !== 'page_slow')).toEqual([]);
});

test('falha de renderização é registrada e offline não dispara novos envios', async ({ page, context }) => {
  const state = await setup(page);
  await page.goto('/');
  await page.evaluate(async () => {
    const modulePath = '/src/utils/productionMonitoring.ts';
    const monitor = await import(modulePath);
    monitor.reportRenderFailure(new Error('private@example.test'), '/perfil/usuario-secreto');
  });
  await expect.poll(() => state.events.some(event => event.p_event_type === 'render_error')).toBe(true);
  expect(state.events.find(event => event.p_event_type === 'render_error')?.p_path).toBe('/perfil/:id');
  const count = state.events.length;
  await context.setOffline(true);
  await page.evaluate(async () => {
    const modulePath = '/src/utils/productionMonitoring.ts';
    const monitor = await import(modulePath);
    await monitor.reportProductionEvent({ eventType: 'client_error', code: 'js.range_error', target: 'app' });
  });
  await context.setOffline(false);
  expect(state.events).toHaveLength(count);
});

test('painel distingue falha de leitura, testa entrega e resolve sem falsa saúde', async ({ page }) => {
  const state = await setup(page, true);
  state.failMonitor = true;
  await page.goto('/#/admin');
  await page.getByRole('tab', { name: 'Produção', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estado do monitoramento não confirmado' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sem incidentes abertos' })).toHaveCount(0);
  state.failMonitor = false;
  await page.getByRole('button', { name: 'Atualizar monitoramento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sem incidentes abertos' })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar teste de alerta', exact: true }).click();
  await expect(page.getByText('Teste · não é incidente', { exact: true })).toBeVisible();
  const serious = (await new AxeBuilder({ page }).analyze()).violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Marcar resolvido', exact: true }).click();
  await expect(page.getByText('Teste · não é incidente', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Histórico recente de resoluções (1)', { exact: true })).toBeVisible();
  expect(state.resolved).toBe(true);
});

test('conta sem permissão não acessa nem consulta detalhes de monitoramento', async ({ page }) => {
  const state = await setup(page, true, false);
  await page.goto('/#/admin');
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Produção', exact: true })).toHaveCount(0);
  expect(state.monitorReads).toBe(0);
});
