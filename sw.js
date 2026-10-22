const CACHE='enerdeal-reports-v2-3-1';
const ASSETS=['./','./index.html','./spaque.html','./styles.css','./pdf-engine.js','./app.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/ref-1.jpg','./assets/ref-2.jpg','./assets/ref-3.jpg','./assets/ref-4.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match('./index.html'))))});
