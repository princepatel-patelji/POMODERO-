/* Timestamp-based Pomodoro engine.
   - Uses endAt epoch timestamps, so it stays accurate across tab sleep, refresh and app switches.
   - Records a focus session ONLY on genuine completion; reset/skip never record.
   - Dedup via stable session id + hasSession() check, single "completing" guard state. */
import { data } from './store.js';
import { notify } from './notify.js';
import { uid, fmtMs, dayOf, todayStr } from './utils.js';

const subs = new Set();
let interval = null, reminded = false;
let T = { mode: 'focus', status: 'idle', totalMs: 25 * 60000, remainingMs: 25 * 60000,
  endAt: 0, startedAt: 0, subjectId: null, taskId: null, count: 0, sessionId: null, lastNow: 0 };

const dur = m => Math.max(1, (data.settings.durations[m] || 25) * 60000);

function context() {
  return {
    subject: data.subjects.find(s => s.id === T.subjectId) || null,
    task: data.tasks.find(t => t.id === T.taskId) || null,
  };
}
function snap() {
  const rem = T.status === 'running' ? Math.max(0, T.endAt - Date.now()) : T.remainingMs;
  return { ...T, remainingMs: rem, progress: T.totalMs ? 1 - rem / T.totalMs : 0, ctx: context() };
}
function push(ev = null) { const s = snap(); for (const f of subs) { try { f(s, ev); } catch (e) { console.error(e); } } }
async function persist() {
  await data.saveTimer({
    mode: T.mode, status: T.status, totalMs: T.totalMs,
    remainingMs: T.status === 'running' ? Math.max(0, T.endAt - Date.now()) : T.remainingMs,
    endAt: T.endAt, startedAt: T.startedAt, subjectId: T.subjectId, taskId: T.taskId,
    count: T.count, sessionId: T.sessionId,
  });
}
function ensureInterval() { if (!interval) interval = setInterval(tick, 500); }
const stopInterval = () => { clearInterval(interval); interval = null; };

async function tick() {
  const now = Date.now();
  if (T.status !== 'running') return;
  if (now < T.lastNow) {                    // system clock moved backwards → keep remaining, rebase
    const rem = Math.max(0, T.endAt - T.lastNow);
    T.endAt = now + rem;
  }
  T.lastNow = now;
  const rem = T.endAt - now;
  if (rem <= 0) { await complete(); return; }
  const s = data.settings;
  if (T.mode === 'focus' && s.sounds.reminder && !reminded && rem <= s.sounds.reminderSec * 1000) {
    reminded = true;
    notify.play('reminder');
    notify.show('Break is close', `Your focus session ends in ${Math.ceil(rem / 1000)}s.`);
  }
  push();
}

async function complete() {
  if (T.status !== 'running') return;
  T.status = 'completing';                   // synchronous guard: no double completion
  stopInterval();
  const was = T.mode, sid = T.sessionId, endAt = T.endAt, total = T.totalMs;
  const startedAt = T.startedAt || endAt - total;
  const c = context();

  if (was === 'focus') {
    const id = sid || uid('ses');
    if (!(await data.hasSession(id))) {
      await data.saveSession({
        id, type: 'focus', subjectId: T.subjectId,
        subjectName: c.subject ? c.subject.name : 'General',
        taskId: T.taskId, taskTitle: c.task ? c.task.title : '',
        startedAt, endedAt: endAt,
        durationMin: Math.max(1, Math.round(total / 60000)),
        completed: true, notes: '',
      });
    }
    T.count += 1;
  }

  T.mode = 'focus'; T.status = 'idle'; T.totalMs = dur('focus'); T.remainingMs = T.totalMs;
  T.endAt = 0; T.startedAt = 0; T.sessionId = null; T.lastNow = Date.now();
  reminded = false;
  await persist();
  notify.play(was === 'focus' ? 'complete' : 'break');
  notify.show(
    was === 'focus' ? 'Focus session complete' : 'Break is over',
    was === 'focus'
      ? `${fmtMs(total)} of deep focus · ${c.subject ? c.subject.name : 'General'}${c.task ? ' · ' + c.task.title : ''}`
      : 'Ready for the next focus session?',
  );
  push({ completed: was, ctx: c, total });

  const st = data.settings;
  if (st.notifications.autoTransition) {     // optional: never forced by default
    if (was === 'focus') {
      const lb = T.count > 0 && T.count % st.durations.longAfter === 0;
      setMode(lb ? 'long' : 'short'); start();
    } else start();
  }
}

function start() {
  if (T.status === 'running') return;
  notify.unlock();
  if (T.status === 'paused') {
    T.endAt = Date.now() + T.remainingMs;
    if (T.mode === 'focus' && !T.startedAt) T.startedAt = Date.now() - T.remainingMs;
  } else {
    T.totalMs = dur(T.mode); T.remainingMs = T.totalMs;
    T.endAt = Date.now() + T.totalMs; T.startedAt = Date.now();
    if (T.mode === 'focus' && !T.sessionId) T.sessionId = uid('ses');
  }
  T.status = 'running'; T.lastNow = Date.now(); reminded = false;
  ensureInterval(); push({ started: true }); persist();
}
function pause() {
  if (T.status !== 'running') return;
  T.remainingMs = Math.max(0, T.endAt - Date.now());
  T.status = 'paused'; push({ paused: true }); persist();
}
function toggle() { T.status === 'running' ? pause() : start(); }
function reset() {
  T.status = 'idle'; T.totalMs = dur(T.mode); T.remainingMs = T.totalMs;
  T.endAt = 0; T.startedAt = 0; T.sessionId = null; reminded = false;
  push({ reset: true }); persist();
}
function skip() {
  if (T.status === 'idle') return;
  const was = T.mode;
  T.mode = was === 'focus' ? 'short' : 'focus';
  T.status = 'idle'; T.totalMs = dur(T.mode); T.remainingMs = T.totalMs;
  T.endAt = 0; T.startedAt = 0; T.sessionId = null;
  push({ skipped: was }); persist();
}
function setMode(m) {
  T.mode = m; T.status = 'idle'; T.totalMs = dur(m); T.remainingMs = T.totalMs;
  T.endAt = 0; T.startedAt = 0; T.sessionId = null; reminded = false;
  push({ mode: m }); persist();
}
function setContext({ subjectId = null, taskId = null } = {}) {
  if (T.status === 'running') return false; // running sessions keep their context
  T.subjectId = subjectId; T.taskId = taskId;
  push({ ctx: true }); persist();
  return true;
}
function refreshIdle() {
  if (T.status === 'idle') { T.totalMs = dur(T.mode); T.remainingMs = T.totalMs; push({ durations: true }); persist(); }
}
async function adopt(saved) {
  if (!saved || typeof saved !== 'object') return;
  T = { ...T, ...saved, lastNow: Date.now() };
  if (T.status === 'running') {
    if (T.endAt <= Date.now()) await complete();   // finished while away → record once (deduped)
    else { ensureInterval(); push({ restored: true }); }
  } else if (T.status === 'paused' || T.status === 'completing') {
    T.status = T.status === 'completing' ? 'idle' : 'paused';
    if (T.status === 'idle') { T.totalMs = dur(T.mode); T.remainingMs = T.totalMs; }
    push({ restored: true });
  } else push({ restored: true });
}

export const timer = {
  get state() { return snap(); },
  subscribe(f) { subs.add(f); f(snap(), null); return () => subs.delete(f); },
  init: saved => adopt(saved),
  start, pause, toggle, reset, skip, setMode, setContext, refreshIdle,
};

document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('focus', tick);
window.addEventListener('pageshow', tick);