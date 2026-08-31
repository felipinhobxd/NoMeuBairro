import { waitUntil } from '@vercel/functions';

const recent = new Map();
const routes = new Set(['/api/share-post', '/api/post-image', '/api/health']);

export async function reportServerIncident(route, status, durationMs, { env = process.env, fetcher = globalThis.fetch } = {}) {
  // The probe must not generate incidents about itself: that would prevent recovery.
  if (!routes.has(route) || route === '/api/health' || env.VERCEL_ENV !== 'production') return;
  const isError = status >= 500 || status === 408 || status === 429;
  if (!isError && !(status >= 200 && status < 400 && durationMs >= 4000)) return;
  const backend = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!backend || !key) return;
  const fingerprint = `${route}:${status}:${isError}`;
  const now = Date.now();
  for (const [item, at] of recent) if (now - at >= 60_000) recent.delete(item);
  if (recent.has(fingerprint) || recent.size >= 20) return;
  recent.set(fingerprint, now);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    await fetcher(`${backend}/rest/v1/rpc/log_production_event`, {
      method: 'POST', signal: controller.signal,
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_event_type: isError ? 'api_error' : 'api_slow', p_path: '/', p_target: route,
        p_message: isError ? 'api.http' : 'api.slow', p_status_code: status,
        p_duration_ms: Math.min(120000, Math.max(0, Math.round(durationMs))),
        p_release: /^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || '') ? env.VERCEL_GIT_COMMIT_SHA.slice(0, 12) : null,
      }),
    });
  } catch { /* Reporting cannot change or delay the application's response. */ }
  finally { clearTimeout(timeout); }
}

export function createRequestLogger({ log = console.log, clock = Date.now, report = reportServerIncident, wait = waitUntil } = {}) {
  return (req, res, route) => {
    if (!routes.has(route)) throw new Error('unsupported_log_route');
    const startedAt = clock();
    const platformId = req.headers?.['x-vercel-id'];
    const requestId = typeof platformId === 'string' && /^[a-zA-Z0-9:._-]{1,120}$/.test(platformId) ? platformId : undefined;
    const method = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method) ? req.method : 'OTHER';
    log(JSON.stringify({ level: 'info', event: 'request.start', route, method, requestId }));
    res.once?.('finish', () => {
      const durationMs = Math.max(0, clock() - startedAt);
      const status = Number.isInteger(res.statusCode) ? res.statusCode : 500;
      log(JSON.stringify({ level: status >= 500 ? 'error' : durationMs >= 4000 ? 'warning' : 'info', event: 'request.done', route, method, requestId, status, durationMs }));
      // Pass a Promise, not a callback; Vercel keeps the invocation alive for it.
      wait(Promise.resolve().then(() => report(route, status, durationMs)).catch(() => {}));
    });
  };
}

const logRequest = createRequestLogger();
export function startRequestLog(req, res, route) {
  if (process.env.VERCEL === '1') logRequest(req, res, route);
}
