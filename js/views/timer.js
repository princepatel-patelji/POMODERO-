import { $, $$, escapeHtml, fmtMs, fmtMin, dayOf, todayStr } from '../utils.js';
import { data } from '../store.js';
import { timer } from '../timer.js';
import { icon, toast, openModal } from '../components.js';

const C = 2 * Math.PI * 112;
const MODES = [['focus', 'Focus', 'sparkle'], ['short', 'Short break', 'coffee'], ['long', 'Long break', 'moon']];

export function mount(el, app) {
  el.innerHTML = `
    <div class="timer-page">
      <div class="seg center" role="tablist" aria-label="Timer mode">
        ${MODES.map(([m, l, ic]) => `<button data-m="${m}" role="tab">${icon(ic, 15)}<span>${l}</span></button>`).join('')}
      </div>
      <div class="timer-stage">
        <div class="ring-wrap" data-rm="focus">
          <svg viewBox="0 0 260 260" aria-hidden="true">
            <circle class="r-bg" cx="130" cy="130" r="112"/>
            <circle class="r-fg" cx="130" cy="130" r="112" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 130 130)"/>
          </svg>
          <div class="r-center">
            <div class="r-time" data-time>--:--</div>
            <div class="r-mode" data-mlabel>Focus</div>
            <div class="r-ctx" data-ctx></div>
          </div>
        </div>
        <div class="cycle-row"><div class="dots" data-dots></div><span class="muted small" data-nextlb></span></div>
        <div class="t-controls">
          <button class="btn ghost icon-lg" data-reset title="Reset (R)" aria-label="Reset timer">${icon('reset', 20)}</button>
          <button class="btn primary big" data-main>${icon('play', 22)}<span>Start</span></button>
          <button class="btn ghost icon-lg" data-skip title="Skip (S)" aria-label="Skip session">${icon('skip', 20)}</button>
        </div>
        <div class="chips" data-chips></div>
      </div>
      <section class="card ctx-card">
        <h3>Session context</h3>
        <div class="frow">
          <label class="field grow"><span>Subject</span><select data-subj class="select"></select></label>
          <label class="field grow"><span>Task (optional)</span><select data-task class="select"></select></label>
        </div>
        <div class="ctx-foot">
          <button class="btn ghost sm" data-fm>${icon('eye', 16)}<span>Focus mode</span><kbd>F</kbd></button>
          <span class="muted tiny">Space start/pause · R reset · S skip · 1/2/3 modes · Esc exit</span>
        </div>
      </section>
    </div>`;

  el.addEventListener('click', e => {
    const m = e.target.closest('[data-m]');
    if (m) { timer.setMode(m.dataset.m); return; }
    if (e.target.closest('[data-reset]')) { timer.reset(); return; }
    if (e.target.closest('[data-skip]')) { timer.skip(); toast('Session skipped — it was not recorded.', 'info'); return; }
    if (e.target.closest('[data-main]')) { timer.toggle(); return; }
    if (e.target.closest('[data-fm]')) document.body.classList.toggle('focus-mode');
  });
  el.addEventListener('change', e => {
    if (e.target.hasAttribute('data-subj')) {
      timer.setContext({ subjectId: e.target.value || null, taskId: null });
    }
    if (e.target.hasAttribute('data-task')) {
      const task = data.tasks.find(t => t.id === e.target.value);
      timer.setContext({ subjectId: task ? task.subjectId : null, taskId: e.target.value || null });
    }
  });

  const unT = timer.subscribe(apply);
  const unD = data.subscribe(t => {
    if (['tasks', 'subjects', 'settings', 'sessions', 'ready', 'import', 'clear'].includes(t)) refreshSelects();
  });

  function refreshSelects() {
    const s = timer.state;
    const subOpts = `<option value="">No subject</option>` +
      data.subjects.filter(x => !x.archived).map(x =>
        `<option value="${x.id}" ${s.subjectId === x.id ? 'selected' : ''}>${x.icon || ''} ${escapeHtml(x.name)}</option>`).join('');
    const pool = data.tasks.filter(t => (t.status !== 'done' || s.status !== 'idle') && (!s.subjectId || t.subjectId === s.subjectId));
    const taskOpts = `<option value="">No task</option>` +
      pool.map(t => `<option value="${t.id}" ${s.taskId === t.id ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('');
    el.querySelector('[data-subj]').innerHTML = subOpts;
    el.querySelector('[data-task]').innerHTML = taskOpts;
  }

  function apply(s) {
    el.querySelector('[data-time]').textContent = fmtMs(s.remainingMs);
    el.querySelector('.r-fg').style.strokeDashoffset = String(C * (1 - s.progress));
    el.querySelector('[data-rm]').dataset.rm = s.mode;
    el.querySelector('[data-mlabel]').textContent = MODES.find(m => m[0] === s.mode)[1];
    $$('.seg [data-m]', el).forEach(b => {
      b.classList.toggle('on', b.dataset.m === s.mode);
      b.setAttribute('aria-selected', String(b.dataset.m === s.mode));
    });
    const c = s.ctx;
    el.querySelector('[data-ctx]').textContent =
      c.task ? `${c.subject ? c.subject.name : 'General'} · ${c.task.title}` :
      c.subject ? c.subject.name :
      (s.mode === 'focus' ? 'No subject selected' : '');
    const main = el.querySelector('[data-main]');
    main.innerHTML = s.status === 'running' ? `${icon('pause', 22)}<span>Pause</span>` :
      s.status === 'paused' ? `${icon('play', 22)}<span>Resume</span>` :
      `${icon('play', 22)}<span>Start</span>`;
    main.classList.toggle('running', s.status === 'running');
    const la = data.settings.durations.longAfter;
    const done = s.count % la;
    el.querySelector('[data-dots]').innerHTML = Array.from({ length: la }, (_, i) =>
      `<i class="${i < (s.count > 0 && done === 0 ? la : done) ? 'on' : ''}" title="Focus session ${i + 1}"></i>`).join('');
    el.querySelector('[data-nextlb]').textContent = `Long break after ${la} focus sessions`;
    const t = todayStr();
    const ss = data.sessions.filter(x => dayOf(x.endedAt) === t);
    el.querySelector('[data-chips]').innerHTML =
      `<span class="chip">${ss.length} sessions today</span>
       <span class="chip">${fmtMin(ss.reduce((a, b) => a + b.durationMin, 0))} focused</span>
       <span class="chip ${s.status === 'running' ? 'run' : ''}">${s.status === 'running' ? '● Running' : s.status === 'paused' ? '❚❚ Paused' : 'Ready'}</span>`;
  }

  el.addEventListener('timer-complete', () => {});
  const unT2 = timer.subscribe((s, ev) => {
    if (ev && ev.completed === 'focus') doneModal(s, ev);
    if (ev && ev.completed === 'break') toast('Break over — ready when you are.', 'info');
  });

  function doneModal(s, ev) {
    const c = ev.ctx, la = data.settings.durations.longAfter;
    const lbDue = s.count > 0 && s.count % la === 0;
    const t = todayStr();
    const ss = data.sessions.filter(x => dayOf(x.endedAt) === t);
    openModal({
      title: 'Focus complete',
      body: `<div class="done-hero">${icon('sparkle', 22)}</div>
        <p><b>${fmtMs(ev.total)}</b> of deep focus</p>
        <p class="muted">${c.subject ? escapeHtml(c.subject.name) : 'General'}${c.task ? ` · ${escapeHtml(c.task.title)}` : ''}</p>
        <p class="muted">Today: ${ss.length} sessions · ${fmtMin(ss.reduce((a, b) => a + b.durationMin, 0))} (goal ${data.settings.goals.dailyMin} min)</p>
        <p class="tiny muted">Completing the timer never auto-completes tasks — that stays with you.</p>`,
      actions: [
        { label: `Short break · ${data.settings.durations.short}m`, kind: lbDue ? 'ghost' : 'primary', onClick: cl => { cl(); timer.setMode('short'); timer.start(); } },
        { label: `Long break · ${data.settings.durations.long}m`, kind: lbDue ? 'primary' : 'ghost', onClick: cl => { cl(); timer.setMode('long'); timer.start(); } },
        { label: 'Next focus session', onClick: cl => { cl(); timer.setMode('focus'); timer.start(); } },
        { label: 'Later', onClick: cl => cl() },
      ],
    });
  }

  refreshSelects();
  return () => { unT(); unT2(); unD(); };
}