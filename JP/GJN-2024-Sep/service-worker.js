// =====================================================
// TrekWorks Trip Mode (TTM) Service Worker
// Trip: JP / GJN-2024-Sep
// Scope: /JP/GJN-2024-Sep/
// =====================================================

const CACHE_VERSION = "tw-jp-gjn-2024-sep-v4";
const CACHE_NAME = `trekworks-${CACHE_VERSION}`;

// -----------------------------------------------------
// Trip Mode storage (IndexedDB)
// -----------------------------------------------------
const DB_NAME = "trekworks";
const DB_VERSION = 1;
const STORE_NAME = "settings";
const TRIP_MODE_KEY = "tripMode";
const DEFAULT_MODE = "online";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getTripMode() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(TRIP_MODE_KEY);
      req.onsuccess = () => resolve(req.result || DEFAULT_MODE);
      req.onerror = () => resolve(DEFAULT_MODE);
    });
  } catch {
    return DEFAULT_MODE;
  }
}

// -----------------------------------------------------
// Core assets (absolute)
// -----------------------------------------------------
const CORE_ASSETS = [
  "/JP/GJN-2024-Sep/",
  "/JP/GJN-2024-Sep/index.html",
  "/JP/GJN-2024-Sep/offline.html",
  "/JP/GJN-2024-Sep/manifest.json",
  "/JP/GJN-2024-Sep/assets/icons/icon-192x192.png",
  "/JP/GJN-2024-Sep/assets/icons/icon-512x512.png"
];

// -----------------------------------------------------
// Install
// -----------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// -----------------------------------------------------
// Activate
// -----------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("trekworks-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// -----------------------------------------------------
// Fetch handling (navigation only)
// -----------------------------------------------------
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(handleNavigation(event.request));
});

// -----------------------------------------------------
// Navigation strategy
// -----------------------------------------------------
async function handleNavigation(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);

  const inTripScope = url.pathname.startsWith("/JP/GJN-2024-Sep/");
  const isTripHome =
    url.pathname === "/JP/GJN-2024-Sep/" ||
    url.pathname === "/JP/GJN-2024-Sep/index.html";

  const tripMode = await getTripMode();

  // ---------------------------------------------------
  // Trip Mode: OFFLINE (closed loop, but never "lie")
  // ---------------------------------------------------
  if (tripMode === "offline") {
    // If user somehow navigates outside scope, show offline message
    if (!inTripScope) {
      const offline = await cache.match("/JP/GJN-2024-Sep/offline.html");
      if (offline) return offline;
      return Response.error();
    }

    // Trip Home always allowed
    if (isTripHome) {
      const home = await cache.match("/JP/GJN-2024-Sep/index.html");
      if (home) return home;
    }

    // Any other page: serve cached version only
    const cached = await cache.match(request);
    if (cached) return cached;

    // Not cached: show offline page (NOT index.html)
    const offline = await cache.match("/JP/GJN-2024-Sep/offline.html");
    if (offline) return offline;

    return Response.error();
  }

  // ---------------------------------------------------
  // Trip Mode: ONLINE
  // ---------------------------------------------------
  try {
    const response = await fetch(request);

    // Only cache successful same-origin pages within this trip scope
    if (inTripScope && response && response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    // Network failed: try cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // Otherwise show offline page
    const offline = await cache.match("/JP/GJN-2024-Sep/offline.html");
    if (offline) return offline;

    return Response.error();
  }
}
