const CACHE_NAME = "flights-2024-cache-v1";

const BASE_PATH = "/public-pwa/JP/GJN-2024-Sep/flights/";

const ASSETS = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}offline.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}assets/icons/icon-192.png`,
  `${BASE_PATH}assets/icons/icon-512.png`
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(
        res => res || caches.match(`${BASE_PATH}offline.html`)
      )
    )
  );
});
