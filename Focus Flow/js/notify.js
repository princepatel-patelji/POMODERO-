/* Notifications + synthesized sound (no audio files, works offline). */
import { data } from './store.js';

let actx = null, amb = null;
function ctx() {
  if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(c, freq, at, dur, vol = .4, type = 'sine') {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur + .05);
}

export const notify = {
  unlock() { ctx(); },
  play(kind) {
    const s = data.settings.sounds, c = ctx();
    if (!c) return;
    const on = kind === 'complete' ? s.complete : kind === 'break' ? s.break : true;
    if (!on) return;
    if (kind === 'complete') { tone(c, 659, 0, .5); tone(c, 880, .18, .6); tone(c, 1319, .36, .9, .3); }
    else if (kind === 'break') { tone(c, 523, 0, .4, .35); tone(c, 784, .16, .6, .3); }
    else if (kind === 'reminder') tone(c, 988, 0, .12, .25, 'triangle');
    else tone(c, 1200, 0, .05, .12, 'square');
  },
  canNotify() { return 'Notification' in window; },
  permission() { return this.canNotify() ? Notification.permission : 'unsupported'; },
  async request() { if (!this.canNotify()) return 'unsupported'; try { return await Notification.requestPermission(); } catch { return 'denied'; } },
  show(title, body, tag) {
    const s = data.settings;
    if (s.notifications.enabled && this.canNotify() && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: 'icons/icon.svg', tag: tag || 'focusflow' }); } catch { /* platform quirk */ }
    }
  },
  startAmbience() {
    this.unlock(); if (amb || !actx) return;
    const c = actx, len = 2 * c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0.04;
    src.connect(f); f.connect(g); g.connect(c.destination); src.start();
    amb = { src };
  },
  stopAmbience() { if (!amb) return; try { amb.src.stop(); } catch {} amb = null; },
};