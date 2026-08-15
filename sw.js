/* sw.js · Offline-Hülle. Version hochzählen, sobald Dateien geändert werden. */
const V = 'bitu-orga-v1';
const SHELL = [
  './', './index.html', './styles.css?v=1', './manifest.webmanifest',
  './js/store.js?v=1', './js/sync.js?v=1', './js/ui.js?v=1', './js/views.js?v=1', './js/app.js?v=1',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  /* Sync-Aufrufe nie aus dem Cache bedienen */
  if(ev.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if(url.origin !== location.origin) return;

  ev.respondWith(
    caches.match(ev.request, {ignoreSearch:false}).then(hit => hit || fetch(ev.request)
      .then(res => {
        const copy = res.clone();
        caches.open(V).then(c => c.put(ev.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match('./index.html')))
  );
});
