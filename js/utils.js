/* FocusFlow — shared utilities */
export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const pad = n => String(n).padStart(2, '0');

export function parseDate(str) { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d); }
export function localDateStr(ts = Date.now()) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export const todayStr = () => localDateStr();
export function addDays(str, n) { const d = parseDate(str); d.setDate(d.getDate() + n); return localDateStr(d.getTime()); }
export const dayDiff = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export function lastNDays(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(todayStr(), -i)); return out; }
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function monthName(y, m) { return new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' }); }
export function dayOf(ts) { return localDateStr(ts); }
export function fmtMin(min) { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; }
export function fmtMs(ms) {
  ms = Math.max(0, Math.round(ms / 1000) * 1000);
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
export const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDate = str => parseDate(str).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtDateFull = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
export function greeting() { const h = new Date().getHours(); return h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Winding down'; }
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function download(name, text, mime = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function toCSV(rows) {
  if (!rows.length) return '';
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = Object.keys(rows[0]);
  return [head.join(','), ...rows.map(r => head.map(h => q(r[h])).join(','))].join('\n');
}
export const parseTags = s => String(s || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 8);
export const PRIORITIES = [['urgent', 'Urgent'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
export const priorityRank = p => ({ urgent: 4, high: 3, medium: 2, low: 1 }[p] ?? 0);
export const isOverdue = t => !!t.dueDate && t.status !== 'done' && t.dueDate < todayStr();
export function computeStreaks(sessions) {
  const days = [...new Set(sessions.map(s => dayOf(s.endedAt)))].sort();
  let best = 0, cur = 0, prev = null;
  for (const d of days) { cur = prev && dayDiff(prev, d) === 1 ? cur + 1 : 1; if (cur > best) best = cur; prev = d; }
  const set = new Set(days); let c = 0; let d = todayStr();
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { c++; d = addDays(d, -1); }
  return { current: c, longest: best };
}
export function deepMerge(base, patch) {
  if (!patch) return base;
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const b = base[k], p = patch[k];
    out[k] = (p && typeof p === 'object' && !Array.isArray(p) && b && typeof b === 'object') ? deepMerge(b, p) : p;
  }
  return out;
}