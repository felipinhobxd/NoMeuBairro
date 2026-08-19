const CACHE_VERSION = 'v6';
const CACHE_PREFIX = 'nmb-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}images-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE]);
const IMAGE_CACHE_MAX_ENTRIES = 48;
const IMAGE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_TIME_HEADER = 'x-nmb-sw-cache-time';
const SHELL = ['/', '/logo.png', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function putInCache(cacheName, request, response, { timestamp = false, maxEntries, maxAgeMs } = {}) {
  if (!response?.ok || response.type === 'opaque') return;
  const cache = await caches.open(cacheName);
  let cacheResponse = response.clone();

  if (timestamp) {
    const headers = new Headers(cacheResponse.headers);
    headers.set(CACHE_TIME_HEADER, String(Date.now()));
    cacheResponse = new Response(await cacheResponse.blob(), {
      status: cacheResponse.status,
      statusText: cacheResponse.statusText,
      headers,
    });
  }

  await cache.put(request, cacheResponse);

  if (maxAgeMs) {
    const keys = await cache.keys();
    const expiredKeys = (await Promise.all(keys.map(async (key) => {
      const cached = await cache.match(key);
      return cached && !isFresh(cached, maxAgeMs) ? key : null;
    }))).filter(Boolean);
    await Promise.all(expiredKeys.map((key) => cache.delete(key)));
  }

  if (maxEntries) {
    const keys = await cache.keys();
    const excess = keys.length - maxEntries;
    if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
  }
}

function isFresh(response, maxAgeMs) {
  const cachedAt = Number(response?.headers.get(CACHE_TIME_HEADER) || 0);
  return cachedAt > 0 && Date.now() - cachedAt <= maxAgeMs;
}

async function networkFirst(request, { cacheName = STATIC_CACHE, fallbackPath, image = false } = {}) {
  try {
    const response = await fetch(request);
    try {
      await putInCache(cacheName, request.mode === 'navigate' ? '/' : request, response, image
        ? { timestamp: true, maxEntries: IMAGE_CACHE_MAX_ENTRIES, maxAgeMs: IMAGE_CACHE_MAX_AGE_MS }
        : undefined);
    } catch {}
    return response;
  } catch {
    return (await caches.match(request))
      || (fallbackPath ? await caches.match(fallbackPath) : null)
      || Response.error();
  }
}

async function cachedImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached && isFresh(cached, IMAGE_CACHE_MAX_AGE_MS)) return cached;

  try {
    const response = await fetch(request);
    try { await putInCache(IMAGE_CACHE, request, response, { timestamp: true, maxEntries: IMAGE_CACHE_MAX_ENTRIES, maxAgeMs: IMAGE_CACHE_MAX_AGE_MS }); } catch {}
    return response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Rotas dinâmicas de compartilhamento e APIs precisam sempre chegar à
    // Vercel. Nunca salve o HTML de uma prévia social como a shell do PWA.
    if (url.pathname.startsWith('/relato/') || url.pathname.startsWith('/post/') || url.pathname.startsWith('/api/')) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(networkFirst(request, { cacheName: SHELL_CACHE, fallbackPath: '/' }));
    return;
  }

  // Imagens de relatos são dinâmicas: consulte a rede primeiro e mantenha
  // somente um fallback offline limitado, evitando mídia antiga ou cache infinito.
  if (url.pathname.startsWith('/api/post-image')) {
    event.respondWith(networkFirst(request, { cacheName: IMAGE_CACHE, image: true }));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request, { cacheName: STATIC_CACHE }));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cachedImage(request));
    return;
  }

  if (request.destination === 'font') {
    event.respondWith(caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      try { await putInCache(STATIC_CACHE, request, response); } catch {}
      return response;
    }));
    return;
  }

  if (url.pathname.endsWith('.webmanifest')) {
    event.respondWith(networkFirst(request, { cacheName: SHELL_CACHE }));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'No Meu Bairro';
  const body = [payload.body, payload.context].filter(Boolean).join(' · ');
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'nmb-activity',
    renotify: false,
    data: {
      url: payload.url || '/notificacoes',
      notificationId: payload.notificationId || null,
    },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/notificacoes';
  const targetUrl = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) {
        try { await client.navigate(targetUrl); } catch {}
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
