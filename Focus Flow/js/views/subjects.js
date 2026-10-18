import { $, escapeHtml, fmtMin, dayOf, fmtDate, fmtTime } from '../utils.js';
import { data } from '../store.js';
import { icon, toast, openModal, emptyState } from '../components.js';
import { openTaskForm } from './tasks.js';

const COLORS = ['#5b5fe8', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#84cc16', '#14b8a6', '#f97316', '#6366f1', '#a855f7'];
const EMOJIS = ['📘', '📐', '🧲', '🧪', '💻', '📖', '⚙️', '🏆', '🎯', '📚', '🔬', '🧠'];

function openSubjectForm(sub, app) {
  const s = sub || {};
  openModal({
    title: s.id ? 'Edit subject' : 'New subject',
    wide: true,
    body: `<form id="sf" class="form" novalidate>
      <div class="frow">
        <label class="field grow"><span>Name *</span><input name="name" class="input" maxlength="60" value="${escapeHtml(s.name || '')}" required placeholder="e.g. Mathematics"></label>
        <label class="field"><span>Daily target (min)</span><input type="number" name="target" min="0" max="960" class="input" value="${s.dailyTargetMin ?? data.settings.goals.dailyMin}"></label>
      </div>
      <label class="field"><span>Description</span><input name="desc" class="input" maxlength="140" value="${escapeHtml(s.description || '')}" placeholder="Optional"></label>
      <div class="frow">
        <div class="field"><span>Color</span><div class="swatches" data-swatch>
          ${COLORS.map(c => `<button type="button" data-c="${c}" class="swatch ${s.color === c ? 'on' : ''}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
          <input type="color" name="color" value="${s.color || COLORS[0]}" class="swatch-custom" aria-label="Custom color">
        </div></div>
        <div class="field"><span>Icon</span><div class="emojis" data-emoji>
          ${EMOJIS.map(e => `<button type="button" data-e="${e}" class="emoji ${s.icon === e ? 'on' : ''}">${e}</button>`).join('')}
        </div></div>
      </div>
    </form>`,
    actions: [
      { label: 'Cancel' },
      { label: s.id ? 'Save changes' : 'Add subject', kind: 'primary', onClick: close => save(close) },
    ],
  });
  const form = $('#sf');
  form.querySelector('[data-swatch]').addEventListener('click', e => {
    const b = e.target.closest('.swatch'); if (!b) return;
    form.color.value = b.dataset.c;
    $$('.swatch', form).forEach(x => x.classList.toggle('on', x === b));
  });
  form.querySelector('[data-emoji]').addEventListener('click', e => {
    const b = e.target.closest('.emoji'); if (!b) return;
    form.dataset.icon = b.dataset.e;
    $$('.emoji', form).forEach(x => x.classList.toggle('on', x === b));
  });
  form.color.addEventListener('input', e => $$('.swatch', form).forEach(x => x.classList.remove('on')));
  function save(close) {
    const name = form.name.value.trim();
    if (name.length < 2) { toast('Subject needs a name.', 'error'); form.name.focus(); return; }
    const payload = { ...s, name, description: form.desc.value.trim(), color: form.color.value, icon: form.dataset.icon || EMOJIS[0], dailyTargetMin: Math.max(0, parseInt(form.target.value, 10) || 0) };
    close();
    data.saveSubject(payload).then(() => toast(s.id ? 'Subject updated' : 'Subject added')).catch(e => toast('Could not save subject: ' + e.message, 'error'));
  }
}

export function mount(el, app) {
  const un = data.subscribe(t => { if (['ready', 'subjects', 'tasks', 'sessions', 'import', 'clear'].includes(t)) render(); });
  el.innerHTML = `
    <div class="toolbar">
      <label class="search grow"><span>${icon('search', 15)}</span><input data-q class="input" placeholder="Search subjects…" aria-label="Search subjects"></label>
      <button class="btn primary" data-add>${icon('plus', 16)}<span>Add subject</span></button>
    </div>
    <div data-body class="subj-grid"></div>`;
  let q = '';
  el.addEventListener('input', e => { if (e.target.hasAttribute('data-q')) { q = e.target.value.toLowerCase(); render(); } });
  el.addEventListener('click', e => {
    if (e.target.closest('[data-add]')) { openSubjectForm(null, app); return; }
    const id = x => x && x.dataset.id;
    const editId = id(e.target.closest('[data-edit]'));
    if (editId) { openSubjectForm(data.subjects.find(s => s.id === editId), app); return; }
    const arcId = id(e.target.closest('[data-arc]'));
    if (arcId) { const s = data.subjects.find(x => x.id === arcId); data.saveSubject({ ...s, archived: !s.archived }).then(() => toast(s.archived ? 'Subject restored' : 'Subject archived')); return; }
    const delId = id(e.target.closest('[data-del]'));
    if (delId) { delModal(delId); return; }
    const viewId = id(e.target.closest('[data-view]'));
    if (viewId) { viewModal(viewId); return; }
    const nt = e.target.closest('[data-newtask]');
    if (nt) { openTaskForm(null, { subjectId: nt.dataset.newtask }); return; }
  });

  function delModal(id) {
    const s = data.subjects.find(x => x.id === id);
    openModal({
      title: `Delete "${s.name}"?`,
      body: `<p class="muted">Its tasks are kept but become <b>unassigned</b>. Study history is preserved (the subject name is stored inside each session) so your stats stay accurate.</p>
        <label class="checkline danger-line"><input type="checkbox" id="alsoSes"><span>Also permanently delete its ${data.sessions.filter(x => x.subjectId === id).length} recorded sessions</span></label>`,
      actions: [
        { label: 'Cancel' },
        { label: 'Delete subject', kind: 'danger', onClick: close => { close(); data.deleteSubject(id, $('#alsoSes').checked).then(() => toast('Subject deleted')); } },
      ],
    });
  }
  function viewModal(id) {
    const s = data.subjects.find(x => x.id === id);
    const ss = data.sessions.filter(x => x.subjectId === id).sort((a, b) => b.endedAt - a.endedAt);
    const tasks = data.tasks.filter(t => t.subjectId === id && t.status !== 'done');
    openModal({
      title: `${s.icon || ''} ${s.name}`, wide: true,
      body: `<div class="detail-grid">
        <div class="card mini-stat"><b>${fmtMin(ss.reduce((a, b) => a + b.durationMin, 0))}</b><span>Total focused</span></div>
        <div class="card mini-stat"><b>${ss.length}</b><span>Sessions</span></div>
        <div class="card mini-stat"><b>${tasks.length}</b><span>Open tasks</span></div>
        <div class="card mini-stat"><b>${s.dailyTargetMin || 0}m</b><span>Daily target</span></div>
      </div>
      <h4 class="sect">Recent sessions</h4>
      ${ss.slice(0, 8).map(x => `<div class="h-row"><span class="small muted">${fmtDate(dayOf(x.endedAt))} · ${fmtTime(x.endedAt)}</span><b>${x.durationMin}m</b>${x.taskTitle ? `<span class="muted small">${escapeHtml(x.taskTitle)}</span>` : '<span class="muted small">—</span>'}</div>`).join('') || '<p class="muted">No sessions recorded yet.</p>'}
      <h4 class="sect">Open tasks</h4>
      ${tasks.slice(0, 6).map(t => `<div class="h-row"><b class="${t.status === 'done' ? 'strike' : ''}">${escapeHtml(t.title)}</b><span class="pill p-${t.priority}">${t.priority}</span></div>`).join('') || '<p class="muted">No open tasks.</p>'}
      <div class="ctx-foot"><button class="btn primary sm" data-newtask="${s.id}">${icon('plus', 15)}<span>New task in this subject</span></button></div>`,
    });
  }

  function render() {
    const body = $('[data-body]', el);
    const list = data.subjects.filter(s => !q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
    if (!list.length) {
      body.replaceChildren(emptyState({
        icon: 'book', title: q ? 'No subjects match' : 'No subjects yet',
        sub: 'Add the subjects you study — Mathematics, Physics, Programming, Exam Prep…',
        actionLabel: 'Add subject', onAction: () => openSubjectForm(null, app),
      }));
      return;
    }
    body.innerHTML = list.map(s => {
      const ss = data.sessions.filter(x => x.subjectId === s.id);
      const tasks = data.tasks.filter(t => t.subjectId === s.id);
      return `<div class="card s-card ${s.archived ? 'archived' : ''}" style="--sc:${s.color || '#6366f1'}">
        <div class="s-top">
          <span class="s-ic">${s.icon || '📘'}</span>
          <div class="grow"><h3>${escapeHtml(s.name)} ${s.archived ? '<span class="pill archived-pill">archived</span>' : ''}</h3>
            ${s.description ? `<p class="muted small clip">${escapeHtml(s.description)}</p>` : ''}</div>
        </div>
        <div class="s-stats">
          <div><b>${fmtMin(ss.reduce((a, b) => a + b.durationMin, 0))}</b><span>focused</span></div>
          <div><b>${ss.length}</b><span>sessions</span></div>
          <div><b>${tasks.filter(t => t.status !== 'done').length}</b><span>open tasks</span></div>
          <div><b>${s.dailyTargetMin || 0}m</b><span>daily goal</span></div>
        </div>
        <div class="s-actions">
          <button class="btn ghost sm" data-view="${s.id}">${icon('eye', 14)}<span>Details</span></button>
          <button class="icon-btn" data-edit="${s.id}" title="Edit" aria-label="Edit subject">${icon('edit', 15)}</button>
          <button class="icon-btn" data-arc="${s.id}" title="${s.archived ? 'Restore' : 'Archive'}" aria-label="Archive subject">${icon('archive', 15)}</button>
          <button class="icon-btn danger" data-del="${s.id}" title="Delete" aria-label="Delete subject">${icon('trash', 15)}</button>
        </div>
      </div>`;
    }).join('');
  }
  render();
  return un;
}