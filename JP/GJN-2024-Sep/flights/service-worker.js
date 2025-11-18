/* eslint-disable no-restricted-globals */
const VERSION = 'v2024-09-flights-01';
const CACHE_NAME = `gjn-2024-flights-${VERSION}`;

const BASE = '/JP/GJN-2024-Sep/flights';

const APP_SHELL = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/assets/manifest.json`,
  `${BASE}/assets/icons/icon-192x192.png`,
  `${BASE}/assets/icons/icon-512x512.png`,
  `${BASE}/offline.html`,
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('gjn-2024-flights-') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(`${BASE}/index.html`, response.clone());
        return response;
      } catch {
        return (await caches.match(`${BASE}/index.html`)) ||
               (await caches.match(`${BASE}/offline.html`));
      }
    })());
    return;
  }

  // Same-origin requests → stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => null);
      return cached || networkFetch || fetch(request);
    })());
    return;
  }

  // External fetch fallback
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

