/* FocusFlow — main application controller: routing, timer shortcuts,
   theme, streak chip, PWA install, keyboard shortcuts. */
import { $, $$, computeStreaks } from './utils.js';
import { data } from './store.js';
import { timer } from './timer.js';
import { icon, toast, openModal } from './components.js';
import { mount as mDash } from './views/dashboard.js';
import { mount as mTimer } from './views/timer.js';
import { mount as mTasks } from './views/tasks.js';
import { mount as mSub }  from './views/subjects.js';
import { mount as mPlan } from './views/planner.js';
import { mount as mHist } from './views/history.js';
import { mount as mAn }   from './views/analytics.js';
import { mount as mSet }  from './views/settings.js';

const ROUTES = [
  ['dashboard', 'Dashboard',   'home',     mDash],
  ['timer',     'Focus Timer', 'timer',    mTimer],
  ['tasks',     'Tasks',       'tasks',    mTasks],
  ['subjects',  'Subjects',    'book',     mSub],
  ['planner',   'Planner',     'calendar', mPlan],
  ['history',   'History',     'history',  mHist],
  ['analytics', 'Analytics',   'chart',    mAn],
  ['settings',  'Settings',    'settings', mSet],
];

const isTyping = () => {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
};

export class App {
  constructor() {
    this.viewEl = $('#view');
    this.unmount = null;
    this.currentRoute = null;
    this.deferredInstall = null;
  }

  async init() {
    this.buildNav();
    this.buildBottomNav();
    this.bindGlobal();
    await data.init();
    const restore = data.settings.startup.restoreTimer;
    await timer.init(restore ? data.timerState : null);
    this.applyTheme();
    this.updateStreak();
    data.subscribe(t => {
      if (t === 'settings') this.applyTheme();
      if (['ready', 'sessions', 'import', 'clear'].includes(t)) this.updateStreak();
    });
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.updateStreak(); });
    this.refreshInstall();
    this.route();
  }

  /* ---- Navigation ---- */
  buildNav() {
    const nav = $('#nav-desktop');
    nav.innerHTML = ROUTES.map(([id, label, ic]) =>
      `<a href="#/${id}" class="nav-item" data-nav="${id}">${icon(ic, 18)}<span>${label}</span></a>`).join('');
  }
  buildBottomNav() {
    const ids = ['dashboard', 'timer', 'tasks', 'analytics', 'settings'];
    const bn = $('#bottomnav');
    bn.innerHTML = ids.map(id => {
      const r = ROUTES.find(x => x[0] === id);
      return `<a href="#/${id}" class="bnav-item" data-nav="${id}" aria-label="${r[1]}">${icon(r[2], 21)}</a>`;
    }).join('');
  }
  activateNav(id) { $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === id)); }

  route() {
    let r = (location.hash || '#/dashboard').replace(/^#\//, '').split('?')[0];
    const found = ROUTES.find(x => x[0] === r) || ROUTES[0];
    if (this.currentRoute === found[0]) { this.activateNav(found[0]); return; }
    this.currentRoute = found[0];
    if (this.unmount) { try { this.unmount(); } catch (e) { console.error(e); } this.unmount = null; }
    const host = document.createElement('section');
    host.className = 'route-host';
    this.viewEl.replaceChildren(host);
    let un = null;
    try { un = found[3](host, this) || null; }
    catch (e) { console.error('Route render failed', e); host.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="muted">${e.message}</p></div>`; }
    this.unmount = typeof un === 'function' ? un : null;
    this.activateNav(found[0]);
    $('#pageTitle').textContent = found[1];
    this.viewEl.focus();
    window.scrollTo(0, 0);
  }

  /* ---- Timer helpers used across views ---- */
  quickStart() {
    const a = data.tasks.find(t => t.id === data.active.taskId && t.status !== 'done');
    this.goFocus(a ? a.subjectId : null, a ? a.id : null);
  }
  quickStartWith(subjectId, taskId) { this.goFocus(subjectId || null, taskId || null); }
  goFocus(subjectId, taskId) {
    timer.setContext({ subjectId, taskId });
    if (timer.state.mode !== 'focus') timer.setMode('focus');
    if (this.currentRoute !== 'timer') location.hash = '#/timer';
    timer.start();
  }
  setActive(taskId) { data.setActive(taskId); }

  /* ---- Theme ---- */
  applyTheme() {
    const t = data.settings.theme;
    const eff = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
    document.documentElement.dataset.theme = eff;
    let m = $('meta[data-dyntc]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'theme-color'); m.dataset.dyntc = '1'; document.head.appendChild(m); }
    m.content = eff === 'light' ? '#f4f5fb' : '#0e1017';
    const tb = $('#themeBtn');
    if (tb) tb.innerHTML = icon(eff === 'light' ? 'moon' : 'sun', 18);
  }
  toggleTheme() {
    const cur = document.documentElement.dataset.theme;
    data.saveSettings({ theme: cur === 'dark' ? 'light' : 'dark' });
  }

  updateStreak() {
    const el = $('#streakChip');
    if (!el) return;
    const n = computeStreaks(data.sessions).current;
    el.innerHTML = icon('flame', 13) + `<span>${n} ${n === 1 ? 'day' : 'days'}</span>`;
    el.title = 'Current study streak (consecutive days with a completed focus session)';
  }

  /* ---- PWA install ---- */
  onBeforeInstall(e) { e.preventDefault(); this.deferredInstall = e; this.refreshInstall(); }
  onInstalled() { this.deferredInstall = null; this.refreshInstall(); toast('FocusFlow installed 🎉'); }
  isStandalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  refreshInstall() {
    const btn = $('[data-ffinstall]');
    if (!btn) return;
    btn.classList.toggle('installed', this.isStandalone());
    btn.innerHTML = this.isStandalone()
      ? icon('check', 15) + '<span>Installed</span>'
      : icon('download', 15) + '<span>Install app</span>';
  }
  async triggerInstall() {
    if (this.isStandalone()) { this.showInstallHelp(); return; }
    if (this.deferredInstall) {
      this.deferredInstall.prompt();
      try { const c = await this.deferredInstall.userChoice; if (c.outcome === 'accepted') toast('Installing FocusFlow…'); } catch (e) { /* user dismissed */ }
      this.deferredInstall = null;
      this.refreshInstall();
      return;
    }
    this.showInstallHelp();
  }
  showInstallHelp() {
    openModal({
      title: 'Install FocusFlow',
      body: `<p>Full-screen, offline app experience ke liye install karo:</p>
        <ol class="steps">
          <li>Is app ko <b>Google Chrome</b> (Windows, Mac ya Android) mein kholo.</li>
          <li>Address bar mein <b>Install</b> icon click karo, ya neeche “Install app” button dabao.</li>
          <li>Confirm karo — FocusFlow apne alag window mein khulega.</li>
        </ol>
        <p class="tiny muted">iPhone/iPad (Safari): Share → <b>Add to Home Screen</b>. PWA install ke liye HTTPS ya localhost chahiye.</p>`,
      actions: [{ label: 'Got it', kind: 'primary' }],
    });
  }

  showShortcuts() {
    openModal({
      title: 'Keyboard shortcuts',
      body: `<div class="detail">
        <dt>Space</dt><dd>Timer start / pause</dd>
        <dt>R</dt><dd>Timer reset</dd>
        <dt>S</dt><dd>Session skip</dd>
        <dt>1 / 2 / 3</dt><dd>Focus / Short break / Long break</dd>
        <dt>F</dt><dd>Focus Mode toggle</dd>
        <dt>Esc</dt><dd>Focus Mode exit / dialog close</dd>
        <dt>?</dt><dd>Ye help</dd>
      </div>`,
      actions: [{ label: 'Close', kind: 'primary' }],
    });
  }

  bindGlobal() {
    $('#themeBtn').addEventListener('click', () => this.toggleTheme());
    $('#shortcutsBtn').addEventListener('click', () => this.showShortcuts());
    $$('.btn[data-ffinstall]').forEach(b => b.addEventListener('click', () => this.triggerInstall()));
    $$('.nav-item, .bnav-item').forEach(a => a.addEventListener('click', () => this.activateNav(a.dataset.nav)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (document.body.classList.contains('focus-mode')) document.body.classList.remove('focus-mode'); return; }
      if (isTyping()) return;
      if (e.key === ' ') { e.preventDefault(); timer.toggle(); }
      else if (e.key === 'r' || e.key === 'R') timer.reset();
      else if (e.key === 's' || e.key === 'S') timer.skip();
      else if (e.key === '1') timer.setMode('focus');
      else if (e.key === '2') timer.setMode('short');
      else if (e.key === '3') timer.setMode('long');
      else if (e.key === 'f' || e.key === 'F') document.body.classList.toggle('focus-mode');
      else if (e.key === '?') this.showShortcuts();
    });
  }
}