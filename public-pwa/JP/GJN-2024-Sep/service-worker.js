// ===============================
// JP GJN-2024-Sep – Service Worker
// Phase 3C: Trip Mode Enforcement
// ===============================

const CACHE_VERSION = "tw-gjn-jp-2024-sep-v2";
const CACHE_NAME = `trekworks-cache-${CACHE_VERSION}`;

// ===============================
// IndexedDB – Trip Mode
// ===============================
const TW_DB_NAME = "trekworks";
const TW_DB_VERSION = 1;
const TW_STORE = "settings";
const TRIP_MODE_KEY = "tripMode";
const DEFAULT_TRIP_MODE = "online";

function openTWDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TW_DB_NAME, TW_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TW_STORE)) {
        db.createObjectStore(TW_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getTripMode() {
  try {
    const db = await openTWDB();
    return new Promise((resolve) => {
      const tx = db.transaction(TW_STORE, "readonly");
      const store = tx.objectStore(TW_STORE);
      const req = store.get(TRIP_MODE_KEY);
      req.onsuccess = () => resolve(req.result || DEFAULT_TRIP_MODE);
      req.onerror = () => resolve(DEFAULT_TRIP_MODE);
    });
  } catch {
    return DEFAULT_TRIP_MODE;
  }
}

// ===============================
// Core shell assets
// ===============================
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./assets/icons/icon-192x192.png",
  "./assets/icons/icon-512x512.png"
];

// ===============================
// Install
// ===============================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// ===============================
// Activate
// ===============================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("trekworks-cache-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ===============================
// Fetch – Trip Mode Enforcement
// ===============================
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only care about navigations
  if (request.mode !== "navigate") {
    return;
  }

  event.respondWith(handleNavigation(request));
});

// ===============================
// Navigation handler (ENFORCED)
// ===============================
async function handleNavigation(request) {
  const url = new URL(request.url);
  const tripMode = await getTripMode();

  // --------------------------------
  // Trip Mode: OFFLINE
  // --------------------------------
  if (tripMode === "offline") {

    // Block ANY navigation leaving TrekWorks origin
    if (url.origin !== self.location.origin) {
      const cache = await caches.open(CACHE_NAME);

      // Closed-loop fallback: always stay inside app
      const indexFallback = await cache.match("./index.html");
      if (indexFallback) return indexFallback;

      const offlineFallback = await cache.match("./offline.html");
      if (offlineFallback) return offlineFallback;

      // Absolute last resort (should never hit)
      return Response.redirect("./index.html", 302);
    }
  }

  // --------------------------------
  // Normal behaviour (Online OR internal)
  // --------------------------------
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);

    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const indexFallback = await cache.match("./index.html");
    if (indexFallback) return indexFallback;

    const offlineFallback = await cache.match("./offline.html");
    if (offlineFallback) return offlineFallback;

    throw error;
  }
}
