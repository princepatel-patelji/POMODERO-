/* FocusFlow service worker — app-shell cache, offline fallback.
   Never touches IndexedDB (private data stays in IDB, not here). */
const VERSION = 'ff-v1';
const ASSETS = [
  '/POMODERO/',
  '/POMODERO/index.html',
  '/POMODERO/manifest.json',
  '/POMODERO/css/styles.css',
  '/POMODERO/icons/icon.svg',
  '/POMODERO/icons/icon-maskable.svg',
  '/POMODERO/js/main.js',
  '/POMODERO/js/app.js',
  '/POMODERO/js/timer.js',
  '/POMODERO/js/store.js',
  '/POMODERO/js/db.js',
  '/POMODERO/js/utils.js',
  '/POMODERO/js/notify.js',
  '/POMODERO/js/charts.js',
  '/POMODERO/js/components.js',
  '/POMODERO/js/views/dashboard.js',
  '/POMODERO/js/views/timer.js',
  '/POMODERO/js/views/tasks.js',
  '/POMODERO/js/views/subjects.js',
  '/POMODERO/js/views/planner.js',
  '/POMODERO/js/views/history.js',
  '/POMODERO/js/views/analytics.js',
  '/POMODERO/js/views/settings.js'
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