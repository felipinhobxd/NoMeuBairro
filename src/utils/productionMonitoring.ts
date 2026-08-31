import {
  canonicalProductionPath, classifyProductionError, createReportBudget, isIncidentStatus,
  monitoringCodes, productionApiTarget, safeAssetTarget, safeProductionTarget, slowApiThreshold,
  type MonitoringCode, type ProductionEventType,
} from './monitoringCore';

export { canonicalProductionPath } from './monitoringCore';
type ProductionEvent = {
  eventType: ProductionEventType;
  code: MonitoringCode;
  path?: string;
  target?: string;
  durationMs?: number;
  statusCode?: number;
};

const backend = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
const nativeFetch = globalThis.fetch.bind(globalThis);
const allowReport = createReportBudget();
let started = false;

export function isProductionMonitoringEnabled() {
  if (typeof window === 'undefined' || !backend || !key) return false;
  // Local test mode cannot send anything to the real backend; previews are off.
  const localFixture = import.meta.env.DEV && import.meta.env.VITE_MONITORING_TEST === '1'
    && backend === `${window.location.origin}/supabase-mock`;
  return localFixture || (import.meta.env.PROD && window.location.hostname === 'nomeubairro.vercel.app');
}

function currentPath() { return canonicalProductionPath(window.location.hash || window.location.pathname); }
function release() {
  const source = Array.from(document.scripts).find(script => /\/assets\/index-[\w-]+\.js/.test(script.src))?.src;
  return source?.match(/\/assets\/(index-[\w-]+\.js)/)?.[1] || null;
}

export async function reportProductionEvent(event: ProductionEvent) {
  if (!isProductionMonitoringEnabled() || navigator.onLine === false || !monitoringCodes.includes(event.code)) return;
  const path = canonicalProductionPath(event.path || currentPath());
  const target = safeProductionTarget(event.target);
  const status = Number.isInteger(event.statusCode) ? event.statusCode : null;
  if (!allowReport([event.eventType, path, target, status, event.code].join('|'), Date.now())) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3_000);
  try {
    await nativeFetch(`${backend}/rest/v1/rpc/log_production_event`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
      signal: controller.signal, keepalive: true, credentials: 'omit',
      body: JSON.stringify({
        p_event_type: event.eventType, p_path: path, p_target: target, p_message: event.code,
        p_duration_ms: Number.isFinite(event.durationMs) ? Math.min(120_000, Math.max(0, Math.round(event.durationMs!))) : null,
        p_status_code: status,
        p_device_class: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
        p_release: release(),
      }),
    });
  } catch { /* telemetry is best-effort: no retry, no recursion, no UI failure */ }
  finally { window.clearTimeout(timeout); }
}

export const monitoredFetch: typeof fetch = async (input, init) => {
  if (!isProductionMonitoringEnabled()) return nativeFetch(input, init);
  const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
  const target = productionApiTarget(rawUrl, backend, window.location.origin);
  if (!target) return nativeFetch(input, init);
  const rawMethod = init?.method || (input instanceof Request ? input.method : 'GET');
  const method = rawMethod.toUpperCase();
  const path = currentPath(); // A request may finish after the user changes pages.
  const startedAt = performance.now();
  try {
    const response = await nativeFetch(input, init);
    const durationMs = performance.now() - startedAt;
    if (isIncidentStatus(response.status)) {
      void reportProductionEvent({ eventType: 'api_error', code: 'api.http', target, path, statusCode: response.status, durationMs });
    } else if (response.ok && durationMs >= slowApiThreshold(target, method)) {
      void reportProductionEvent({ eventType: 'api_slow', code: 'api.slow', target, path, statusCode: response.status, durationMs });
    }
    return response; // Original body/headers and errors are never consumed or changed.
  } catch (error) {
    const signal = init?.signal || (input instanceof Request ? input.signal : null);
    if (!signal?.aborted && !(error instanceof Error && error.name === 'AbortError')) {
      void reportProductionEvent({ eventType: 'api_error', code: 'api.network', target, path, durationMs: performance.now() - startedAt });
    }
    throw error;
  }
};

export function reportRenderFailure(error: unknown, path?: string) {
  void reportProductionEvent({
    eventType: 'render_error', code: classifyProductionError(error), path,
    target: safeAssetTarget(error instanceof Error ? error.stack || '' : ''),
  });
}

export function startProductionMonitoring() {
  if (started || !isProductionMonitoringEnabled()) return;
  started = true;
  const initialPath = currentPath();
  const routes = [{ at: 0, path: initialPath }];
  window.addEventListener('hashchange', () => {
    routes.push({ at: performance.now(), path: currentPath() });
    if (routes.length > 100) routes.splice(1, 1);
  });
  window.addEventListener('error', event => {
    if (event.target instanceof Element) {
      const tag = event.target.tagName;
      if (tag !== 'SCRIPT' && tag !== 'LINK') return; // Broken user photos are not application crashes.
      const source = event.target.getAttribute(tag === 'SCRIPT' ? 'src' : 'href');
      try {
        if (!source || new URL(source, location.origin).origin !== location.origin) return;
      } catch { return; }
      void reportProductionEvent({ eventType: 'resource_error', code: tag === 'SCRIPT' ? 'resource.script' : 'resource.style', target: tag === 'SCRIPT' ? 'asset/script' : 'asset/link' });
      return;
    }
    if (!(event instanceof ErrorEvent) || /(?:chrome|moz|safari)-extension:/.test(event.filename || event.error?.stack || '')) return;
    void reportProductionEvent({ eventType: 'client_error', code: classifyProductionError(event.error || event.message), target: safeAssetTarget(event.filename, event.lineno, event.colno) });
  }, true);
  window.addEventListener('unhandledrejection', event => {
    if (event.reason instanceof Error && (event.reason.name === 'AbortError' || /(?:chrome|moz|safari)-extension:/.test(event.reason.stack || ''))) return;
    void reportProductionEvent({ eventType: 'client_error', code: classifyProductionError(event.reason), target: safeAssetTarget(event.reason instanceof Error ? event.reason.stack || '' : '') });
  });

  const measure = () => {
    window.setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navigation && navigation.duration > 4_000) {
        void reportProductionEvent({ eventType: 'page_slow', code: 'page.navigation', path: initialPath, target: 'navigation', durationMs: navigation.duration });
      }
    }, 0);
    // Small, lazy-loaded standard build: no DOM selectors, form contents or attribution payloads.
    void import('web-vitals').then(({ onLCP, onINP }) => {
      onLCP(metric => {
        if (metric.value > 2_500) void reportProductionEvent({ eventType: 'page_slow', code: 'page.lcp', path: initialPath, target: 'lcp', durationMs: metric.value });
      });
      onINP(metric => {
        if (metric.value <= 500) return;
        const at = metric.entries[0]?.startTime ?? 0;
        const route = [...routes].reverse().find(entry => entry.at <= at)?.path || initialPath;
        void reportProductionEvent({ eventType: 'page_slow', code: 'page.inp', path: route, target: 'inp', durationMs: metric.value });
      });
    }).catch(() => { /* optional performance APIs must not break older browsers */ });
  };
  if (document.readyState === 'complete') measure();
  else window.addEventListener('load', measure, { once: true });
}
