/* Минимальный service worker «Погода в горах».
   Статика — cache-first, data/points.json — network-first,
   погодные API — всегда сеть (свежесть важнее, кэширует само приложение). */
const CACHE = "kp-weather-v3.1";
const STATIC = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "weather.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "skins/skins.json",
  "skins/base/skin.js",
  "skins/base/badge.svg",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // внешние API (погода, Telegram SDK) — только сеть, без кэша SW
  if (url.origin !== self.location.origin) return;

  // библиотека точек — network-first: свежая, когда есть сеть
  if (url.pathname.endsWith("data/points.json")) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // остальная статика — cache-first с дозаписью
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }))
  );
});
