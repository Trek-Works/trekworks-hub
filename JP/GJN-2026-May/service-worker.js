// =====================================================
// TrekWorks Trip Mode (TTM) Service Worker
// Trip: JP / GJN-2026-May
// Scope: /JP/GJN-2026-May/
// =====================================================

const CACHE_VERSION = "tw-jp-gjn-2026-may-2025-01-01";
const CACHE_NAME = `trekworks-${CACHE_VERSION}`;

// -----------------------------------------------------
// Trip Mode storage (IndexedDB)
// -----------------------------------------------------
const DB_NAME = "trekworks";
const DB_STORE = "settings";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getTripMode() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.get("tripMode");

      req.onsuccess = () => resolve(req.result || "online");
      req.onerror = () => resolve("online");
    });
  } catch {
    return "online";
  }
}

// -----------------------------------------------------
// Install — precache trip shell
// -----------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/JP/GJN-2026-May/",
        "/JP/GJN-2026-May/index.html",
        "/JP/GJN-2026-May/offline.html",
        "/JP/GJN-2026-May/external.html"
      ])
    )
  );
  self.skipWaiting();
});

// -----------------------------------------------------
// Activate — clean old caches
// -----------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// -----------------------------------------------------
// Fetch handling
// -----------------------------------------------------
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle navigation requests
  if (request.mode !== "navigate") return;

  event.respondWith(handleNavigation(request));
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const tripMode = await getTripMode();

  // If Trip Mode is explicitly Offline → external blocked screen
  if (tripMode === "offline" && request.url.includes("external.html")) {
    return cache.match("/JP/GJN-2026-May/external.html");
  }

  try {
    // Try network first
    const networkResponse = await fetch(request);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    // No data connection → offline screen
    if (!navigator.onLine) {
      return cache.match("/JP/GJN-2026-May/offline.html");
    }

    // Fallback to cached page
    const cached = await cache.match(request);
    if (cached) return cached;

    // Final fallback
    return cache.match("/JP/GJN-2026-May/offline.html");
  }
}
