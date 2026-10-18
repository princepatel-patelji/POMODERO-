/* Dependency-free SVG charts (bar / grouped bar / area / donut). */
import { fmtMin, clamp } from './utils.js';
const esc = s => String(s ?? '').replace(/</g, '&lt;');

function niceMax(m) {
  if (m <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  const d = m / p;
  return (d <= 1 ? 1 : d <= 2 ? 2 : d <= 2.5 ? 2.5 : d <= 5 ? 5 : 10) * p;
}

export function barChart(el, { labels, series, height = 180, unit = 'min' }) {
  const W = Math.max(300, el.clientWidth || 560), H = height;
  const padL = 42, padR = 8, padT = 12, padB = 26;
  const n = labels.length, plotW = W - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  const fmt = v => unit === 'min' ? fmtMin(v) : Math.round(v * 10) / 10;
  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const y = padT + plotH * (1 - i / 3);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="cg"/><text x="${padL - 7}" y="${y + 4}" class="ct" text-anchor="end">${fmt(max * i / 3)}</text>`;
  }
  const fw = plotW / n, gap = 3;
  const bw = Math.max(3, Math.min(34, (fw - 10 - gap * (series.length - 1)) / series.length));
  const totalW = bw * series.length + gap * (series.length - 1);
  let bars = '';
  labels.forEach((lb, i) => {
    const x0 = padL + fw * i + (fw - totalW) / 2;
    series.forEach((s, si) => {
      const v = clamp(s.values[i] ?? 0, 0, max);
      const h = plotH * (v / max), x = x0 + si * (bw + gap), y = padT + plotH - h;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, v > 0 ? 2 : 0).toFixed(1)}" rx="3.5" fill="${s.color}" opacity="${si ? .5 : .92}"><title>${esc(lb)} · ${esc(s.name)}: ${fmt(s.values[i] ?? 0)}</title></rect>`;
    });
    if (n <= 14 || i % Math.ceil(n / 12) === 0 || i === n - 1)
      bars += `<text x="${(padL + fw * i + fw / 2).toFixed(1)}" y="${H - 7}" class="ct" text-anchor="middle">${esc(lb)}</text>`;
  });
  const legend = series.length > 1
    ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  el.innerHTML = `<svg class="chart" width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${grid}${bars}</svg>${legend}`;
}

export function areaChart(el, { labels, values, height = 180 }) {
  const W = Math.max(300, el.clientWidth || 560), H = height;
  const padL = 42, padR = 10, padT = 12, padB = 26;
  const n = values.length, plotW = W - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(1, ...values));
  const x = i => padL + (n === 1 ? plotW / 2 : plotW * i / (n - 1));
  const y = v => padT + plotH * (1 - clamp(v, 0, max) / max);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${padT + plotH} L${x(0).toFixed(1)} ${padT + plotH} Z`;
  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const gy = padT + plotH * (1 - i / 3);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" class="cg"/><text x="${padL - 7}" y="${gy + 4}" class="ct" text-anchor="end">${fmtMin(max * i / 3)}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / 8));
  let xl = '';
  labels.forEach((lb, i) => { if (i % step === 0) xl += `<text x="${x(i).toFixed(1)}" y="${H - 7}" class="ct" text-anchor="middle">${esc(lb)}</text>`; });
  const dots = values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4" class="cdot"><title>${esc(labels[i])}: ${fmtMin(v)}</title></circle>`).join('');
  el.innerHTML = `<svg class="chart" width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${grid}
    <path d="${area}" class="ca"/><path d="${line}" class="cl"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(values[n - 1]).toFixed(1)}" r="4.2" class="cdot now"/>${dots}${xl}</svg>`;
}

export function donut(el, { items, size = 190, thickness = 24, centerTop = '', centerSub = 'total' }) {
  const r = (size - thickness) / 2, C = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total <= 0) { el.innerHTML = `<div class="empty small"><p>No data yet</p></div>`; return; }
  let acc = 0, segs = '';
  for (const it of items) {
    if (it.value <= 0) continue;
    const frac = it.value / total;
    const dash = Math.max(0.5, frac * C - 2);
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thickness}" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(it.label)}: ${fmtMin(it.value)}</title></circle>`;
    acc += frac;
  }
  const legend = items.filter(i => i.value > 0).map(it =>
    `<li><i style="background:${it.color}"></i><span>${esc(it.label)}</span><b>${Math.round(it.value / total * 100)}%</b></li>`).join('');
  el.innerHTML = `<div class="donut-wrap">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Distribution chart">
      ${segs}<text x="${cx}" y="${cy - 2}" class="dct" text-anchor="middle">${esc(centerTop)}</text>
      <text x="${cx}" y="${cy + 16}" class="dcs" text-anchor="middle">${esc(centerSub)}</text>
    </svg><ul class="donut-legend">${legend}</ul></div>`;
}