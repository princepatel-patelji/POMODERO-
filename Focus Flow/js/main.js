/* FocusFlow — bootstrap: start app, register service worker, PWA install prompts. */
import { App } from './app.js';
import { toast } from './components.js';

const app = new App();
window.app = app;

window.addEventListener('beforeinstallprompt', e => app.onBeforeInstall(e));
window.addEventListener('appinstalled', () => app.onInstalled());

(async () => {
  try {
    await app.init();
  } catch (err) {
    console.error('FocusFlow failed to start', err);
    const v = document.getElementById('view');
    if (v) v.innerHTML = `<div class="card"><h2>Couldn’t start FocusFlow</h2>
      <p class="muted">${err.message}</p>
      <p class="tiny muted">Check that IndexedDB is available and you are not in a fully blocked private window.</p></div>`;
    return;
  }
  if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller)
            toast('Update available — refresh to load the latest version.', 'info', 6000);
        });
      });
    }).catch(err => console.warn('Service worker registration skipped/failed:', err));
  }
})();