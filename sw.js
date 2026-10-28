/* EDP Reports service worker.
   On every release: raise VERSION here, in common.js and in version.json (see README). */
const VERSION = '4.8';
const CACHE = 'edp-reports-v' + VERSION;
const ASSETS = ['./', './index.html', './spaque.html', './styles.css', './i18n.js', './common.js', './pdf-engine.js', './app.js', './spaque.js', './auth.js', './dashboard.html', './dashboard.js', './settings.html', './settings.js', './manifest.webmanifest',
  './assets/edp-logo.jpg', './assets/icon-192.png', './assets/icon-512.png', './assets/tech-ref.jpg',
  './assets/ref-1.jpg', './assets/ref-2.jpg', './assets/ref-3.jpg', './assets/ref-4.jpg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
/* Network first for everything (so a page and its code always come from the same version);
   falls back to the offline copy when there is no or very slow internet. */
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; /* always ask the server */
  const cached = () => caches.match(req, { ignoreSearch: true }).then(h => h || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; });
  const slow = new Promise(res => setTimeout(res, 4000)).then(cached);
  e.respondWith(Promise.race([net.catch(cached), slow.then(h => h || net)]).then(r => r || net).catch(cached));
});
