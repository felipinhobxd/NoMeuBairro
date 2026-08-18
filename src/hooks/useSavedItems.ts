import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/UI';
import { supabase } from '../utils/supabase';

type SavedKind = 'post' | 'event' | 'job';

const savedColumns: Record<SavedKind, 'post_id' | 'event_id' | 'job_id'> = {
  post: 'post_id',
  event: 'event_id',
  job: 'job_id',
};

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
    setLoading(true);
    void supabase.from('saved_items').select(column).eq('user_id', user.id).not(column, 'is', null).then(({ data, error }) => {
      if (!active) return;
      if (error) console.warn('Não foi possível carregar itens salvos:', error);
      const ids = new Set<string>();
      for (const row of data || []) {
        const id = (row as any)[column];
        if (id) ids.add(String(id));
      }
      setSavedIds(ids);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, column]);

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
    setSavedIds(prev => {
      const next = new Set(prev);
      currentlySaved ? next.delete(itemId) : next.add(itemId);
      return next;
    });
    toast(currentlySaved ? 'Removido dos salvos.' : 'Salvo para ver depois!');
    return true;
  }, [user?.id, savedIds, column, toast, navigate]);

  return {
    savedIds,
    loading,
    isSaved: (itemId: string) => savedIds.has(itemId),
    toggleSaved,
  };
}
