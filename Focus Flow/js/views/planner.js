import { $, $$, escapeHtml, todayStr, fmtDate, fmtDateFull, monthName, WEEKDAYS, parseDate, localDateStr, isOverdue, priorityRank, PRIORITIES } from '../utils.js';
import { data } from '../store.js';
import { icon, toast, openModal } from '../components.js';
import { openTaskForm } from './tasks.js';

const state = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth(), sel: todayStr() }; })();

export function mount(el, app) {
  const un = data.subscribe(t => { if (['ready', 'tasks', 'subjects', 'import', 'clear', 'settings'].includes(t)) render(); });
  el.innerHTML = `
    <div class="planner">
      <section class="card cal-card">
        <div class="cal-head">
          <h3 data-month></h3>
          <div class="cal-nav">
            <button class="icon-btn" data-prev aria-label="Previous month">${icon('chevL', 16)}</button>
            <button class="btn ghost sm" data-today>Today</button>
            <button class="icon-btn" data-next aria-label="Next month">${icon('chevR', 16)}</button>
          </div>
        </div>
        <div class="cal-grid" data-grid></div>
      </section>
      <section class="card day-card">
        <h3 data-daytitle></h3>
        <div data-daylist class="day-list"></div>
        <h4 class="sect">Quick add for this day</h4>
        <form data-qform class="qform">
          <input name="title" class="input" placeholder="Task title…" required minlength="2" autocomplete="off">
          <select name="subject" class="select" aria-label="Subject"></select>
          <select name="priority" class="select" aria-label="Priority">${PRIORITIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          <button class="btn primary" type="submit">${icon('plus', 15)}</button>
        </form>
        <div data-overdue class="overdue-box"></div>
        <div data-next3 class="next3"></div>
      </section>
    </div>`;

  el.addEventListener('click', e => {
    if (e.target.closest('[data-prev]')) { state.m--; if (state.m < 0) { state.m = 11; state.y--; } render(); return; }
    if (e.target.closest('[data-next]')) { state.m++; if (state.m > 11) { state.m = 0; state.y++; } render(); return; }
    if (e.target.closest('[data-today]')) { const d = new Date(); state.y = d.getFullYear(); state.m = d.getMonth(); state.sel = todayStr(); render(); return; }
    const day = e.target.closest('[data-day]');
    if (day) { state.sel = day.dataset.day; render(); return; }
    const done = e.target.closest('[data-done]');
    if (done) { const t = data.tasks.find(x => x.id === done.dataset.done); if (t) data.saveTask({ ...t, status: 'done', completedAt: Date.now() }).then(() => toast('Task completed')); return; }
    const edit = e.target.closest('[data-edit]');
    if (edit) { openTaskForm(data.tasks.find(x => x.id === edit.dataset.edit)); return; }
    const focus = e.target.closest('[data-focus]');
    if (focus) { const t = data.tasks.find(x => x.id === focus.dataset.focus); if (t) app.quickStartWith(t.subjectId, t.id); }
  });
  el.querySelector('[data-qform]').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, title = f.title.value.trim();
    if (title.length < 2) { toast('Enter a task title.', 'error'); return; }
    data.saveTask({ title, description: '', subjectId: f.subject.value || null, priority: f.priority.value, dueDate: state.sel, dueTime: null, estimatePomodoros: 1, status: 'todo', tags: [], completedAt: null })
      .then(() => { toast('Task scheduled'); f.title.value = ''; });
  });

  function render() {
    el.querySelector('[data-month]').textContent = monthName(state.y, state.m);
    el.querySelector('[data-daytitle]').textContent = fmtDateFull(parseDate(state.sel).getTime());
    const ws = data.settings.weekStart || 0;
    const first = new Date(state.y, state.m, 1);
    const lead = (first.getDay() - ws + 7) % 7;
    const dim = new Date(state.y, state.m + 1, 0).getDate();
    const byDay = {};
    for (const t of data.tasks) if (t.dueDate) (byDay[t.dueDate] ||= []).push(t);
    const wd = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(ws + i) % 7]);
    let cells = wd.map(w => `<div class="cal-wd">${w}</div>`).join('');
    const t = todayStr();
    for (let i = 0; i < lead; i++) cells += `<div class="cal-cell muted"></div>`;
    for (let d = 1; d <= dim; d++) {
      const key = localDateStr(new Date(state.y, state.m, d).getTime());
      const list = byDay[key] || [];
      const dots = list.slice(0, 3).map(x => {
        const s = data.subjects.find(z => z.id === x.subjectId);
        return `<i class="dot" style="background:${s ? s.color : ({ urgent: '#ef4444', high: '#f59e0b', medium: '#5b5fe8', low: '#8b8fa8' }[x.priority] || '#8b8fa8')}"></i>`;
      }).join('') + (list.length > 3 ? `<i class="dot more">+${list.length - 3}</i>` : '');
      cells += `<div class="cal-cell ${key === t ? 'today' : ''} ${key === state.sel ? 'selected' : ''} ${list.some(isOverdue) && key < t ? 'has-overdue' : ''}" data-day="${key}" role="button" tabindex="0" aria-label="${key}, ${list.length} tasks"><span>${d}</span><span class="dots">${dots}</span></div>`;
    }
    const trail = (7 - ((lead + dim) % 7)) % 7;
    for (let i = 0; i < trail; i++) cells += `<div class="cal-cell muted"></div>`;
    el.querySelector('[data-grid]').innerHTML = cells;
    el.querySelector('[data-grid]').onkeydown = e => { if (e.key === 'Enter') { const c = e.target.closest('[data-day]'); if (c) { state.sel = c.dataset.day; render(); } } };

    const dayTasks = (byDay[state.sel] || []).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
    el.querySelector('[data-daylist]').innerHTML = dayTasks.length ? dayTasks.map(x => {
      const sub = data.subjects.find(s => s.id === x.subjectId);
      return `<div class="day-row ${x.status === 'done' ? 'is-done' : ''}">
        <input type="checkbox" class="cbx" data-done="${x.id}" ${x.status === 'done' ? 'checked' : ''} aria-label="Complete">
        <div class="grow"><b>${escapeHtml(x.title)}</b><span class="pill p-${x.priority}">${x.priority}</span>${sub ? ` <span class="muted small">${sub.icon || ''} ${escapeHtml(sub.name)}</span>` : ''}</div>
        <button class="icon-btn" data-focus="${x.id}" title="Focus" aria-label="Focus">${icon('play', 14)}</button>
        <button class="icon-btn" data-edit="${x.id}" title="Edit" aria-label="Edit">${icon('edit', 14)}</button>
      </div>`;
    }).join('') : '<p class="muted small">Nothing scheduled. Use quick add below.</p>';

    el.querySelector('[data-qform] select[name=subject]').innerHTML =
      `<option value="">No subject</option>` + data.subjects.filter(s => !s.archived).map(s => `<option value="${s.id}">${s.icon || ''} ${escapeHtml(s.name)}</option>`).join('');

    const overdue = data.tasks.filter(isOverdue).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
    el.querySelector('[data-overdue]').innerHTML = overdue.length
      ? `<h4 class="sect"><span class="pill overdue">Overdue</span></h4>` + overdue.map(x =>
        `<div class="day-row"><span class="overdue-txt small">${fmtDate(x.dueDate)}</span><b>${escapeHtml(x.title)}</b>
          <button class="icon-btn" data-focus="${x.id}" title="Focus" aria-label="Focus">${icon('play', 14)}</button>
          <button class="icon-btn" data-done="${x.id}" title="Mark done" aria-label="Mark done">${icon('check', 14)}</button></div>`).join('')
      : '';
    const next = [1, 2, 3].map(i => localDateStr(new Date(Date.now() + i * 86400000).getTime()));
    el.querySelector('[data-next3]').innerHTML =
      `<h4 class="sect">Next 3 days</h4>` + next.map(d => {
        const list = byDay[d] || [];
        return `<div class="next-row"><b>${fmtDate(d)}</b><span class="muted small">${list.length ? list.slice(0, 2).map(x => escapeHtml(x.title)).join(' · ') + (list.length > 2 ? ` +${list.length - 2}` : '') : '—'}</span></div>`;
      }).join('');
  }
  render();
  return un;
}