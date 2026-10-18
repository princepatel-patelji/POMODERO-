import { $, $$, escapeHtml, fmtMin, fmtTime, fmtDate, todayStr, addDays, dayOf } from '../utils.js';
import { data } from '../store.js';
import { icon, toast, openModal, confirm, emptyState } from '../components.js';

const state = { range: '7d', from: '', to: '', subject: 'all', task: 'all' };

export function mount(el, app) {
  const un = data.subscribe(t => { if (['ready', 'sessions', 'tasks', 'subjects', 'import', 'clear'].includes(t)) render(); });
  el.innerHTML = `
    <div class="toolbar">
      <div class="chips" data-ranges>
        ${[['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['custom', 'Custom']].map(([v, l]) =>
          `<button class="chip-btn ${state.range === v ? 'on' : ''}" data-r="${v}">${l}</button>`).join('')}
      </div>
      <span data-custom class="hidden">
        <input type="date" data-from class="input" value="${state.from}" aria-label="From date">
        <span class="muted">to</span>
        <input type="date" data-to class="input" value="${state.to}" aria-label="To date">
      </span>
      <select data-fsub class="select" aria-label="Filter subject"><option value="all">All subjects</option></select>
      <select data-ftask class="select" aria-label="Filter task"><option value="all">All tasks</option></select>
    </div>
    <div class="sumrow" data-summary></div>
    <div data-body class="history-body"></div>`;

  el.addEventListener('click', e => {
    const r = e.target.closest('[data-r]');
    if (r) { state.range = r.dataset.r; render(); return; }
    const view = e.target.closest('[data-view]');
    if (view) { viewSession(view.dataset.view); return; }
    const del = e.target.closest('[data-del]');
    if (del) confirm({ title: 'Delete this session?', message: 'It will be removed from history and all statistics. This cannot be undone.', label: 'Delete' })
      .then(ok => ok && data.deleteSession(del.dataset.del).then(() => toast('Session deleted')));
  });
  el.addEventListener('change', e => {
    if (e.target.hasAttribute('data-fsub')) { state.subject = e.target.value; render(); }
    if (e.target.hasAttribute('data-ftask')) { state.task = e.target.value; render(); }
    if (e.target.hasAttribute('data-from')) { state.from = e.target.value; if (state.range !== 'custom') state.range = 'custom'; render(); }
    if (e.target.hasAttribute('data-to')) { state.to = e.target.value; if (state.range !== 'custom') state.range = 'custom'; render(); }
  });

  function inRange(d) {
    if (state.range === 'today') return d === todayStr();
    if (state.range === 'yesterday') return d === addDays(todayStr(), -1);
    if (state.range === '7d') return d >= addDays(todayStr(), -6);
    if (state.range === '30d') return d >= addDays(todayStr(), -29);
    if (state.range === 'custom') { const f = state.from || '0000-01-01', to = state.to || '9999-12-31'; return d >= f && d <= to; }
    return true;
  }
  function viewSession(id) {
    const s = data.sessions.find(x => x.id === id);
    if (!s) return;
    const sub = data.subjects.find(x => x.id === s.subjectId);
    openModal({
      title: 'Session details',
      body: `<dl class="detail">
        <dt>Date</dt><dd>${fmtDate(dayOf(s.endedAt))}</dd>
        <dt>Time</dt><dd>${fmtTime(s.startedAt)} – ${fmtTime(s.endedAt)}</dd>
        <dt>Duration</dt><dd>${s.durationMin} minutes (${s.type})</dd>
        <dt>Subject</dt><dd>${sub ? `${sub.icon || ''} ${escapeHtml(sub.name)}` : escapeHtml(s.subjectName || 'General')}</dd>
        <dt>Task</dt><dd>${s.taskTitle ? escapeHtml(s.taskTitle) : '—'}</dd>
        <dt>Status</dt><dd>${s.completed ? 'Completed' : 'Incomplete'}</dd>
      </dl>`,
      actions: [{ label: 'Close' }],
    });
  }
  function render() {
    $$('[data-ranges] .chip-btn', el).forEach(b => b.classList.toggle('on', b.dataset.r === state.range));
    el.querySelector('[data-custom]').classList.toggle('hidden', state.range !== 'custom');
    el.querySelector('[data-fsub]').innerHTML = `<option value="all">All subjects</option>` +
      data.subjects.map(s => `<option value="${s.id}" ${state.subject === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
    el.querySelector('[data-ftask]').innerHTML = `<option value="all">All tasks</option>` +
      data.tasks.map(t => `<option value="${t.id}" ${state.task === t.id ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('');

    const list = data.sessions
      .filter(s => { const d = dayOf(s.endedAt); if (!inRange(d)) return false;
        if (state.subject !== 'all' && s.subjectId !== state.subject) return false;
        if (state.task !== 'all' && s.taskId !== state.task) return false; return true; })
      .sort((a, b) => b.endedAt - a.endedAt);
    const total = list.reduce((a, b) => a + b.durationMin, 0);
    el.querySelector('[data-summary]').innerHTML = list.length
      ? `<div class="card sum"><b>${fmtMin(total)}</b><span>focused</span></div>
         <div class="card sum"><b>${list.length}</b><span>sessions</span></div>
         <div class="card sum"><b>${fmtMin(total / list.length)}</b><span>avg / session</span></div>`
      : '';
    const body = el.querySelector('[data-body]');
    if (!list.length) {
      body.replaceChildren(emptyState({ icon: 'history', title: 'No sessions in this range', sub: 'Completed focus sessions are recorded here automatically.' }));
      return;
    }
    const days = {};
    for (const s of list) (days[dayOf(s.endedAt)] ||= []).push(s);
    body.innerHTML = Object.keys(days).sort((a, b) => b.localeCompare(a)).map(d => `
      <div class="t-day"><h4>${fmtDate(d)} <span class="muted">· ${fmtMin(days[d].reduce((a, b) => a + b.durationMin, 0))}</span></h4>
        ${days[d].sort((a, b) => b.endedAt - a.endedAt).map(s => {
          const sub = data.subjects.find(x => x.id === s.subjectId);
          const c = sub ? sub.color : '#6366f1';
          return `<div class="t-item" data-view="${s.id}" role="button" tabindex="0">
            <span class="t-time">${fmtTime(s.startedAt)}</span>
            <span class="pill dur" style="background:${c}1c;border-color:${c}55">${s.durationMin}m</span>
            <span class="chip" style="background:${c}1c;border-color:${c}4d">${sub ? sub.icon || '' : ''} ${escapeHtml(sub ? sub.name : (s.subjectName || 'General'))}</span>
            <span class="t-task ${s.taskTitle ? '' : 'muted'}">${s.taskTitle ? escapeHtml(s.taskTitle) : 'No task'}</span>
            <button class="icon-btn danger" data-del="${s.id}" title="Delete session" aria-label="Delete session">${icon('trash', 14)}</button>
          </div>`;
        }).join('')}
      </div>`).join('');
    body.onclick = e => { if (e.target.closest('.t-item') && !e.target.closest('[data-del]')) viewSession(e.target.closest('.t-item').dataset.view); };
    body.onkeydown = e => { if (e.key === 'Enter' && e.target.classList.contains('t-item')) viewSession(e.target.dataset.view); };
  }
  render();
  return un;
}