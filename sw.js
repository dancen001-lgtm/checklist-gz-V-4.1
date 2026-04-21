/* AMPM Checklist GZ — Service Worker */
const CACHE_NAME = "ampm-checklist-gz-v6";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./questions.js",
  "./manifest.json",
  "./favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.protocol === "chrome-extension:") return;
  if (url.hostname === "script.google.com") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      try {
        const fresh = await fetch(req);
        if (req.method === "GET" && fresh.ok) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
