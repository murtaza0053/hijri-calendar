// Calendar app service worker. The Dua read-along (dua/) has its own worker and caches
// ("readalong-*"), so this one must leave dua/ requests and those caches alone.
const CACHE = "hijri-cal-v61";
const ASSETS = ["./", "index.html", "themes.css", "theme-init.js", "hijri.js", "i18n.js", "miqaats.json", "ziyarat.html", "ziyarat.json", "version.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const DUA = new URL("dua/", self.registration.scope).href;
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("hijri-cal-") && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// network-first (so updates arrive), cache fallback for offline
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.url.startsWith(DUA) || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
