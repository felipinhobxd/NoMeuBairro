export type ProductionEventType = 'client_error' | 'render_error' | 'resource_error' | 'api_error' | 'api_slow' | 'page_slow';

export const monitoringCodes = [
  'js.type_error', 'js.reference_error', 'js.syntax_error', 'js.range_error', 'js.error',
  'resource.chunk', 'resource.script', 'resource.style', 'resource.service_worker',
  'api.http', 'api.network', 'api.slow', 'page.lcp', 'page.inp', 'page.navigation',
] as const;
export type MonitoringCode = typeof monitoringCodes[number];

const routes = new Set(['/', '/mapa', '/estatisticas', '/empregos', '/mural', '/denuncias', '/perfil', '/perfil/:id', '/post/:id', '/empresa', '/empresa/:id', '/notificacoes', '/salvos', '/admin', '/privacidade', '/termos', '/login']);

export function canonicalProductionPath(value = '/') {
  const path = value.replace(/^#/, '').split(/[?#]/)[0] || '/';
  if (/^\/(post|relato)\//.test(path)) return '/post/:id';
  if (/^\/perfil\//.test(path)) return '/perfil/:id';
  if (/^\/empresa\//.test(path)) return '/empresa/:id';
  return routes.has(path) ? path : '/';
}

// Never transmit an arbitrary error message: even a normal TypeError can contain
// a person's name, a password, a form value, or an authenticated URL.
export function classifyProductionError(error: unknown): MonitoringCode {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/dynamically imported module|module script|chunkloaderror|loading chunk/i.test(message)) return 'resource.chunk';
  if (name === 'TypeError') return 'js.type_error';
  if (name === 'ReferenceError') return 'js.reference_error';
  if (name === 'SyntaxError') return 'js.syntax_error';
  if (name === 'RangeError') return 'js.range_error';
  return 'js.error';
}

export function safeAssetTarget(value: string, line = 0, column = 0) {
  const match = value.match(/\/assets\/([A-Za-z][A-Za-z0-9_-]{0,60}-[A-Za-z0-9_-]{6,20}\.js)(?::(\d+):(\d+))?/);
  if (!match) return 'app';
  const safeLine = Math.min(1_000_000, Math.max(0, Math.floor(Number(match[2]) || line || 0)));
  const safeColumn = Math.min(1_000_000, Math.max(0, Math.floor(Number(match[3]) || column || 0)));
  return `asset/${match[1]}:${safeLine}:${safeColumn}`;
}

export function safeProductionTarget(value: string | null | undefined) {
  const target = String(value || 'app');
  if (/^(?:app|lcp|inp|navigation|service-worker|asset\/(?:script|link|chunk)|\/external\/(?:viacep|nominatim))$/.test(target)) return target;
  if (/^asset\/[A-Za-z][A-Za-z0-9_-]{0,60}-[A-Za-z0-9_-]{6,20}\.js:\d{1,7}:\d{1,7}$/.test(target)) return target;
  if (/^\/rest\/v1\/(?:rpc\/)?[a-z_]{1,64}$/.test(target)) return target;
  if (/^\/functions\/v1\/[a-z-]{1,64}$/.test(target)) return target;
  if (/^\/auth\/v1\/[a-z_]{1,32}$/.test(target)) return target;
  if (/^\/storage\/v1\/(?:object|render|upload|other)$/.test(target)) return target;
  if (/^\/api\/(?:share-post|post-image|health)$/.test(target)) return target;
  return 'app';
}

export function productionApiTarget(rawUrl: string, supabaseUrl: string, origin: string) {
  try {
    const url = new URL(rawUrl, origin);
    const backend = new URL(supabaseUrl);
    if (url.origin === backend.origin && url.pathname.startsWith(`${backend.pathname.replace(/\/$/, '')}/`)) {
      const path = url.pathname.slice(backend.pathname.replace(/\/$/, '').length);
      // Reporting, analytics, and the monitor itself must never report recursively.
      if (/^\/rest\/v1\/rpc\/(?:log_|get_production_|test_production_|resolve_production_|track_page_view)/.test(path)) return null;
      const parts = path.split('/').filter(Boolean);
      let target = '';
      if (parts[0] === 'rest' && parts[1] === 'v1') target = parts[2] === 'rpc' ? `/rest/v1/rpc/${parts[3]}` : `/rest/v1/${parts[2]}`;
      if (parts[0] === 'functions' && parts[1] === 'v1') target = `/functions/v1/${parts[2]}`;
      if (parts[0] === 'auth' && parts[1] === 'v1') target = `/auth/v1/${parts[2]}`;
      if (parts[0] === 'storage' && parts[1] === 'v1') target = `/storage/v1/${['object', 'render', 'upload'].includes(parts[2]) ? parts[2] : 'other'}`;
      const clean = safeProductionTarget(target);
      return clean === 'app' ? null : clean;
    }
    if (url.origin === origin && /^\/api\/(share-post|post-image)$/.test(url.pathname)) return url.pathname;
    if (url.hostname === 'viacep.com.br') return '/external/viacep';
    if (url.hostname === 'nominatim.openstreetmap.org') return '/external/nominatim';
  } catch { /* malformed or unrelated request */ }
  return null;
}

export function slowApiThreshold(target: string, method: string) {
  if (target.startsWith('/storage/') || method !== 'GET') return 12_000;
  return target.startsWith('/functions/') ? 8_000 : 4_000;
}

export function isIncidentStatus(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

export function createReportBudget() {
  const recent = new Map<string, number>();
  let windowStart = 0;
  let sent = 0;
  return (fingerprint: string, now: number) => {
    if (now - windowStart >= 60_000) { windowStart = now; sent = 0; }
    if (sent >= 20 || (recent.has(fingerprint) && now - recent.get(fingerprint)! < 60_000)) return false;
    for (const [key, timestamp] of recent) if (now - timestamp >= 60_000) recent.delete(key);
    recent.set(fingerprint, now);
    sent++;
    return true;
  };
}
