import { useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../utils/supabase';

let channelSequence = 0;

/** Watch only rendered posts; existing DB triggers emit UPDATE on insert/delete
 * of comments, including cascaded replies. No comment content is subscribed to. */
export function useFeedCommentCounts(postIds: string[]) {
  const { refreshCommentCounts } = useData();
  const idsKey = [...new Set(postIds)].sort().join(',');

  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(',');
    const watched = new Set(ids);
    const dirty = new Set<string>();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fallback: ReturnType<typeof setInterval> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let lastRefresh = 0;

    const schedule = (changed: string[]) => {
      for (const id of changed) if (watched.has(id)) dirty.add(id);
      if (timer || stopped || document.visibilityState === 'hidden') return;
      timer = setTimeout(() => {
        timer = undefined;
        if (stopped || document.visibilityState === 'hidden' || !navigator.onLine) return;
        const batch = [...dirty];
        dirty.clear();
        lastRefresh = Date.now();
        void refreshCommentCounts(batch);
      }, 180);
    };

    const disconnect = () => {
      if (timer) clearTimeout(timer);
      if (fallback) clearInterval(fallback);
      timer = undefined;
      fallback = undefined;
      const previous = channel;
      channel = undefined;
      if (previous) void supabase.removeChannel(previous);
    };

    const connect = () => {
      if (stopped || channel || document.visibilityState === 'hidden' || !navigator.onLine) return;
      const next = supabase.channel(`feed-comment-counts-${++channelSequence}`);
      channel = next;
      // Realtime's IN filter accepts at most 100 IDs per binding.
      for (let offset = 0; offset < ids.length; offset += 100) {
        next.on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'posts',
          filter: `id=in.(${ids.slice(offset, offset + 100).join(',')})`,
        }, payload => {
          const id = payload.new?.id;
          if (typeof id === 'string' && watched.has(id)) schedule([id]);
        });
      }
      next.subscribe(status => {
        if (stopped || channel !== next) return;
        if (status === 'SUBSCRIBED') {
          if (fallback) clearInterval(fallback);
          fallback = undefined;
          schedule(ids); // Catch up on changes missed during reconnection.
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !fallback) {
          // Only while Realtime is unavailable; never poll the full feed.
          fallback = setInterval(() => schedule(ids), 60_000);
        }
      });
      schedule(ids); // Revalidate cached counts even if WebSocket is unavailable.
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') disconnect();
      else { connect(); schedule(ids); }
    };
    const onFocus = () => {
      connect();
      if (Date.now() - lastRefresh > 15_000) schedule(ids);
    };

    connect();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    window.addEventListener('offline', disconnect);
    return () => {
      stopped = true;
      disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      window.removeEventListener('offline', disconnect);
    };
  }, [idsKey, refreshCommentCounts]);
}
