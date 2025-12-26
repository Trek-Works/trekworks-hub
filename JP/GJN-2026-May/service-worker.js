// ===============================
// JP GJN-2026-May – Service Worker
// Strategy:
//   • Network-first for HTML navigations
//   • Cache-first for static assets
//   • Deterministic offline behaviour
//   • Explicit pre-cache for all trip elements
// ===============================

// 🔁 BUMP VERSION ON DEPLOY
const CACHE_VERSION = "tw-gjn-jp-2026-may-v3";
const CACHE_NAME = `trekworks-cache-${CACHE_VERSION}`;

// ===============================
// Core assets (pre-cached)
// ===============================
const CORE_ASSETS = [
  // Root + shell
  "./",
  "./index.html",
  "./offline.html",
  "./external.html",

  // Trip elements (FULL, EXPLICIT)
  "./accommodation.html",
  "./activities.html",
  "./airport-limousine-bus.html",
  "./flights.html",
  "./guides.html",
  "./maps.html",
  "./shopping.html",
  "./task-list.html",
  "./trains.html",
  "./travel-packing-guide.html",

  // PWA metadata
  "./manifest.json",

  // Icons
  "./assets/icons/icon-192x192.png",
  "./assets/icons/icon-512x512.png"
];

// ===============================
// Install – cache core shell
// ===============================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );

  self.skipWaiting();
});

// ===============================
// Activate – clean old caches
// ===============================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("trekworks-cache-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// ===============================
// Fetch handling
// ===============================
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Same-origin only
  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML navigations – network first
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Assets – cache first
  event.respondWith(handleAssetRequest(request));
});

// ===============================
// Navigation handler
// ===============================
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);

    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());

    return networkResponse;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);

    const cached = await cache.match(request);
    if (cached) return cached;

    const indexFallback = await cache.match("./index.html");
    if (indexFallback) return indexFallback;

    const offlineFallback = await cache.match("./offline.html");
    if (offlineFallback) return offlineFallback;

    throw error;
  }
}

// ===============================
// Asset handler
// ===============================
async function handleAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached = await cache.match(request);
  if (cached) return cached;

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.status === 200) {
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}
