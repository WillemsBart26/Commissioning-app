/* EDP Reports service worker - bump CACHE on every release so phones pick up the update */
const CACHE = 'edp-reports-v4-2';
const ASSETS = ['./', './index.html', './spaque.html', './styles.css', './i18n.js', './common.js', './pdf-engine.js', './app.js', './spaque.js', './auth.js', './dashboard.html', './dashboard.js', './manifest.webmanifest',
  './assets/edp-logo.jpg', './assets/icon-192.png', './assets/icon-512.png', './assets/tech-ref.jpg',
  './assets/ref-1.jpg', './assets/ref-2.jpg', './assets/ref-3.jpg', './assets/ref-4.jpg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
/* Network first for pages (so updates arrive when online), cache first for everything else */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  const fromNet = () => fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; });
  e.respondWith(isPage
    ? fromNet().catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match('./index.html')))
    : caches.match(req, { ignoreSearch: true }).then(h => h || fromNet()));
});
