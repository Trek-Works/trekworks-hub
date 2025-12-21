// ===============================
// JP GJN-2026-May – Service Worker
// Strategy:
//   • Network-first for HTML navigations (index.html)
//   • Cache-first for static assets (icons, images, etc.)
//   • Full offline fallback (offline.html)
//   • Versioned cache for reliable updates
// ===============================

// 🔁 BUMP THIS WHEN YOU DEPLOY A NEW VERSION
const CACHE_VERSION = "tw-gjn-jp-2026-may-v1";
const CACHE_NAME = `trekworks-cache-${CACHE_VERSION}`;

// Core shell assets – these are fetched on install.
// Adjust or add to this list as needed for this trip.
const CORE_ASSETS = [
  // HTML
  "./",
  "./index.html",
  "./offline.html",
  "./external.html",

  // PWA metadata
  "./manifest.json",

  // Icons (update paths if you change structure)
  "./assets/icons/icon-192x192.png",
  "./assets/icons/icon-512x512.png"
];

// ===============================
// Install – cache core shell
// ===============================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );

  // Activate new worker immediately (no "waiting" state)
  self.skipWaiting();
});

// ===============================
// Activate – clean up old caches
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

  // Become the active worker for all clients
  self.clients.claim();
});

// ===============================
// Fetch – routing logic
// ===============================
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle same-origin requests
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1) Network-first for navigations (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // 2) For everything else (icons, images, etc.), use cache-first
  event.respondWith(handleAssetRequest(request));
});

// ===============================
// Navigation handler – network-first
// ===============================
async function handleNavigationRequest(request) {
  try {
    // Try to fetch from the network first
    const networkResponse = await fetch(request);

    // Clone and cache the response for offline use
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());

    return networkResponse;
  } catch (error) {
    // If offline or network fails, fall back to cache
    const cache = await caches.open(CACHE_NAME);

    // Try the requested page from cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to index.html or offline.html
    const indexFallback = await cache.match("./index.html");
    if (indexFallback) {
      return indexFallback;
    }

    const offlineFallback = await cache.match("./offline.html");
    if (offlineFallback) {
      return offlineFallback;
    }

    throw error;
  }
}

// ===============================
// Asset handler – cache-first
// ===============================
async function handleAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  // Try cache first
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  // Fetch from network and cache it for next time
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    throw error;
  }
}
