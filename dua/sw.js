// Bump CACHE when app files change. Media (audio/pdf) is cached by app.js in 'readalong-media-v1'.
const CACHE = 'readalong-shell-v98';
const SHELL = ['./', 'index.html', 'app.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'quran.html', 'joshan.html', 'faazil.html', 'kumail.html', 'tasbeeh.html', 'img/tasbih-7-days.jpg', 'book.html', 'barakat.html', 'quran/36.json', 'quran/18.json', 'quran/55.json', 'quran/56.json', 'quran/59.json', 'quran/62.json', 'quran/72.json', 'quran/youtube.json', 'fonts/NotoNaskhArabic-arabic.woff2', 'fonts/AmiriQuran-arabic.woff2',
  '../themes.css', '../theme-init.js', '../i18n.js', '../wakelock.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('readalong-shell') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/media\/.+\.(m4a|mp3|aac|wav|ogg|opus|pdf)$/i.test(u.pathname)) return; // app.js handles these
  if (/\/books\/.+\.pdf$/i.test(u.pathname)) return; // big books: pdf.js range requests straight to the network
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
