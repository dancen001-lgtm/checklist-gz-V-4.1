/* AMPM Checklist GZ — Service Worker (v3)
   Offline-first caching.
   Nota: evita cachear URLs chrome-extension:// (causa errores en DevTools)
*/
const CACHE_NAME = "ampm-checklist-gz-v4";
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
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // No interceptar extensiones / esquemas raros
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.protocol === "chrome-extension:") return;

  // Network-first para Apps Script (no cache)
  if (url.hostname === "script.google.com") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      try{
        const fresh = await fetch(req);
        // cachea solo respuestas OK y mismo origen
        if (fresh && fresh.ok && url.origin === self.location.origin) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      }catch(e){
        return cached || new Response("Offline", {status: 503, statusText: "Offline"});
      }
    })()
  );
});
