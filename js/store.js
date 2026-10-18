/* Data-access layer: cache + pub/sub over IndexedDB. All stats derive from this. */
import * as db from './db.js';
import { uid, deepMerge } from './utils.js';

export const DEFAULT_SETTINGS = {
  theme: 'auto',
  durations: { focus: 25, short: 5, long: 15, longAfter: 4 },
  goals: { dailyMin: 120, dailyPomos: 4, weeklyMin: 600 },
  sounds: { complete: true, break: true, reminder: false, reminderSec: 60, ambience: false },
  notifications: { enabled: true, autoTransition: false },
  weekStart: 0,
  startup: { restoreTimer: true },
};

const cache = { subjects: [], tasks: [], sessions: [] };
const listeners = new Set();
let settings = deepMerge({}, DEFAULT_SETTINGS);
let timerState = null;
let activeMeta = { taskId: null };

function emit(type, payload) {
  queueMicrotask(() => { for (const fn of listeners) { try { fn(type, payload); } catch (e) { console.error(e); } } });
}
const refresh = async store => { cache[store] = await db.getAll(store); };

class DataStore {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  async init() {
    await Promise.all([refresh('subjects'), refresh('tasks'), refresh('sessions')]);
    const s = await db.get('kv', 'settings'); if (s) settings = deepMerge(DEFAULT_SETTINGS, s.value);
    const t = await db.get('kv', 'timer'); timerState = t ? t.value : null;
    const a = await db.get('kv', 'active'); if (a) activeMeta = a.value;
    emit('ready');
  }

  get subjects() { return cache.subjects; }
  get tasks() { return cache.tasks; }
  get sessions() { return cache.sessions; }
  get settings() { return settings; }
  get timerState() { return timerState; }
  get active() { return activeMeta; }

  async saveSettings(patch) {
    settings = deepMerge(settings, patch);
    await db.put('kv', { key: 'settings', value: settings });
    emit('settings', settings);
    return settings;
  }
  async saveTimer(st) {
    timerState = st;
    if (st) await db.put('kv', { key: 'timer', value: st });
    else await db.del('kv', 'timer');
  }
  async setActive(taskId) {
    activeMeta = { taskId };
    await db.put('kv', { key: 'active', value: activeMeta });
  }

  /* Subjects */
  async saveSubject(sub) {
    if (!sub.id) { sub.id = uid('sub'); sub.createdAt = Date.now(); sub.archived = false; }
    await db.put('subjects', sub);
    await refresh('subjects');
    emit('subjects', sub);
    return sub;
  }
  async deleteSubject(id, alsoSessions = false) {
    await db.del('subjects', id);
    for (const t of cache.tasks) if (t.subjectId === id) await db.put('tasks', { ...t, subjectId: null }); // tasks survive, unassigned
    if (alsoSessions) for (const s of cache.sessions) if (s.subjectId === id) await db.del('sessions', s.id);
    await Promise.all([refresh('subjects'), refresh('tasks')]);
    if (alsoSessions) await refresh('sessions');
    emit('subjects'); emit('tasks'); if (alsoSessions) emit('sessions');
  }

  /* Tasks */
  async saveTask(task) {
    if (!task.id) { task.id = uid('task'); task.createdAt = Date.now(); }
    if (!Array.isArray(task.tags)) task.tags = [];
    await db.put('tasks', task);
    await refresh('tasks');
    emit('tasks', task);
    return task;
  }
  async deleteTask(id) {
    await db.del('tasks', id);
    await refresh('tasks');
    emit('tasks');
  }

  /* Sessions (history) — kept separate from tasks so deleting tasks never erases history */
  async hasSession(id) { return !!(await db.get('sessions', id)); }
  async saveSession(s) {
    if (!s.id) s.id = uid('ses');
    await db.put('sessions', s);
    await refresh('sessions');
    emit('sessions', s);
    return s;
  }
  async deleteSession(id) {
    await db.del('sessions', id);
    await refresh('sessions');
    emit('sessions');
  }

  /* Backup */
  async exportData() {
    return { app: 'focusflow', version: 1, exportedAt: Date.now(), settings, timer: timerState,
      subjects: cache.subjects, tasks: cache.tasks, sessions: cache.sessions };
  }
  validateImport(json) {
    if (!json || typeof json !== 'object') throw new Error('File is not valid JSON.');
    if (json.app !== 'focusflow') throw new Error('This is not a FocusFlow backup file.');
    for (const k of ['subjects', 'tasks', 'sessions']) if (!Array.isArray(json[k])) throw new Error(`Backup is missing the "${k}" list.`);
    return {
      subjects: json.subjects.filter(x => x && typeof x.id === 'string'),
      tasks: json.tasks.filter(x => x && typeof x.id === 'string'),
      sessions: json.sessions.filter(x => x && typeof x.id === 'string'),
    };
  }
  async importData(json, mode) {
    const d = this.validateImport(json);
    if (mode === 'replace') {
      await Promise.all([db.clear('subjects'), db.clear('tasks'), db.clear('sessions')]);
      await Promise.all([db.bulkPut('subjects', d.subjects), db.bulkPut('tasks', d.tasks), db.bulkPut('sessions', d.sessions)]);
      if (json.settings) { settings = deepMerge(DEFAULT_SETTINGS, json.settings); await db.put('kv', { key: 'settings', value: settings }); }
    } else {
      const seen = k => new Set(cache[k].map(x => x.id));
      await db.bulkPut('subjects', d.subjects.filter(x => !seen('subjects').has(x.id)));
      await db.bulkPut('tasks', d.tasks.filter(x => !seen('tasks').has(x.id)));
      await db.bulkPut('sessions', d.sessions.filter(x => !seen('sessions').has(x.id)));
    }
    await Promise.all([refresh('subjects'), refresh('tasks'), refresh('sessions')]);
    emit('import');
  }
  async clearAll() {
    await Promise.all([db.clear('subjects'), db.clear('tasks'), db.clear('sessions'), db.clear('kv')]);
    settings = deepMerge({}, DEFAULT_SETTINGS);
    timerState = null; activeMeta = { taskId: null };
    cache.subjects.length = cache.tasks.length = cache.sessions.length = 0;
    emit('clear');
  }
}

export const data = new DataStore();
export { deepMerge };