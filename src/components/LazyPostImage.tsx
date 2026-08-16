import { useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';

const imageCache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

async function fetchPostImage(postId: string) {
  if (imageCache.has(postId)) return imageCache.get(postId) ?? null;
  const existing = pending.get(postId);
  if (existing) return existing;

  const request = supabase
    .from('posts')
    .select('image_url')
    .eq('id', postId)
    .maybeSingle()
    .then(({ data, error }) => {
      const value = error ? null : (data?.image_url || null);
      imageCache.set(postId, value);
      pending.delete(postId);
      return value;
    });
  pending.set(postId, request);
  return request;
}

export async function getPostImage(postId: string) {
  return fetchPostImage(postId);
}

export default function LazyPostImage({ postId, alt = '', onOpen }: { postId: string; alt?: string; onOpen?: (src: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => imageCache.get(postId) ?? null);
  const [shouldLoad, setShouldLoad] = useState(() => imageCache.has(postId));

  useEffect(() => {
    if (shouldLoad) return;
    const element = hostRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: '350px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return;
    let active = true;
    void fetchPostImage(postId).then((value) => { if (active) setSrc(value); });
    return () => { active = false; };
  }, [postId, shouldLoad]);

  return (
    <div ref={hostRef} className={src ? 'mt-3' : ''}>
      {src && (
        <button type="button" onClick={() => onOpen?.(src)} className="block w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-zoom-in hover:opacity-90 transition-opacity text-left">
          <img src={src} alt={alt} className="w-full max-h-72 object-cover" loading="lazy" decoding="async" />
        </button>
      )}
    </div>
  );
}
