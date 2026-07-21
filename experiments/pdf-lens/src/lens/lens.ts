/**
 * The lens tool — a square "focus window" over the page.
 *
 * It renders a sharp 1:1 cutout of the page beneath it (so when the rest of the
 * page is blurred, the square stays crisp). The interaction state machine
 * (idle → roaming → locked) lives in main.ts; this class is the view: it draws
 * the cutout, positions itself, and manages the hotspot markers.
 */
import type { Hotspot } from '../core/types';

export interface LensOptions {
  size: number;
  /** Paint the sharp page region under (cx, cy) into the lens canvas. */
  drawCutout: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void;
}

export class Lens {
  private lensEl: HTMLDivElement;
  private ctx: CanvasRenderingContext2D;
  private markers = new Map<string, HTMLDivElement>();
  private hotspots: Hotspot[] = [];
  private pos = { x: 0, y: 0 };

  constructor(private content: HTMLElement, private opts: LensOptions) {
    this.lensEl = document.createElement('div');
    this.lensEl.className = 'lens';
    this.lensEl.style.width = this.lensEl.style.height = `${opts.size}px`;

    const canvas = document.createElement('canvas');
    canvas.className = 'lens-canvas';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = opts.size * dpr;
    canvas.height = opts.size * dpr;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);

    const ring = document.createElement('div');
    ring.className = 'lens-ring';
    this.lensEl.append(canvas, ring);
    this.content.appendChild(this.lensEl);
  }

  get element(): HTMLDivElement { return this.lensEl; }
  get position() { return this.pos; }
  get radius() { return this.opts.size / 2; }
  get hotspotList() { return this.hotspots; }

  /** Draw markers for every hotspot; clicking one calls `onPick`. */
  setHotspots(hotspots: Hotspot[], onPick: (h: Hotspot) => void): void {
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();
    this.hotspots = hotspots;

    for (const h of hotspots) {
      const marker = document.createElement('div');
      marker.className = 'hotspot';
      const { rect } = h.block;
      Object.assign(marker.style, {
        left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
      });
      marker.style.setProperty('--strength', String(0.25 + h.score * 0.75));
      marker.title = `${h.cards.length} stat${h.cards.length > 1 ? 's' : ''}`;
      marker.addEventListener('click', (e) => { e.stopPropagation(); onPick(h); });
      this.content.appendChild(marker);
      this.markers.set(h.id, marker);
    }
    if (hotspots.length) this.place(hotspots[0].block.center.x, hotspots[0].block.center.y);
  }

  place(x: number, y: number): void {
    this.pos = { x, y };
    this.lensEl.style.left = `${x}px`;
    this.lensEl.style.top = `${y}px`;
    this.opts.drawCutout(this.ctx, x, y, this.opts.size);
  }

  nearestTo(x: number, y: number): Hotspot | null {
    let best: Hotspot | null = null;
    let bestD = Infinity;
    for (const h of this.hotspots) {
      const dx = h.block.center.x - x;
      const dy = h.block.center.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  markActive(h: Hotspot | null): void {
    for (const [id, m] of this.markers) {
      m.classList.toggle('locked', !!h && id === h.id);
      m.classList.toggle('near', !!h && id === h.id);
    }
  }

  setTool(active: boolean): void {
    this.lensEl.classList.toggle('tool', active);
  }
}
