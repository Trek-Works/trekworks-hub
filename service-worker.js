// =====================================================
// TrekWorks Hub Service Worker
// Scope: /
// Purpose: Ensure Trip Hub is available with no data
// =====================================================

const CACHE_VERSION = "trekworks-hub-2025-01";
const CACHE_NAME = `trekworks-hub-${CACHE_VERSION}`;

// -----------------------------------------------------
// Core Hub assets (keep small and deterministic)
// -----------------------------------------------------
const CORE_ASSETS = [
  "/",            // Hub root
  "/index.html",
  "/trips.json"
];

// -----------------------------------------------------
// Install — precache Hub shell
// -----------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// -----------------------------------------------------
// Activate — clean up old Hub caches only
// -----------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("trekworks-hub-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// -----------------------------------------------------
// Fetch — navigation handling (Hub only)
// -----------------------------------------------------
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  const url = new URL(event.request.url);

  // Never interfere with trip scopes
  if (
    url.pathname.startsWith("/JP/") ||
    url.pathname.startsWith("/KR/") ||
    url.pathname.startsWith("/TH/")
  ) {
    return;
  }

  event.respondWith(handleHubNavigation(event.request));
});

// -----------------------------------------------------
// Navigation strategy
// -----------------------------------------------------
async function handleHubNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Network-first when available
    const response = await fetch(request);

    if (response && response.ok) {
      cache.put(request, response.clone());
      return response;
    }
  } catch {
    // Ignore network failure
  }

  // Cache fallback
  const cached = await cache.match(request);
  if (cached) return cached;

  // Final fallback — Hub root
  return cache.match("/index.html");
}
