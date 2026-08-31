import { parseIncidentSnapshot, readLimitedText } from '../server/monitoringHealth.js';
import { startRequestLog } from '../server/structuredLog.js';

export function createHealthHandler({ fetcher = globalThis.fetch, env = process.env, timeoutMs = 5000, clock = Date.now } = {}) {
  return async (req, res) => {
    startRequestLog(req, res, '/api/health');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).end();
    }
    const startedAt = clock();
    const checks = { database: 'unavailable', telemetry: 'unavailable' };
    let snapshot = null;
    const backend = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (backend && key) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const headers = { apikey: key, 'Content-Type': 'application/json' };
        await Promise.all([
          (async () => {
            const response = await fetcher(`${backend}/rest/v1/posts?select=id&limit=1`, { headers, signal: controller.signal });
            if (!response.ok) return;
            const rows = JSON.parse(await readLimitedText(response, 2048));
            if (Array.isArray(rows) && rows.length <= 1) checks.database = 'ok';
          })(),
          (async () => {
            const response = await fetcher(`${backend}/rest/v1/rpc/get_production_health`, { method: 'POST', headers, body: '{}', signal: controller.signal });
            if (!response.ok) return;
            snapshot = parseIncidentSnapshot(JSON.parse(await readLimitedText(response, 2048)));
            if (snapshot) checks.telemetry = 'ok';
          })(),
        ]);
      } catch { /* Only fixed status codes are public, never upstream response bodies. */ }
      finally { clearTimeout(timer); controller.abort(); }
    }
    const durationMs = Math.max(0, clock() - startedAt);
    const available = checks.database === 'ok' && checks.telemetry === 'ok';
    const body = {
      service: 'NoMeuBairro', schemaVersion: 2,
      status: !available ? 'unavailable' : durationMs >= 3000 || snapshot.openIncidents > 0 ? 'degraded' : 'ok',
      checks, durationMs, checkedAt: new Date().toISOString(),
      release: /^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || '') ? env.VERCEL_GIT_COMMIT_SHA.slice(0, 12) : null,
      monitoring: snapshot,
    };
    res.status(available ? 200 : 503);
    if (req.method === 'HEAD') return res.end();
    return res.json(body);
  };
}

export default function handler(req, res) { return createHealthHandler()(req, res); }
