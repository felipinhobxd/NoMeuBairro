type DraftEnvelope<T> = {
  value: T;
  updatedAt: string;
};

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function readLocalDraft<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    const timestamp = new Date(parsed.updatedAt).getTime();
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
}

export function saveLocalDraft<T>(key: string, value: T) {
  if (!key || typeof window === 'undefined') return false;
  try {
    const envelope: DraftEnvelope<T> = { value, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalDraft(key: string) {
  if (!key || typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch {}
}
