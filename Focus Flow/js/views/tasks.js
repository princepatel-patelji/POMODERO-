import { $, $$, escapeHtml, fmtMin, clamp, todayStr, fmtDate, PRIORITIES, priorityRank, parseTags, isOverdue } from '../utils.js';
import { data } from '../store.js';
import { icon, toast, openModal, confirm, emptyState } from '../components.js';

/* Shared task form — usable from Tasks, Subjects, Dashboard, Planner */
export function openTaskForm(task, prefill = {}) {
  const t = task || {};
  const subjOpts = data.subjects.filter(s => !s.archived).map(s =>
    `<option value="${s.id}" ${t.subjectId === s.id || prefill.subjectId === s.id ? 'selected' : ''}>${s.icon || ''} ${escapeHtml(s.name)}</option>`).join('');
  const STATUS_L = { todo: 'To do', progress: 'In progress', done: 'Completed' };
  const status = t.status || 'todo';
  openModal({
    title: t.id ? 'Edit task' : 'New task', wide: true,
    body: `<form id="tf" class="form" novalidate>
      <label class="field"><span>Title *</span><input name="title" class="input" maxlength="120" value="${escapeHtml(t.title || '')}" required autocomplete="off"></label>
      <label class="field"><span>Description</span><textarea name="description" class="textarea" rows="3">${escapeHtml(t.description || '')}</textarea></label>
      <div class="frow">
        <label class="field"><span>Subject</span><select name="subjectId" class="select"><option value="">No subject</option>${subjOpts}</select></label>
        <label class="field"><span>Priority</span><select name="priority" class="select">${PRIORITIES.map(([v, l]) => `<option value="${v}" ${(t.priority || prefill.priority || 'medium') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <div class="frow">
        <label class="field"><span>Due date</span><input type="date" name="dueDate" class="input" value="${t.dueDate || prefill.dueDate || ''}"></label>
        <label class="field"><span>Due time</span><input type="time" name="dueTime" class="input" value="${t.dueTime || ''}"></label>
        <label class="field"><span>Est. sessions</span><input type="number" name="estimate" min="0" max="30" class="input" value="${t.estimatePomodoros ?? 1}"></label>
      </div>
      <div class="frow">
        <label class="field"><span>Status</span><select name="status" class="select">${Object.entries(STATUS_L).map(([v, l]) => `<option value="${v}" ${status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Tags (comma separated)</span><input name="tags" class="input" value="${escapeHtml((t.tags || []).join(', '))}" autocomplete="off"></label>
      </div>
    </form>`,
    actions: [
      { label: 'Cancel' },
      { label: t.id ? 'Save changes' : 'Add task', kind: 'primary', onClick: close => saveForm(close) },
    ],
  });

  function saveForm(close) {
    const f = $('#tf');
    const fd = new FormData(f);
    const title = String(fd.get('title') || '').trim();
    if (title.length < 2) { toast('Give the task a title (at least 2 characters).', 'error'); f.title.focus(); return; }
    const newStatus = fd.get('status');
    const payload = {
      ...t,
      title,
      description: String(fd.get('description') || '').trim(),
      subjectId: fd.get('subjectId') || null,
      priority: fd.get('priority'),
      dueDate: fd.get('dueDate') || null,
      dueTime: fd.get('dueTime') || null,
      estimatePomodoros: clamp(parseInt(fd.get('estimate'), 10) || 0, 0, 30),
      status: newStatus,
      tags: parseTags(fd.get('tags')),
    };
    if (newStatus === 'done' && status !== 'done') payload.completedAt = Date.now();
    else if (newStatus !== 'done') payload.completedAt = null;
    close();
    data.saveTask(payload)
      .then(() => toast(t.id ? 'Task updated' : 'Task added'))
      .catch(e => toast('Could not save task: ' + e.message, 'error'));
  }
}

const state = { q: '', subject: 'all', priority: 'all', status: 'all', sort: 'priority', view: localStorage.getItem('ff-taskview') || 'list' };

export function mount(el, app) {
  const un = data.subscribe(t => {
    if (['ready', 'tasks', 'subjects', 'sessions', 'import', 'clear'].includes(t)) renderBody();
  });
  el.innerHTML = `
    <div class="toolbar">
      <label class="search"><span>${icon('search', 15)}</span><input data-q class="input" placeholder="Search tasks…" value="${escapeHtml(state.q)}" aria-label="Search tasks"></label>
      <select data-fsub class="select" aria-label="Filter by subject"><option value="all">All subjects</option>${data.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
      <select data-fpri class="select" aria-label="Filter by priority"><option value="all">All priorities</option>${PRIORITIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <select data-fstat class="select" aria-label="Filter by status"><option value="all">All statuses</option><option value="todo">To do</option><option value="progress">In progress</option><option value="overdue">Overdue</option><option value="done">Completed</option></select>
      <select data-sort class="select" aria-label="Sort tasks"><option value="priority">Sort: priority</option><option value="due">Sort: due date</option><option value="created">Sort: newest</option><option value="subject">Sort: subject</option></select>
      <div class="seg mini" role="group" aria-label="View">
        <button data-v="list" title="List view" aria-label="List view">${icon('list', 16)}</button>
        <button data-v="kanban" title="Kanban view" aria-label="Kanban view">${icon('columns', 16)}</button>
      </div>
      <button class="btn primary" data-add>${icon('plus', 16)}<span>Add task</span></button>
    </div>
    <div data-body class="tasks-body"></div>`;

  el.addEventListener('input', e => { if (e.target.hasAttribute('data-q')) { state.q = e.target.value; renderBody(); } });
  for (const [attr, key] of [['data-fsub', 'subject'], ['data-fpri', 'priority'], ['data-fstat', 'status'], ['data-sort', 'sort']]) {
    el.addEventListener('change', e => { if (e.target.hasAttribute(attr)) { state[key] = e.target.value; renderBody(); } });
  }
  el.addEventListener('click', e => {
    const v = e.target.closest('[data-v]');
    if (v) { state.view = v.dataset.v; localStorage.setItem('ff-taskview', state.view); renderBody(); return; }
    if (e.target.closest('[data-add]')) { openTaskForm(null, { subjectId: state.subject !== 'all' ? state.subject : undefined }); return; }
    const idOf = sel => (x => x && x.dataset ? x.dataset.id : null)(e.target.closest(sel));
    const doneId = idOf('[data-done]');
    if (doneId) {
      const t = data.tasks.find(x => x.id === doneId);
      if (t) data.saveTask({ ...t, status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : Date.now() })
        .then(() => toast(t.status === 'done' ? 'Task reopened' : 'Task completed 🎉'));
      return;
    }
    const editId = idOf('[data-edit]'); if (editId) { openTaskForm(data.tasks.find(x => x.id === editId)); return; }
    const delId = idOf('[data-del]');
    if (delId) {
      const t = data.tasks.find(x => x.id === delId);
      confirm({ title: 'Delete task?', message: `"${t.title}" will be removed. Completed focus sessions for it stay in your history.`, label: 'Delete' })
        .then(ok => ok && data.deleteTask(delId).then(() => toast('Task deleted')));
      return;
    }
    const actId = idOf('[data-active]');
    if (actId) { app.setActive(actId); toast('Set as active task'); return; }
    const focusId = idOf('[data-focus]');
    if (focusId) { const t = data.tasks.find(x => x.id === focusId); if (t) app.quickStartWith(t.subjectId, t.id); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const t = data.tasks.find(x => x.id === mv.dataset.id);
      if (!t) return;
      const order = ['todo', 'progress', 'done'];
      const ni = clamp(order.indexOf(t.status) + (+mv.dataset.mv), 0, 2);
      const ns = order[ni];
      data.saveTask({ ...t, status: ns, completedAt: ns === 'done' ? (t.completedAt || Date.now()) : null }).then(() => toast('Moved to ' + { todo: 'To do', progress: 'In progress', done: 'Completed' }[ns]));
    }
  });
  /* Kanban drag & drop (desktop) */
  el.addEventListener('dragstart', e => { const c = e.target.closest('.kcard'); if (c) e.dataTransfer.setData('text/plain', c.dataset.id); });
  el.addEventListener('dragover', e => { const col = e.target.closest('.kcol'); if (col) { e.preventDefault(); col.classList.add('over'); } });
  el.addEventListener('dragleave', e => { e.target.closest('.kcol')?.classList.remove('over'); });
  el.addEventListener('drop', e => {
    const col = e.target.closest('.kcol'); if (!col) return;
    e.preventDefault(); col.classList.remove('over');
    const t = data.tasks.find(x => x.id === e.dataTransfer.getData('text/plain'));
    if (t && t.status !== col.dataset.status)
      data.saveTask({ ...t, status: col.dataset.status, completedAt: col.dataset.status === 'done' ? (t.completedAt || Date.now()) : null })
        .then(() => toast('Task moved'));
  });

  function filtered() {
    const subName = id => (data.subjects.find(s => s.id === id) || {}).name || '';
    let list = data.tasks.filter(t => {
      if (state.q) { const q = state.q.toLowerCase(); if (!(t.title + ' ' + (t.description || '') + ' ' + (t.tags || []).join(' ')).toLowerCase().includes(q)) return false; }
      if (state.subject !== 'all' && t.subjectId !== state.subject) return false;
      if (state.priority !== 'all' && t.priority !== state.priority) return false;
      if (state.status === 'overdue') { if (!isOverdue(t)) return false; }
      else if (state.status !== 'all' && t.status !== state.status) return false;
      return true;
    });
    const sorters = {
      priority: (a, b) => priorityRank(b.priority) - priorityRank(a.priority) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'),
      due: (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || priorityRank(b.priority) - priorityRank(a.priority),
      created: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
      subject: (a, b) => subName(a.subjectId).localeCompare(subName(b.subjectId)),
    };
    return [...list].sort(sorters[state.sort] || sorters.priority);
  }
  function renderBody() {
    $$('[data-v]', el).forEach(b => b.classList.toggle('on', b.dataset.v === state.view));
    const body = $('[data-body]', el);
    const list = filtered();
    if (!list.length) {
      body.replaceChildren(emptyState({
        icon: 'tasks', title: 'No tasks match',
        sub: state.q ? 'Try a different search or clear the filters.' : 'Add your first study task to get started.',
        actionLabel: 'Add task', onAction: () => openTaskForm(null),
      }));
      return;
    }
    const minByTask = {};
    for (const s of data.sessions) if (s.taskId) minByTask[s.taskId] = (minByTask[s.taskId] || 0) + s.durationMin;
    const subOf = id => data.subjects.find(s => s.id === id);
    const chip = s => s ? `<span class="chip" style="background:${s.color || '#6366f1'}1c;border-color:${s.color || '#6366f1'}4d">${s.icon || ''} ${escapeHtml(s.name)}</span>` : '';
    const row = t => {
      const sub = subOf(t.subjectId);
      const over = isOverdue(t);
      const act = (minByTask[t.id] || 0);
      return `<div class="card task-row ${t.status === 'done' ? 'is-done' : ''} ${t.status === 'progress' ? 'is-prog' : ''}">
        <input type="checkbox" class="cbx" data-done="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="Mark ${escapeHtml(t.title)} complete">
        <div class="task-main">
          <b class="${t.status === 'done' ? 'strike' : ''}">${escapeHtml(t.title)}</b>
          ${t.description ? `<p class="muted small clip">${escapeHtml(t.description)}</p>` : ''}
          <div class="task-meta">
            ${chip(sub)}
            <span class="pill p-${t.priority}">${t.priority}</span>
            ${t.dueDate ? `<span class="pill ${over ? 'overdue' : 'due'}">${over ? 'Overdue · ' : 'Due '}${fmtDate(t.dueDate)}${t.dueTime ? ' ' + t.dueTime : ''}</span>` : ''}
            <span class="pill est">est ${t.estimatePomodoros || 0}🍅 · actual ${fmtMin(act)}</span>
            ${(t.tags || []).map(g => `<span class="tag">#${escapeHtml(g)}</span>`).join('')}
            ${app && data.active.taskId === t.id ? '<span class="pill active-pill">active</span>' : ''}
          </div>
        </div>
        <div class="task-acts">
          <button class="icon-btn" data-focus="${t.id}" title="Start focus" aria-label="Start focus on task">${icon('play', 15)}</button>
          <button class="icon-btn" data-active="${t.id}" title="Set as active" aria-label="Set active">${icon('target', 15)}</button>
          <button class="icon-btn" data-edit="${t.id}" title="Edit" aria-label="Edit task">${icon('edit', 15)}</button>
          <button class="icon-btn danger" data-del="${t.id}" title="Delete" aria-label="Delete task">${icon('trash', 15)}</button>
        </div>
      </div>`;
    };
    if (state.view === 'list') {
      body.innerHTML = `<div class="list">${list.map(row).join('')}</div>`;
    } else {
      const col = status => {
        const items = list.filter(t => t.status === status);
        return `<div class="kcol" data-status="${status}">
          <div class="khead"><h4>${{ todo: 'To do', progress: 'In progress', done: 'Completed' }[status]}</h4><span class="count">${items.length}</span></div>
          <div class="kcards">${items.map(t => `<div class="kcard" draggable="true" data-id="${t.id}">
            <div class="kcard-top"><span class="pill p-${t.priority}">${t.priority}</span>${chip(subOf(t.subjectId))}</div>
            <b>${escapeHtml(t.title)}</b>
            ${t.dueDate ? `<span class="small ${isOverdue(t) ? 'overdue-txt' : 'muted'}">${isOverdue(t) ? 'Overdue · ' : 'Due '}${fmtDate(t.dueDate)}</span>` : ''}
            <div class="kcard-foot">
              <button class="icon-btn" data-mv="-1" data-id="${t.id}" title="Move left" aria-label="Move to previous column">${icon('chevL', 14)}</button>
              <button class="icon-btn" data-focus="${t.id}" title="Focus" aria-label="Focus">${icon('play', 14)}</button>
              <span class="pill est">🍅 ${minByTask[t.id] ? fmtMin(minByTask[t.id]) : '0m'}</span>
              <button class="icon-btn" data-mv="1" data-id="${t.id}" title="Move right" aria-label="Move to next column">${icon('chevR', 14)}</button>
            </div>
          </div>`).join('') || '<p class="muted small pad">Drop tasks here</p>'}</div>
        </div>`;
      };
      body.innerHTML = `<div class="kanban">${col('todo')}${col('progress')}${col('done')}</div>`;
    }
  }
  renderBody();
  return un;
}