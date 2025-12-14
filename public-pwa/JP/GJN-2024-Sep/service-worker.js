// ===============================
// TrekWorks — JP GJN-2024-Sep
// Service Worker
// Phase 3 — Step 2
//
// Purpose:
//   • Enforce TrekWorks Trip Mode (TTM)
//   • Offline Trip Mode = closed loop
//   • Online Trip Mode = normal behaviour
//
// NOTE:
//   • No cache strategy changes in this step
//   • No connectivity detection
//   • No browser heuristics
// ===============================

// 🔁 BUMP THIS WHEN YOU DEPLOY A NEW VERSION
const CACHE_VERSION = "tw-gjn-jp-2024-sep-v2";
const CACHE_NAME = `trekworks-cache-${CACHE_VERSION}`;

// Trip Mode contract
const TRIP_MODE_KEY = "trekworks.tripMode";
const TRIP_MODE_ONLINE = "online";
const TRIP_MODE_OFFLINE = "offline";

// Core shell assets – unchanged
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./assets/icons/icon-192x192.png",
  "./assets/icons/icon-512x512.png"
];

// ===============================
// Install — cache core shell
// ===============================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// ===============================
// Activate — clean old caches
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
// Utility — read Trip Mode
// ===============================
async function getTripMode() {
  const clientList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clientList) {
    try {
      const mode = await client.localStorage?.getItem(TRIP_MODE_KEY);
      if (mode === TRIP_MODE_ONLINE || mode === TRIP_MODE_OFFLINE) {
        return mode;
      }
    } catch (_) {}
  }
  return TRIP_MODE_ONLINE; // safe default
}

// ===============================
// Fetch handler
// ===============================
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only care about same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // ===============================
  // Navigation requests
  // ===============================
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // ===============================
  // Asset requests (unchanged)
  // ===============================
  event.respondWith(handleAsset(request));
});

// ===============================
// Navigation handler
// ===============================
async function handleNavigation(request) {
  const tripMode = await getTripMode();
  const url = new URL(request.url);

  // OFFLINE TRIP MODE — closed loop
  if (tripMode === TRIP_MODE_OFFLINE) {
    // Allow same-origin navigation only
    if (url.origin !== self.location.origin) {
      return Response.redirect(
        "https://trekworks.org/JP/GJN-2024-Sep/trip-gate.html",
        302
      );
    }
  }

  // Existing behaviour (network-first)
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const fallback = await cache.match("./offline.html");
    if (fallback) return fallback;

    throw err;
  }
}

// ===============================
// Asset handler — cache-first
// ===============================
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    throw err;
  }
}
