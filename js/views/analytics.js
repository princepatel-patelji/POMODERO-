import { $, $$, fmtMin, fmtDate, dayOf, lastNDays, addDays, todayStr, computeStreaks, escapeHtml } from '../utils.js';
import { data } from '../store.js';
import { icon, emptyState } from '../components.js';
import { barChart, areaChart, donut } from '../charts.js';

const state = { days: 30, subject: 'all' };

export function mount(el, app) {
  const un = data.subscribe(t => { if (['ready', 'sessions', 'tasks', 'subjects', 'import', 'clear', 'settings'].includes(t)) render(); });
  el.innerHTML = `
    <div class="toolbar">
      <div class="chips" data-ranges>
        ${[[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([v, l]) => `<button class="chip-btn ${state.days === v ? 'on' : ''}" data-d="${v}">${l}</button>`).join('')}
      </div>
      <select data-fsub class="select" aria-label="Subject filter"><option value="all">All subjects</option></select>
    </div>
    <div class="grid g-stats" data-kpis></div>
    <div class="grid g-two">
      <section class="card"><div class="card-head"><h3>Daily focus time</h3></div><div class="chart-box" data-daily></div></section>
      <section class="card"><div class="card-head"><h3>Subject distribution</h3></div><div data-dist class="chart-box"></div></section>
    </div>
    <div class="grid g-two">
      <section class="card"><div class="card-head"><h3>Last 30 days trend</h3></div><div class="chart-box" data-trend></div></section>
      <section class="card"><div class="card-head"><h3>Estimated vs actual (top tasks)</h3></div><div class="chart-box" data-est></div></section>
    </div>
    <div data-empty class="hidden"></div>`;

  el.addEventListener('click', e => {
    const r = e.target.closest('[data-d]');
    if (r) { state.days = +r.dataset.d; render(); }
  });
  el.addEventListener('change', e => { if (e.target.hasAttribute('data-fsub')) { state.subject = e.target.value; render(); } });

  function render() {
    $$('[data-ranges] .chip-btn', el).forEach(b => b.classList.toggle('on', +b.dataset.d === state.days));
    el.querySelector('[data-fsub]').innerHTML = `<option value="all">All subjects</option>` +
      data.subjects.map(s => `<option value="${s.id}" ${state.subject === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');

    const days = state.days;
    const from = addDays(todayStr(), -(days - 1));
    const inSub = s => state.subject === 'all' || s.subjectId === state.subject;
    const range = data.sessions.filter(s => { const d = dayOf(s.endedAt); return d >= from && d <= todayStr() && inSub(s); });
    const daily = lastNDays(Math.min(days, 31)).map(d => ({
      d, m: data.sessions.filter(s => dayOf(s.endedAt) === d && inSub(s)).reduce((a, b) => a + b.durationMin, 0),
    }));
    const total = range.reduce((a, b) => a + b.durationMin, 0);
    const perDay = {};
    for (const s of range) perDay[dayOf(s.endedAt)] = (perDay[dayOf(s.endedAt)] || 0) + s.durationMin;
    const best = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];
    const streak = computeStreaks(data.sessions);
    const doneT = data.tasks.filter(t => t.status === 'done').length;
    const rate = data.tasks.length ? Math.round(doneT / data.tasks.length * 100) : 0;
    const goals = data.settings.goals;
    const todayMin = data.sessions.filter(s => dayOf(s.endedAt) === todayStr()).reduce((a, b) => a + b.durationMin, 0);

    const empty = range.length === 0;
    el.querySelector('[data-empty]').classList.toggle('hidden', !empty);
    if (empty) el.querySelector('[data-empty]').replaceChildren(
      emptyState({ icon: 'chart', title: 'Not enough data yet', sub: 'Complete a few focus sessions and your analytics will build automatically — no fake numbers, ever.' }));

    el.querySelector('[data-kpis]').innerHTML = `
      <div class="card stat"><span class="stat-ic si-a">${icon('timer', 20)}</span><div><b>${fmtMin(total)}</b><span>Focused (${days}d)</span></div></div>
      <div class="card stat"><span class="stat-ic si-b">${icon('sparkle', 20)}</span><div><b>${range.length}</b><span>Sessions</span></div></div>
      <div class="card stat"><span class="stat-ic si-c">${icon('chart', 20)}</span><div><b>${fmtMin(total / days)}</b><span>Avg / day</span></div></div>
      <div class="card stat"><span class="stat-ic si-d">${icon('flag', 20)}</span><div><b>${best ? fmtDate(best[0]) : '—'}</b><span>Best day ${best ? '(' + fmtMin(best[1]) + ')' : ''}</span></div></div>
      <div class="card stat"><span class="stat-ic si-e">${icon('flame', 20)}</span><div><b>${streak.longest}</b><span>Longest streak</span></div></div>
      <div class="card stat"><span class="stat-ic si-f">${icon('target', 20)}</span><div><b>${Math.min(100, Math.round(todayMin / Math.max(1, goals.dailyMin) * 100))}%</b><span>Today's goal</span></div></div>
      <div class="card stat"><span class="stat-ic si-b">${icon('check', 20)}</span><div><b>${rate}%</b><span>Tasks completed</span></div></div>
      <div class="card stat"><span class="stat-ic si-c">${icon('history', 20)}</span><div><b>${streak.current}d</b><span>Current streak</span></div></div>`;

    if (!empty) {
      barChart(el.querySelector('[data-daily]'), {
        labels: daily.map(x => x.d.slice(5).replace('-', '/')),
        series: [{ name: 'Focus', color: 'var(--accent)', values: daily.map(x => x.m) }],
      });
      donut(el.querySelector('[data-dist]'), {
        items: data.subjects.filter(s => state.subject === 'all' || s.id === state.subject).map(s => ({
          label: s.name, color: s.color || '#6366f1',
          value: data.sessions.filter(x => dayOf(x.endedAt) >= from && x.subjectId === s.id).reduce((a, b) => a + b.durationMin, 0),
        })),
        centerTop: fmtMin(total), centerSub: 'total',
      });
    } else {
      el.querySelector('[data-daily]').innerHTML = '';
      el.querySelector('[data-dist]').innerHTML = '<div class="empty small"><p>No data yet</p></div>';
    }
    const last30 = lastNDays(30);
    areaChart(el.querySelector('[data-trend]'), {
      labels: last30.map(d => d.slice(5).replace('-', '/')),
      values: last30.map(d => data.sessions.filter(s => dayOf(s.endedAt) === d && inSub(s)).reduce((a, b) => a + b.durationMin, 0)),
    });
    /* estimated vs actual for top tasks (all subjects for fairness) */
    const minByTask = {};
    for (const s of data.sessions) if (s.taskId) minByTask[s.taskId] = (minByTask[s.taskId] || 0) + s.durationMin;
    const top = data.tasks.filter(t => t.id && (minByTask[t.id] || 0) > 0).sort((a, b) => (minByTask[b.id] || 0) - (minByTask[a.id] || 0)).slice(0, 5);
    if (top.length) {
      barChart(el.querySelector('[data-est]'), {
        labels: top.map(t => t.title.length > 14 ? t.title.slice(0, 13) + '…' : t.title),
        series: [
          { name: 'Estimated', color: 'var(--accent2)', values: top.map(t => (t.estimatePomodoros || 0) * data.settings.durations.focus) },
          { name: 'Actual', color: 'var(--ok)', values: top.map(t => minByTask[t.id] || 0) },
        ],
      });
    } else el.querySelector('[data-est]').innerHTML = '<div class="empty small"><p>Track tasks with focus sessions to see this.</p></div>';
  }
  render();
  return un;
}