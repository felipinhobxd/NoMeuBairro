import { useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../utils/supabase';

const REPAIR_FLAG = 'nmb-location-repair-ippuc-v1';

export default function LocationRepairBridge() {
  const { fetchData } = useData();

  useEffect(() => {
    let active = true;
    try {
      if (localStorage.getItem(REPAIR_FLAG) === 'done') return;
    } catch {}

    void supabase.functions.invoke('anonymous-post-control', {
      body: { action: 'repair_missing_locations' },
    }).then(async ({ data, error }) => {
      if (!active || error || !data?.ok) return;
      try { localStorage.setItem(REPAIR_FLAG, 'done'); } catch {}
      if (Number(data.updated || 0) > 0) await fetchData();
    }).catch((error) => {
      console.warn('Backfill de localização adiado:', error);
    });

    return () => { active = false; };
  }, [fetchData]);

  return null;
}
