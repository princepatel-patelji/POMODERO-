/* FocusFlow service worker — app-shell cache, offline fallback.
   Never touches IndexedDB (private data stays in IDB, not here). */
const VERSION = 'ff-v1';
const ASSETS = [
  './', './index.html', './manifest.json', './css/styles.css',
  './icons/icon.svg', './icons/icon-maskable.svg',
  './js/main.js', './js/app.js', './js/timer.js', './js/store.js',
  './js/db.js', './js/utils.js', './js/notify.js', './js/charts.js',
  './js/components.js',
  './js/views/dashboard.js', './js/views/timer.js', './js/views/tasks.js',
  './js/views/subjects.js', './js/views/planner.js', './js/views/history.js',
  './js/views/analytics.js', './js/views/settings.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return r;
  }).catch(() => hit)));
});