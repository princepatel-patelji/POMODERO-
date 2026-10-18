/* Icons, toasts, modals, confirmations, empty states. */
import { $, escapeHtml } from './utils.js';

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.5 2.5"/><path d="M9 2h6"/>',
  tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8.5 12 2.5 2.5 5-5"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/><path d="M9 2.5 12 4l3-1.5"/>',
  chart: '<path d="M5 20v-8M10.5 20V5M16 20v-6M21 20H3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 3h-4l-.4 2.5a7.5 7.5 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5L10 21h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.5v15l12-7.5Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  skip: '<path d="M5 5v14l9-7Z"/><path d="M19 5v14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 3h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  flame: '<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-5 0 2 1 3 2 3-.5-2.5 0-5 1-7Z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  chevL: '<path d="m14 6-6 6 6 6"/>',
  chevR: '<path d="m10 6 6 6-6 6"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9Z"/>',
  alert: '<path d="M12 3 2.5 20h19Z"/><path d="M12 9.5v4.5M12 17.5v.1"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9"/><path d="M10 13h4"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  coffee: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7 3c0 1-1 1-1 2s1 1 1 2M11 3c0 1-1 1-1 2s1 1 1 2"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
};
export function icon(name, size = 18, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function toast(msg, type = 'success', ms = 3200) {
  const stack = document.getElementById('toasts');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'bell' : 'check', 16)}<span>${escapeHtml(msg)}</span>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 280); }, ms);
}

export function openModal({ title, body, actions = [], wide = false, onClose }) {
  const root = document.getElementById('modal-root');
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-head"><h3>${escapeHtml(title)}</h3>
        <button class="icon-btn" data-close aria-label="Close dialog">${icon('x', 16)}</button></div>
      <div class="modal-body">${body}</div>
      ${actions.length ? `<div class="modal-actions">${actions.map((a, i) =>
        `<button class="btn ${a.kind || 'ghost'}" data-act="${i}">${escapeHtml(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
  root.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  (ov.querySelector('.modal-actions .btn') || ov.querySelector('[data-close]'))?.focus();

  const close = () => {
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 200);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = [...ov.querySelectorAll('button, input, select, textarea, a')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', e => {
    if (e.target === ov) close();
    if (e.target.closest('[data-close]')) close();
    const b = e.target.closest('[data-act]');
    if (b) actions[+b.dataset.act].onClick?.(close);
  });
  return { el: ov, close };
}

export function confirm({ title = 'Are you sure?', message = '', label = 'Confirm', danger = true }) {
  return new Promise(res => {
    openModal({
      title, body: `<p class="muted">${message}</p>`,
      actions: [
        { label: 'Cancel', onClick: c => { c(); res(false); } },
        { label, kind: danger ? 'danger' : 'primary', onClick: c => { c(); res(true); } },
      ],
      onClose: () => res(false),
    });
  });
}

export function emptyState({ icon: ic = 'sparkle', title, sub = '', actionLabel, onAction }) {
  const el = document.createElement('div');
  el.className = 'empty';
  el.innerHTML = `<div class="empty-ic">${icon(ic, 26)}</div><h4>${escapeHtml(title)}</h4>
    ${sub ? `<p>${escapeHtml(sub)}</p>` : ''}
    ${actionLabel ? `<button class="btn primary sm" data-a>${escapeHtml(actionLabel)}</button>` : ''}`;
  if (actionLabel) el.querySelector('[data-a]').addEventListener('click', onAction);
  return el;
}