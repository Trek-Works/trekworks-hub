const CACHE_NAME = "gjn-jp-2024-sep-shell-v1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./assets/icons/icon-192x192.png",
  "./assets/icons/icon-512x512.png"
];

// Install: cache shell assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// Fetch: cache-first for shell, fall back to offline page on failure
self.addEventListener("fetch", event => {
  const { request } = event;

  // Only handle GET
  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).catch(() => {
        // For navigation requests, return offline shell
        if (request.mode === "navigate") {
          return caches.match("./offline.html");
        }
        return caches.match("./offline.html");
      });
    })
  );
});
