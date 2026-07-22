/**
 * The lens tool.
 *
 * While scanning it's a square that follows the cursor. When it snaps to a
 * stat spot it MORPHS to that paragraph's actual rectangle and highlights the
 * text ("shaped after the content"). Either way it paints a sharp 1:1 cutout of
 * the page beneath, so the focus stays crisp while the rest of the page blurs.
 * The interaction state machine lives in main.ts; this class is the view.
 */
import type { Hotspot, Rect } from '../core/types';

export interface LensOptions {
  size: number; // square size while scanning
  /** Paint the page region [left,top,width,height] (content px) into the ctx. */
  drawRegion: (ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number) => void;
}

export class Lens {
  private lensEl: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private markers = new Map<string, HTMLDivElement>();
  private hotspots: Hotspot[] = [];
  private pos = { x: 0, y: 0 };
  private box: Rect = { left: 0, top: 0, width: 0, height: 0 };

  constructor(private content: HTMLElement, private opts: LensOptions) {
    this.lensEl = document.createElement('div');
    this.lensEl.className = 'lens';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lens-canvas';

    const ring = document.createElement('div');
    ring.className = 'lens-ring';
    const hl = document.createElement('div');
    hl.className = 'lens-hl';
    this.lensEl.append(this.canvas, hl, ring);
    this.content.appendChild(this.lensEl);
  }

  get element(): HTMLDivElement { return this.lensEl; }
  get position() { return this.pos; }
  get bounds(): Rect { return this.box; }
  get hotspotList() { return this.hotspots; }

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
    if (hotspots.length) {
      const c = hotspots[0].block.center;
      this.placeSquare(c.x, c.y);
    }
  }

  /** Position + paint a sharp cutout for an arbitrary rectangle. */
  private renderRect(box: Rect): void {
    this.box = box;
    this.pos = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    Object.assign(this.lensEl.style, {
      left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px`, transform: 'none',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(box.width * dpr));
    this.canvas.height = Math.max(1, Math.round(box.height * dpr));
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.opts.drawRegion(ctx, box.left, box.top, box.width, box.height);
  }

  /** Free square, centered on (cx, cy) — the scanning shape. */
  placeSquare(cx: number, cy: number): void {
    const s = this.opts.size;
    this.lensEl.classList.remove('shaped');
    this.renderRect({ left: cx - s / 2, top: cy - s / 2, width: s, height: s });
  }

  /** Morph to a paragraph's rectangle and highlight it — shaped after content. */
  shapeTo(rect: Rect): void {
    const pad = 7;
    this.lensEl.classList.add('shaped');
    this.renderRect({
      left: rect.left - pad, top: rect.top - pad,
      width: rect.width + pad * 2, height: rect.height + pad * 2,
    });
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
