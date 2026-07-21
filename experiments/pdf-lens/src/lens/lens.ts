/**
 * The magnetic lens.
 *
 * The loupe can be dragged, but it only ever *lands* on a hotspot — a region
 * the analyzer proved can produce a stat. While dragging it follows the pointer
 * and highlights the nearest hotspot; on release it snaps onto that hotspot and
 * emits `onLock`, which the app uses to spawn the orbiting cubes.
 *
 * Coordinates are in the content layer's space (the scrollable pages stack).
 */
import type { Hotspot } from '../core/types';

export interface LensOptions {
  size: number;
  zoom: number;
  onLock: (hotspot: Hotspot) => void;
  /** Draw the magnified page under (cx, cy) into the loupe canvas. */
  drawLoupe: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, zoom: number) => void;
}

export class Lens {
  private lensEl: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private markers = new Map<string, HTMLDivElement>();
  private hotspots: Hotspot[] = [];
  private active: Hotspot | null = null;
  private pos = { x: 0, y: 0 };
  private dragging = false;

  constructor(private content: HTMLElement, private opts: LensOptions) {
    this.lensEl = document.createElement('div');
    this.lensEl.className = 'lens';
    this.lensEl.style.width = this.lensEl.style.height = `${opts.size}px`;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lens-canvas';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = opts.size * dpr;
    this.canvas.height = opts.size * dpr;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);

    const ring = document.createElement('div');
    ring.className = 'lens-ring';
    this.lensEl.append(this.canvas, ring);
    this.content.appendChild(this.lensEl);

    this.bindDrag();
  }

  setHotspots(hotspots: Hotspot[]): void {
    this.hotspots = hotspots;
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();

    for (const h of hotspots) {
      const marker = document.createElement('div');
      marker.className = 'hotspot';
      const { rect } = h.block;
      Object.assign(marker.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      marker.style.setProperty('--strength', String(0.25 + h.score * 0.75));
      marker.title = `${h.cards.length} stat${h.cards.length > 1 ? 's' : ''} available`;
      marker.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.moveTo(h.block.center.x, h.block.center.y);
        this.lockTo(h);
      });
      this.content.appendChild(marker);
      this.markers.set(h.id, marker);
    }

    if (hotspots.length) {
      this.moveTo(hotspots[0].block.center.x, hotspots[0].block.center.y);
      this.lockTo(hotspots[0]);
    }
  }

  private nearest(x: number, y: number): Hotspot | null {
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

  private highlight(h: Hotspot | null): void {
    for (const [id, m] of this.markers) m.classList.toggle('near', !!h && id === h.id);
  }

  private moveTo(x: number, y: number): void {
    this.pos = { x, y };
    this.lensEl.style.left = `${x}px`;
    this.lensEl.style.top = `${y}px`;
    this.opts.drawLoupe(this.ctx, x, y, this.opts.size, this.opts.zoom);
  }

  private lockTo(h: Hotspot): void {
    this.active = h;
    this.highlight(h);
    for (const [id, m] of this.markers) m.classList.toggle('locked', id === h.id);
    this.moveTo(h.block.center.x, h.block.center.y);
    this.opts.onLock(h);
  }

  get position() { return this.pos; }
  get radius() { return this.opts.size / 2; }
  get activeHotspot() { return this.active; }

  private bindDrag(): void {
    const toContent = (e: PointerEvent) => {
      const r = this.content.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onMove = (e: PointerEvent) => {
      if (!this.dragging) return;
      const p = toContent(e);
      const near = this.nearest(p.x, p.y);
      // Magnetic pull: as the pointer nears a hotspot, drift toward its center.
      if (near) {
        const dx = near.block.center.x - p.x;
        const dy = near.block.center.y - p.y;
        const dist = Math.hypot(dx, dy);
        const pull = Math.max(0, 1 - dist / 220) ** 2; // 0..1, stronger up close
        this.moveTo(p.x + dx * pull, p.y + dy * pull);
        this.highlight(near);
      } else {
        this.moveTo(p.x, p.y);
      }
    };

    const onUp = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.lensEl.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const near = this.nearest(this.pos.x, this.pos.y);
      if (near) this.lockTo(near); // always land on a stat spot
    };

    this.lensEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dragging = true;
      this.lensEl.classList.add('dragging');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }
}
