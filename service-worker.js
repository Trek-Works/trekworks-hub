// =====================================================
// TrekWorks Hub Service Worker
// Scope: /
// Purpose: Ensure Trip Hub is available with no data
// =====================================================

const CACHE_VERSION = "trekworks-hub-2026-02";
const CACHE_NAME = `trekworks-hub-${CACHE_VERSION}`;

// -----------------------------------------------------
// Core Hub assets (minimal and deterministic)
// -----------------------------------------------------
const CORE_ASSETS = [
  "/",            // Hub root
  "/index.html"
];

// -----------------------------------------------------
// Install — resilient precache Hub shell
// -----------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          const req = new Request(asset, { cache: "reload" });
          const res = await fetch(req);

          if (!res || !res.ok) {
            throw new Error(`Precache failed: ${asset} (${res && res.status})`);
          }

          await cache.put(req, res);
        })
      );
    })()
  );

  self.skipWaiting();
});

// -----------------------------------------------------
// Activate — clean old Hub caches only
// -----------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("trekworks-hub-") && key !== CACHE_NAME)
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
    const response = await fetch(request);

    if (response && response.ok) {
      cache.put(request, response.clone());
      return response;
    }
  } catch {
    // ignore network failure
  }

  const cached = await cache.match(request);
  if (cached) return cached;

  return cache.match("/index.html");
}
