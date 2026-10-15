// Service worker: keeps a copy of every game file (listed in precache.js) so Planet Pop works offline and
// can be installed as an app. Files come from the cache; the page itself is fetched fresh when online.
importScripts('./precache.js');

const CACHE = `planet-pop-${self.PRECACHE.version}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(self.PRECACHE.files)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => { // drop caches from older versions
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('planet-pop-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') { // the page: fresh when online (so updates show up), the cached copy offline
    e.respondWith(fetch(req).catch(() => caches.match('index.html', { cacheName: CACHE })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
