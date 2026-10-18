import { $, $$, download, toCSV, dayOf } from '../utils.js';
import { data, DEFAULT_SETTINGS } from '../store.js';
import { timer } from '../timer.js';
import { notify } from '../notify.js';
import { icon, toast, openModal, confirm } from '../components.js';

export function mount(el) {
  el.innerHTML = `
  <div class="settings-grid">
    <section class="card set-card">
      <h3>${icon('sun', 17)} Appearance</h3>
      <div class="theme-row" role="group" aria-label="Theme">
        <button class="theme-btn" data-t="light"><span>☀️</span>Light</button>
        <button class="theme-btn" data-t="dark"><span>🌙</span>Dark</button>
        <button class="theme-btn" data-t="auto"><span>⚡</span>Auto</button>
      </div>
      <label class="field"><span>Week starts on</span>
        <select data-week class="select"><option value="0">Sunday</option><option value="1">Monday</option></select></label>
    </section>

    <section class="card set-card">
      <h3>${icon('timer', 17)} Pomodoro durations</h3>
      <div class="frow">
        <label class="field"><span>Focus (min)</span><input type="number" data-d="focus" class="input" min="1" max="180"></label>
        <label class="field"><span>Short break</span><input type="number" data-d="short" class="input" min="1" max="60"></label>
        <label class="field"><span>Long break</span><input type="number" data-d="long" class="input" min="1" max="120"></label>
        <label class="field"><span>Long after</span><input type="number" data-d="longAfter" class="input" min="2" max="12"></label>
      </div>
      <p class="tiny muted">Running timer apni length rakhta hai; new sessions in settings ka use karti hain. <button class="linklike" data-resetdurs>Reset to defaults</button></p>
    </section>

    <section class="card set-card">
      <h3>${icon('target', 17)} Goals</h3>
      <div class="frow">
        <label class="field"><span>Daily focus (min)</span><input type="number" data-g="dailyMin" class="input" min="0" max="1440"></label>
        <label class="field"><span>Daily sessions</span><input type="number" data-g="dailyPomodoros" class="input" min="0" max="30"></label>
        <label class="field"><span>Weekly target (min)</span><input type="number" data-g="weeklyMin" class="input" min="0" max="20000"></label>
      </div>
      <p class="tiny muted">Goals badalne se history kabhi rewrite nahi hoti — purane din apne results rakhte hain.</p>
    </section>

    <section class="card set-card">
      <h3>${icon('bell', 17)} Sound &amp; notifications</h3>
      <label class="checkline"><input type="checkbox" data-snd="complete"><span>Completion chime</span></label>
      <label class="checkline"><input type="checkbox" data-snd="break"><span>Break-end sound</span></label>
      <label class="checkline"><input type="checkbox" data-snd="reminder"><span>Reminder before focus ends
        <select data-remin class="select mini-sel"><option value="30">30s</option><option value="60">60s</option><option value="120">2 min</option></select></span></label>
      <label class="checkline"><input type="checkbox" data-snd="ambience"><span>Ambient hum while studying</span></label>
      <div class="btn-row"><button class="btn ghost sm" data-test>${icon('bell', 14)}<span>Test sound</span></button></div>
      <hr class="sep">
      <label class="checkline"><input type="checkbox" data-noti="enabled"><span>Browser notifications</span></label>
      <p class="tiny muted" data-nstatus></p>
      <button class="btn ghost sm" data-nreq>${icon('bell', 14)}<span>Enable notifications</span></button>
      <label class="checkline"><input type="checkbox" data-noti="autoTransition"><span>Auto-transition to the next session (optional)</span></label>
      <label class="checkline"><input type="checkbox" data-st="restoreTimer"><span>Restore a running timer when the app reopens</span></label>
    </section>

    <section class="card set-card">
      <h3>${icon('download', 17)} Data &amp; backup</h3>
      <p class="tiny muted">Saara data is browser mein locally (IndexedDB) hai. Koi account ya cloud sync nahi — device badalne se pehle export zaroor karo.</p>
      <div class="btn-row">
        <button class="btn ghost" data-export>${icon('download', 15)}<span>Export JSON backup</span></button>
        <button class="btn ghost" data-csv>${icon('download', 15)}<span>Export history CSV</span></button>
        <button class="btn ghost" data-csvt>${icon('download', 15)}<span>Export tasks CSV</span></button>
      </div>
      <div class="btn-row">
        <label class="btn ghost" for="ffimp">${icon('upload', 15)}<span>Import backup…</span></label>
        <input type="file" id="ffimp" accept="application/json,.json" hidden>
      </div>
    </section>

    <section class="card set-card danger-zone">
      <h3>${icon('alert', 17)} Danger zone</h3>
      <div class="btn-row">
        <button class="btn ghost" data-resetall>${icon('reset', 15)}<span>Reset timer &amp; settings to defaults</span></button>
        <button class="btn danger" data-clear>${icon('trash', 15)}<span>Erase all data</span></button>
      </div>
      <p class="tiny muted">In actions ko undo nahi kiya ja sakta.</p>
    </section>

    <section class="card set-card about">
      <h3>${icon('sparkle', 17)} About FocusFlow</h3>
      <p class="muted small">Study smart. Focus deep. Achieve more. Ek local-first Pomodoro study planner — timer, tasks, subjects, planner, history aur analytics. Offline-ready aur PWA-installable.</p>
      <p class="tiny muted">Version 1.0 · Data device se bahar kabhi nahi jaata.</p>
    </section>
  </div>`;

  const st = () => data.settings;
  const clampInt = (inp, min, max) => {
    let v = parseInt(inp.value, 10) || min;
    v = Math.max(min, Math.min(max, v));
    inp.value = v;
    return v;
  };

  function sync() {
    const s = st();
    $$('[data-t]', el).forEach(b => b.classList.toggle('on', b.dataset.t === s.theme));
    el.querySelector('[data-week]').value = String(s.weekStart);
    $$('[data-d]', el).forEach(i => i.value = s.durations[i.dataset.d]);
    $$('[data-g]', el).forEach(i => i.value = s.goals[i.dataset.g]);
    $$('[data-snd]', el).forEach(i => i.checked = !!s.sounds[i.dataset.snd]);
    el.querySelector('[data-remin]').value = String(s.sounds.reminderSec);
    $$('[data-noti]', el).forEach(i => i.checked = !!s.notifications[i.dataset.noti]);
    el.querySelector('[data-st]').checked = !!s.startup.restoreTimer;
    const ps = notify.permission();
    el.querySelector('[data-nstatus]').textContent =
      ps === 'unsupported' ? 'Notifications is browser mein supported nahi hain.' :
      ps === 'granted' ? 'Notifications isi site ke liye enabled hain.' :
      ps === 'denied' ? 'Notifications blocked hain — browser site settings mein allow karo.' :
      'Session-end alerts ke liye “Enable notifications” click karo.';
  }

  function exportCSV(kind) {
    const today = new Date().toISOString().slice(0, 10);
    if (kind === 'sessions') {
      const rows = data.sessions.slice().sort((a, b) => a.endedAt - b.endedAt).map(s => ({
        date: dayOf(s.endedAt), start: new Date(s.startedAt).toLocaleString(), end: new Date(s.endedAt).toLocaleString(),
        duration_min: s.durationMin, type: s.type,
        subject: (data.subjects.find(x => x.id === s.subjectId) || {}).name || s.subjectName,
        task: s.taskTitle || '', completed: s.completed ? 'yes' : 'no',
      }));
      download(`focusflow-history-${today}.csv`, toCSV(rows), 'text/csv');
      toast('History CSV exported');
    } else {
      const rows = data.tasks.slice().sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).map(t => ({
        title: t.title, description: t.description || '',
        subject: (data.subjects.find(x => x.id === t.subjectId) || {}).name || '',
        priority: t.priority, status: t.status,
        due_date: t.dueDate || '', due_time: t.dueTime || '',
        estimate_sessions: t.estimatePomodoros, tags: (t.tags || []).join('; '),
      }));
      download(`focusflow-tasks-${today}.csv`, toCSV(rows), 'text/csv');
      toast('Tasks CSV exported');
    }
  }

  el.addEventListener('click', e => {
    const t = e.target.closest('[data-t]');
    if (t) { data.saveSettings({ theme: t.dataset.t }); return; }
    if (e.target.closest('[data-resetdurs]')) {
      confirm({ title: 'Reset durations?', message: 'Focus 25 / Short 5 / Long 15 / Long after 4.', label: 'Reset', danger: false })
        .then(ok => ok && data.saveSettings({ durations: { ...DEFAULT_SETTINGS.durations } })
          .then(() => { toast('Durations reset'); timer.refreshIdle(); sync(); }));
      return;
    }
    if (e.target.closest('[data-test]')) { notify.unlock(); notify.play('complete'); return; }
    if (e.target.closest('[data-nreq]')) {
      notify.request().then(p => { sync(); if (p === 'granted') toast('Notifications enabled'); else toast('Notifications: ' + p, p === 'denied' ? 'error' : 'info'); });
      return;
    }
    if (e.target.closest('[data-export]')) {
      data.exportData().then(j => {
        download(`focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(j, null, 2));
        toast('Backup downloaded');
      }).catch(err => toast('Export failed: ' + err.message, 'error'));
      return;
    }
    if (e.target.closest('[data-csv]')) { exportCSV('sessions'); return; }
    if (e.target.closest('[data-csvt]')) { exportCSV('tasks'); return; }
    if (e.target.closest('[data-resetall]')) {
      confirm({ title: 'Reset settings?', message: 'Durations, goals, sound aur notification preferences reset honge. Subjects, tasks aur history safe rehte hain.', label: 'Reset settings', danger: false })
        .then(ok => ok && data.saveSettings({
          durations: { ...DEFAULT_SETTINGS.durations }, goals: { ...DEFAULT_SETTINGS.goals },
          sounds: { ...DEFAULT_SETTINGS.sounds }, notifications: { ...DEFAULT_SETTINGS.notifications },
          startup: { ...DEFAULT_SETTINGS.startup }, weekStart: DEFAULT_SETTINGS.weekStart,
        }).then(() => { toast('Settings reset to defaults'); timer.refreshIdle(); sync(); }));
      return;
    }
    if (e.target.closest('[data-clear]')) {
      confirm({ title: 'Erase ALL data?', message: 'Is browser ke saare subjects, tasks, sessions aur settings permanently delete ho jayenge. Pehle backup lo agar unsure ho.', label: 'Erase everything' })
        .then(ok => ok && data.clearAll().then(() => { toast('All data erased'); sync(); }));
    }
  });

  el.addEventListener('change', e => {
    const d = e.target.closest('[data-d]');
    if (d) {
      const k = d.dataset.d, v = clampInt(d, +d.min || 1, +d.max || 999);
      data.saveSettings({ durations: { [k]: v } }).then(() => timer.refreshIdle());
      return;
    }
    const g = e.target.closest('[data-g]');
    if (g) { const k = g.dataset.g, v = Math.max(0, parseInt(g.value, 10) || 0); g.value = v; data.saveSettings({ goals: { [k]: v } }); return; }
    if (e.target.hasAttribute('data-week')) { data.saveSettings({ weekStart: +e.target.value }); return; }
    if (e.target.hasAttribute('data-remin')) { data.saveSettings({ sounds: { reminderSec: +e.target.value } }); }
  });

  el.addEventListener('input', e => {
    const s = e.target.closest('[data-snd]');
    if (s) {
      const k = s.dataset.snd;
      data.saveSettings({ sounds: { [k]: s.checked } });
      if (k === 'ambience') s.checked ? notify.startAmbience() : notify.stopAmbience();
      return;
    }
    const n = e.target.closest('[data-noti]');
    if (n) {
      const k = n.dataset.noti;
      data.saveSettings({ notifications: { [k]: n.checked } });
      if (k === 'enabled' && n.checked) notify.request();
      return;
    }
    const stb = e.target.closest('[data-st]');
    if (stb) data.saveSettings({ startup: { restoreTimer: stb.checked } });
  });

  el.querySelector('#ffimp').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let json;
      try { json = JSON.parse(reader.result); }
      catch (err) { toast('Ye file valid JSON nahi hai.', 'error'); e.target.value = ''; return; }
      let counts;
      try { counts = data.validateImport(json); }
      catch (err) { toast(err.message, 'error'); e.target.value = ''; return; }
      e.target.value = '';
      openModal({
        title: 'Import backup',
        body: `<p>Is backup mein <b>${counts.subjects.length}</b> subjects, <b>${counts.tasks.length}</b> tasks aur <b>${counts.sessions.length}</b> sessions hain.</p>
          <p class="muted small">Apply ka tarika chuno. Existing data kabhi silently overwrite nahi hota.</p>`,
        actions: [
          { label: 'Cancel' },
          { label: 'Merge (sirf naye add karo)', kind: 'ghost', onClick: cl => {
            cl();
            data.importData(json, 'merge').then(() => toast('Backup merged')).catch(err => toast(err.message, 'error'));
          } },
          { label: 'Replace everything', kind: 'danger', onClick: cl => {
            cl();
            confirm({ title: 'Replace ALL data?', message: 'Ye current subjects, tasks aur history ko hata kar backup import karega.', label: 'Replace' })
              .then(ok => ok && data.importData(json, 'replace').then(() => toast('Data replaced')).catch(err => toast(err.message, 'error')));
          } },
        ],
      });
    };
    reader.onerror = () => { toast('File padhne mein fail hua.', 'error'); e.target.value = ''; };
    reader.readAsText(file);
  });

  sync();
  return data.subscribe(t => { if (t === 'settings' || t === 'clear') sync(); });
}