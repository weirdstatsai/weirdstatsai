/**
 * Renders one orbiting "cube" — a compact preview of a single stat card.
 * Each of the six types gets its own tiny visual language, echoing the
 * WeirdStats card family (kpi / chart / ranking / versus / table / map).
 */
import type {
  StatPreview,
  KpiPayload,
  SeriesPayload,
  RankingPayload,
  VersusPayload,
  TablePayload,
  MapPayload,
} from '../core/types';

const META: Record<StatPreview['type'], { icon: string; label: string; accent: string }> = {
  kpi: { icon: '◎', label: 'KPI', accent: '#534AB7' },
  chart: { icon: '▮', label: 'Chart', accent: '#1D9E75' },
  ranking: { icon: '≡', label: 'Ranking', accent: '#BA7517' },
  versus: { icon: '⚔', label: 'Versus', accent: '#D4537E' },
  table: { icon: '⊞', label: 'Table', accent: '#185FA5' },
  map: { icon: '◍', label: 'Map', accent: '#0F6E56' },
};

function el(tag: string, cls: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function miniBars(values: number[], accent: string): HTMLElement {
  const wrap = el('div', 'cube-bars');
  const max = Math.max(...values, 1);
  for (const v of values) {
    const bar = el('span', 'cube-bar');
    bar.style.height = `${Math.max(8, (Math.abs(v) / max) * 100)}%`;
    bar.style.background = accent;
    wrap.appendChild(bar);
  }
  return wrap;
}

function body(preview: StatPreview, accent: string): HTMLElement {
  switch (preview.type) {
    case 'kpi': {
      const p = preview.payload as KpiPayload;
      const wrap = el('div', 'cube-kpi');
      const v = el('div', 'cube-kpi-value', p.value + (p.unit || ''));
      v.style.color = accent;
      wrap.appendChild(v);
      if (p.delta) wrap.appendChild(el('div', 'cube-kpi-delta', p.delta));
      return wrap;
    }
    case 'chart': {
      const p = preview.payload as SeriesPayload;
      return miniBars(p.values, accent);
    }
    case 'ranking': {
      const p = preview.payload as RankingPayload;
      const wrap = el('div', 'cube-rank');
      const max = Math.max(...p.rows.map((r) => r.value), 1);
      p.rows.slice(0, 4).forEach((r, i) => {
        const row = el('div', 'cube-rank-row');
        row.appendChild(el('span', 'cube-rank-num', String(i + 1)));
        row.appendChild(el('span', 'cube-rank-label', r.label));
        const track = el('span', 'cube-rank-track');
        const fill = el('span', 'cube-rank-fill');
        fill.style.width = `${(r.value / max) * 100}%`;
        fill.style.background = accent;
        track.appendChild(fill);
        row.appendChild(track);
        wrap.appendChild(row);
      });
      return wrap;
    }
    case 'versus': {
      const p = preview.payload as VersusPayload;
      const total = Math.abs(p.a.value) + Math.abs(p.b.value) || 1;
      const wrap = el('div', 'cube-versus');
      const bar = el('div', 'cube-versus-bar');
      const a = el('span', 'cube-versus-a');
      a.style.width = `${(Math.abs(p.a.value) / total) * 100}%`;
      a.style.background = accent;
      const b = el('span', 'cube-versus-b');
      b.style.width = `${(Math.abs(p.b.value) / total) * 100}%`;
      bar.append(a, b);
      const labels = el('div', 'cube-versus-labels');
      labels.append(el('span', 'cube-versus-la', p.a.label), el('span', 'cube-versus-lb', p.b.label));
      wrap.append(bar, labels);
      return wrap;
    }
    case 'table': {
      const p = preview.payload as TablePayload;
      const table = el('table', 'cube-table') as HTMLTableElement;
      const thead = el('tr', '');
      p.columns.forEach((c) => thead.appendChild(el('th', '', c)));
      table.appendChild(thead);
      p.rows.slice(0, 3).forEach((r) => {
        const tr = el('tr', '');
        r.forEach((c) => tr.appendChild(el('td', '', c)));
        table.appendChild(tr);
      });
      return table;
    }
    case 'map': {
      const p = preview.payload as MapPayload;
      const wrap = el('div', 'cube-map');
      const max = Math.max(...p.regions.map((r) => r.value), 1);
      p.regions.slice(0, 4).forEach((r) => {
        const row = el('div', 'cube-map-row');
        const dot = el('span', 'cube-map-dot');
        dot.style.background = accent;
        dot.style.opacity = String(0.35 + (r.value / max) * 0.65);
        row.append(dot, el('span', 'cube-map-name', r.name));
        wrap.appendChild(row);
      });
      return wrap;
    }
  }
}

export function renderCube(preview: StatPreview): HTMLElement {
  const meta = META[preview.type];
  const cube = el('div', 'cube');
  cube.style.setProperty('--accent', meta.accent);

  const head = el('div', 'cube-head');
  const badge = el('span', 'cube-badge', meta.icon);
  badge.style.background = meta.accent;
  head.append(badge, el('span', 'cube-type', meta.label));
  cube.appendChild(head);

  cube.appendChild(el('div', 'cube-title', preview.title));
  const bodyWrap = el('div', 'cube-body');
  bodyWrap.appendChild(body(preview, meta.accent));
  cube.appendChild(bodyWrap);
  return cube;
}
