const CACHE_NAME = "jp-flights-2024-v1";

const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./offline.html",
    "./manifest.json",
    "./assets/icons/icon-192x192.png",
    "./assets/icons/icon-512x512.png"
];

// Install
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

// Activate
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }))
        )
    );
});

// Fetch
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse ||
                fetch(event.request).catch(() =>
                    caches.match("./offline.html")
                );
        })
    );
});
