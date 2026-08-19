import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/UI';
import { supabase } from '../utils/supabase';
import { readSessionQueryCache, writeSessionQueryCache } from '../utils/sessionQueryCache';

type SavedKind = 'post' | 'event' | 'job';

const savedColumns: Record<SavedKind, 'post_id' | 'event_id' | 'job_id'> = {
  post: 'post_id',
  event: 'event_id',
  job: 'job_id',
};

type SavedSnapshot = Record<SavedKind, string[]>;
type SavedItemsUpdate = { userId: string; snapshot: SavedSnapshot };

const SAVED_ITEMS_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const SAVED_ITEMS_UPDATED_EVENT = 'nmb-saved-items-updated';
const savedItemsInFlight = new Map<string, Promise<SavedSnapshot>>();

function emptySavedSnapshot(): SavedSnapshot {
  return { post: [], event: [], job: [] };
}

function savedItemsCacheKey(userId: string) {
  return `nmb-query-cache:saved-items:v1:${userId}`;
}

function isSavedSnapshot(value: unknown): value is SavedSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedSnapshot>;
  return Array.isArray(candidate.post) && Array.isArray(candidate.event) && Array.isArray(candidate.job);
}

function snapshotFromRows(rows: Array<Record<string, unknown>>): SavedSnapshot {
  const snapshot = emptySavedSnapshot();
  for (const row of rows) {
    for (const [kind, column] of Object.entries(savedColumns) as Array<[SavedKind, typeof savedColumns[SavedKind]]>) {
      const id = row[column];
      if (id) snapshot[kind].push(String(id));
    }
  }
  return snapshot;
}

async function loadSavedSnapshot(userId: string) {
  const key = savedItemsCacheKey(userId);
  const cached = readSessionQueryCache<SavedSnapshot>(key, SAVED_ITEMS_CACHE_MAX_AGE_MS);
  if (cached?.fresh && isSavedSnapshot(cached.data)) return cached.data;

  const pending = savedItemsInFlight.get(userId);
  if (pending) return pending;

  const request = (async () => {
    const { data, error } = await supabase
      .from('saved_items')
      .select('post_id,event_id,job_id')
      .eq('user_id', userId);
    if (error) {
      if (cached && isSavedSnapshot(cached.data)) return cached.data;
      throw error;
    }
    const snapshot = snapshotFromRows((data || []) as Array<Record<string, unknown>>);
    writeSessionQueryCache(key, snapshot);
    return snapshot;
  })().finally(() => savedItemsInFlight.delete(userId));

  savedItemsInFlight.set(userId, request);
  return request;
}

function updateSavedSnapshot(userId: string, kind: SavedKind, itemId: string, saved: boolean) {
  const key = savedItemsCacheKey(userId);
  const cached = readSessionQueryCache<SavedSnapshot>(key, Number.MAX_SAFE_INTEGER);
  const current = cached && isSavedSnapshot(cached.data) ? cached.data : emptySavedSnapshot();
  const ids = new Set(current[kind]);
  saved ? ids.add(itemId) : ids.delete(itemId);
  const snapshot = { ...current, [kind]: [...ids] };
  writeSessionQueryCache(key, snapshot);
  window.dispatchEvent(new CustomEvent<SavedItemsUpdate>(SAVED_ITEMS_UPDATED_EVENT, {
    detail: { userId, snapshot },
  }));
}

export function useSavedItems(kind: SavedKind) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const column = savedColumns[kind];

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setSavedIds(new Set());
      return () => { active = false; };
    }

    const userId = user.id;
    const syncSnapshot = (snapshot: SavedSnapshot) => {
      if (active) setSavedIds(new Set(snapshot[kind]));
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<SavedItemsUpdate>).detail;
      if (detail?.userId === userId && isSavedSnapshot(detail.snapshot)) syncSnapshot(detail.snapshot);
    };
    window.addEventListener(SAVED_ITEMS_UPDATED_EVENT, handleUpdate);
    setLoading(true);
    void loadSavedSnapshot(userId)
      .then(syncSnapshot)
      .catch((error) => console.warn('Não foi possível carregar itens salvos:', error))
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      window.removeEventListener(SAVED_ITEMS_UPDATED_EVENT, handleUpdate);
    };
  }, [user?.id, kind]);

  const toggleSaved = useCallback(async (itemId: string) => {
    if (!user?.id) {
      toast('Entre ou crie uma conta para salvar itens.', 'info');
      navigate('/login');
      return false;
    }
    const currentlySaved = savedIds.has(itemId);
    const result = currentlySaved
      ? await supabase.from('saved_items').delete().eq('user_id', user.id).eq(column, itemId)
      : await supabase.from('saved_items').insert({ user_id: user.id, [column]: itemId });
    if (result.error) {
      toast(result.error.message || 'Não foi possível atualizar seus itens salvos.', 'error');
      return false;
    }
    updateSavedSnapshot(user.id, kind, itemId, !currentlySaved);
    setSavedIds(prev => {
      const next = new Set(prev);
      currentlySaved ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    toast(currentlySaved ? 'Removido dos salvos.' : 'Salvo para ver depois!');
    return true;
  }, [user?.id, savedIds, column, kind, toast, navigate]);

  return {
    savedIds,
    loading,
    isSaved: (itemId: string) => savedIds.has(itemId),
    toggleSaved,
  };
}
