import { $, $$, escapeHtml, fmtMin, fmtTime, fmtDate, todayStr, addDays, lastNDays, dayOf, greeting, priorityRank, isOverdue, computeStreaks } from '../utils.js';
import { data } from '../store.js';
import { icon, toast, emptyState } from '../components.js';
import { barChart } from '../charts.js';
import { openTaskForm } from './tasks.js';

export function mount(el, app) {
  const un = data.subscribe(t => {
    if (['ready', 'sessions', 'tasks', 'subjects', 'settings', 'import', 'clear'].includes(t)) render();
  });
  el.addEventListener('click', e => {
    if (e.target.closest('[data-qstart]')) { app.quickStart(); return; }
    if (e.target.closest('[data-newtask]')) { openTaskForm(null); return; }
    const done = e.target.closest('[data-donetask]');
    if (done) {
      const t = data.tasks.find(x => x.id === done.dataset.donetask);
      if (t) { data.saveTask({ ...t, status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : Date.now() }).then(() => toast(t.status === 'done' ? 'Task reopened' : 'Task completed 🎉')); }
      return;
    }
    const focus = e.target.closest('[data-focus]');
    if (focus) {
      const t = data.tasks.find(x => x.id === focus.dataset.focus);
      if (t) app.quickStartWith(t.subjectId, t.id);
    }
  });
  render();
  return un;

  function render() {
    const t = todayStr();
    const tSes = data.sessions.filter(x => dayOf(x.endedAt) === t);
    const todayMin = tSes.reduce((a, b) => a + b.durationMin, 0);
    const doneToday = data.tasks.filter(x => x.status === 'done' && x.completedAt && dayOf(x.completedAt) === t).length;
    const pending = data.tasks.filter(x => x.status !== 'done').length;
    const overdue = data.tasks.filter(isOverdue).length;
    const streak = computeStreaks(data.sessions).current;
    const goals = data.settings.goals;
    const pct = Math.min(100, Math.round(todayMin / Math.max(1, goals.dailyMin) * 100));
    const week = lastNDays(7).map(d => ({
      d, m: data.sessions.filter(x => dayOf(x.endedAt) === d).reduce((a, b) => a + b.durationMin, 0),
    }));
    const upcoming = data.tasks
      .filter(x => x.status !== 'done' && x.dueDate && x.dueDate <= addDays(t, 7))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || priorityRank(b.priority) - priorityRank(a.priority))
      .slice(0, 5);
    const last = [...data.sessions].sort((a, b) => b.endedAt - a.endedAt)[0];
    const activeSub = last ? (data.subjects.find(x => x.id === last.subjectId) || { name: last.subjectName || 'General', color: null, icon: null }) : null;
    const activeTask = data.tasks.find(x => x.id === data.active.taskId && x.status !== 'done');
    const motivational =
      todayMin >= goals.dailyMin ? 'Daily goal crushed — ride the momentum.' :
      todayMin === 0 ? 'A single focus session puts you ahead of yesterday.' :
      pct >= 60 ? 'Strong pace — keep the streak alive.' :
      'Small sessions compound. Start one now.';

    const subChip = s => s ? `<span class="chip" style="background:${s.color || '#6366f1'}1c;border-color:${s.color || '#6366f1'}4d">${s.icon || '📘'} ${escapeHtml(s.name)}</span>` : '';

    el.innerHTML = `
      <div class="grid g-hero">
        <section class="card hero">
          <div class="hero-left">
            <p class="hero-date">${fmtDate(t)}</p>
            <h2>${greeting()}.</h2>
            <p class="muted">${motivational}</p>
            <div class="hero-actions">
              <button class="btn primary" data-qstart>${icon('play', 18)}<span>Quick-start focus</span></button>
              <button class="btn ghost" data-newtask>${icon('plus', 16)}<span>New task</span></button>
            </div>
            ${activeTask ? `<p class="hero-active">Now: ${subChip(data.subjects.find(s => s.id === activeTask.subjectId))} <b>${escapeHtml(activeTask.title)}</b></p>`
              : activeSub ? `<p class="hero-active">Continuing ${subChip(activeSub)}</p>` : ''}
          </div>
          <div class="hero-ring" role="img" aria-label="${pct}% of daily goal">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" class="r-bg"/>
              <circle cx="60" cy="60" r="50" class="r-fg accent" stroke-dasharray="${2 * Math.PI * 50}" stroke-dashoffset="${2 * Math.PI * 50 * (1 - pct / 100)}" transform="rotate(-90 60 60)"/>
            </svg>
            <div class="hero-ring-txt"><b>${pct}%</b><span>${fmtMin(todayMin)} / ${fmtMin(goals.dailyMin)}</span></div>
          </div>
        </section>
      </div>

      <div class="grid g-stats">
        <div class="card stat"><span class="stat-ic si-a">${icon('timer', 20)}</span><div><b>${fmtMin(todayMin)}</b><span>Focused today</span></div></div>
        <div class="card stat"><span class="stat-ic si-b">${icon('sparkle', 20)}</span><div><b>${tSes.length}</b><span>Pomodoros today</span></div></div>
        <div class="card stat"><span class="stat-ic si-c">${icon('check', 20)}</span><div><b>${doneToday}</b><span>Tasks completed</span></div></div>
        <div class="card stat"><span class="stat-ic si-d">${icon('flame', 20)}</span><div><b>${streak} ${streak === 1 ? 'day' : 'days'}</b><span>Current streak</span></div></div>
      </div>

      <div class="grid g-two">
        <section class="card">
          <div class="card-head"><h3>This week</h3><span class="muted">${fmtMin(week.reduce((a, b) => a + b.m, 0))} total</span></div>
          <div id="wkChart" class="chart-box"></div>
        </section>
        <section class="card">
          <div class="card-head"><h3>Upcoming tasks</h3><span class="muted">${pending} pending${overdue ? ` · ${overdue} overdue` : ''}</span></div>
          <div class="up-list">
            ${upcoming.length ? upcoming.map(x => {
              const sub = data.subjects.find(s => s.id === x.subjectId);
              const over = isOverdue(x);
              return `<div class="up-row">
                <input type="checkbox" class="cbx" data-donetask="${x.id}" aria-label="Complete task" ${x.status === 'done' ? 'checked' : ''}>
                <div class="up-main"><b class="${x.status === 'done' ? 'strike' : ''}">${escapeHtml(x.title)}</b>
                  <span class="up-meta">${subChip(sub)} ${x.dueDate ? `<span class="pill ${over ? 'overdue' : 'due'}">${over ? 'Overdue · ' : 'Due '}${fmtDate(x.dueDate)}</span>` : ''}</span></div>
                <button class="icon-btn" data-focus="${x.id}" title="Start focus on this task" aria-label="Start focus">${icon('play', 15)}</button>
              </div>`;
            }).join('') : `<div class="empty small"><p>Nothing scheduled this week. Add a task to plan your study.</p></div>`}
          </div>
        </section>
      </div>`;

    barChart($('#wkChart', el), {
      labels: week.map(w => new Date(w.d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' })),
      series: [{ name: 'Focus', color: 'var(--accent)', values: week.map(w => w.m) }],
    });
  }
}