const CACHE_VERSION = 1;

type CacheEnvelope<T> = {
  version: number;
  storedAt: number;
  data: T;
};

export type SessionQueryCacheHit<T> = {
  data: T;
  ageMs: number;
  fresh: boolean;
};

export function readSessionQueryCache<T>(key: string, maxAgeMs: number): SessionQueryCacheHit<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CACHE_VERSION || !Number.isFinite(parsed.storedAt) || !('data' in parsed)) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    const ageMs = Math.max(0, Date.now() - parsed.storedAt);
    return { data: parsed.data, ageMs, fresh: ageMs <= maxAgeMs };
  } catch {
    return null;
  }
}

export function writeSessionQueryCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    const value: CacheEnvelope<T> = { version: CACHE_VERSION, storedAt: Date.now(), data };
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache is an optimization only; private mode and full storage must not block the app.
  }
}

export function clearSessionQueryCache(key: string) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(key); } catch {}
}

export function shouldRunSessionTask(key: string, minimumIntervalMs: number) {
  if (typeof window === 'undefined') return true;
  const now = Date.now();
  try {
    const previous = Number(window.sessionStorage.getItem(key) || '0');
    if (Number.isFinite(previous) && previous > 0 && now - previous < minimumIntervalMs) return false;
    window.sessionStorage.setItem(key, String(now));
  } catch {}
  return true;
}
