import {
  AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild,
} from '@angular/core';
import { ModalController } from '@ionic/angular';

/** Output size of the baked crop — comfortably above any surface that shows it
 *  (detail hero, share PNG at 2x, 1200x630 OG frame) without being wasteful. */
const OUT_W = 1400;
const OUT_H = 875;            // 16:10 — the middle ground between the card's shapes

/**
 * "Adjust photo" step shown before a card background upload: pan + zoom the
 * picture inside the card's frame and confirm. The preview canvas and the
 * exported canvas run the SAME composition maths, so what the user frames is
 * exactly what gets uploaded.
 */
@Component({
  selector: 'app-image-adjust',
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Adjust photo</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="hint">Drag to reposition · pinch or use the slider to zoom</p>

      <div class="stage" #stage>
        <canvas #canvas
                (pointerdown)="onDown($event)"
                (pointermove)="onMove($event)"
                (pointerup)="onUp($event)"
                (pointercancel)="onUp($event)"
                (pointerleave)="onUp($event)"></canvas>
        <div class="stage-grid" aria-hidden="true"></div>
      </div>

      <div class="zoom-row">
        <ion-icon name="image-outline" class="zoom-ico sm"></ion-icon>
        <input class="zoom-range" type="range" min="100" max="300" step="1"
               [value]="zoom * 100"
               (input)="onZoom($any($event.target).value)"
               aria-label="Zoom">
        <ion-icon name="image-outline" class="zoom-ico lg"></ion-icon>
      </div>

      <div class="btn-row">
        <button class="btn ghost" (click)="reset()">
          <ion-icon name="refresh-outline"></ion-icon> Reset
        </button>
        <button class="btn primary" (click)="confirm()" [disabled]="busy">
          <ion-spinner name="crescent" *ngIf="busy"></ion-spinner>
          <span *ngIf="!busy">Use photo</span>
        </button>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-toolbar { --background: #fff; }
    ion-title { font-size: 17px; font-weight: 700; }
    .hint { margin: 0 0 12px; font-size: 12.5px; color: #7a7d92; text-align: center; }

    .stage {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 16px;
      overflow: hidden;
      background: #14151f;
      touch-action: none;          /* we handle the drag ourselves */
      cursor: grab;
    }
    .stage:active { cursor: grabbing; }
    .stage canvas { display: block; width: 100%; height: 100%; }

    /* rule-of-thirds guides */
    .stage-grid {
      position: absolute; inset: 0; pointer-events: none;
      background-image:
        linear-gradient(to right, rgba(255,255,255,0.25) 1px, transparent 1px),
        linear-gradient(to right, rgba(255,255,255,0.25) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.25) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.25) 1px, transparent 1px);
      background-size: 1px 100%, 1px 100%, 100% 1px, 100% 1px;
      background-position: 33.33% 0, 66.66% 0, 0 33.33%, 0 66.66%;
      background-repeat: no-repeat;
      opacity: 0.5;
    }

    .zoom-row { display: flex; align-items: center; gap: 12px; margin: 18px 2px 4px; }
    .zoom-ico { color: #b3b5c6; flex: none; }
    .zoom-ico.sm { font-size: 14px; }
    .zoom-ico.lg { font-size: 21px; }
    .zoom-range {
      flex: 1 1 auto; min-width: 0;
      -webkit-appearance: none; appearance: none;
      height: 4px; border-radius: 999px; background: rgba(20,22,45,0.12);
      cursor: pointer;
    }
    .zoom-range::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 20px; height: 20px; border-radius: 50%;
      background: #fff; border: 2px solid var(--ion-color-primary);
      box-shadow: 0 2px 6px rgba(20,22,31,0.28); cursor: pointer;
    }
    .zoom-range::-moz-range-thumb {
      width: 20px; height: 20px; border-radius: 50%;
      background: #fff; border: 2px solid var(--ion-color-primary);
      box-shadow: 0 2px 6px rgba(20,22,31,0.28); cursor: pointer;
    }

    .btn-row { display: flex; gap: 10px; margin: 22px 0 24px; }
    .btn {
      flex: 1 1 auto;
      display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      height: 46px; border-radius: 14px; border: 0;
      font: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
    }
    .btn ion-icon { font-size: 17px; }
    .btn.ghost { flex: 0 0 40%; background: #f1f1f6; color: #4a4d68; }
    .btn.primary { background: var(--ion-color-primary); color: #fff; }
    .btn.primary[disabled] { opacity: 0.6; }
  `],
})
export class ImageAdjustComponent implements AfterViewInit, OnDestroy {
  /** The picked file to frame. */
  @Input() file!: File;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  zoom = 1;
  busy = false;

  private img?: ImageBitmap | HTMLImageElement;
  private objectUrl = '';
  private offX = 0;             // top-left of the drawn image, in canvas px
  private offY = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private ro?: ResizeObserver;
  /** Set once the user pans/zooms. Until then a resize re-centres instead of
   *  clamping: the sheet animates in, so the first layout pass can measure a
   *  zero-width canvas and the centring computed against it would be wrong
   *  (the image ended up pinned to the top edge). */
  private touched = false;

  constructor(private modalCtrl: ModalController) {}

  async ngAfterViewInit(): Promise<void> {
    await this.load();
    this.sizeCanvas();
    this.reset();
    // The sheet animates in, so the canvas' first measurement can be 0-width.
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        this.sizeCanvas();
        if (this.touched) this.clampAndDraw(); else this.reset();
      });
      this.ro.observe(this.canvasRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.release();
  }

  private async load(): Promise<void> {
    try {
      // Same EXIF handling as the compressor, so the preview matches the upload.
      this.img = await createImageBitmap(this.file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      this.objectUrl = URL.createObjectURL(this.file);
      this.img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = this.objectUrl;
      });
    }
  }

  private release(): void {
    if (this.img && 'close' in this.img) (this.img as ImageBitmap).close();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.img = undefined;
    this.objectUrl = '';
  }

  /** Match the backing store to the element's CSS box (crisp on retina). */
  private sizeCanvas(): void {
    const c = this.canvasRef?.nativeElement;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = c.clientWidth || 1;
    const h = c.clientHeight || Math.round(w * OUT_H / OUT_W);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }

  /** Smallest scale that still covers the frame — the zoom floor. */
  private baseScale(): number {
    const c = this.canvasRef.nativeElement;
    const iw = this.img ? this.img.width : 1;
    const ih = this.img ? this.img.height : 1;
    return Math.max(c.width / iw, c.height / ih);
  }

  reset(): void {
    this.zoom = 1;
    this.touched = false;      // back to the default framing, resize-safe again
    const c = this.canvasRef?.nativeElement;
    if (!c || !this.img) return;
    const s = this.baseScale();
    this.offX = (c.width - this.img.width * s) / 2;
    this.offY = (c.height - this.img.height * s) / 2;
    this.draw();
  }

  onZoom(value: string | number): void {
    this.touched = true;
    const c = this.canvasRef.nativeElement;
    const next = Math.max(1, Math.min(3, Number(value) / 100));
    // Zoom about the frame centre so the subject doesn't drift off.
    const prevS = this.baseScale() * this.zoom;
    const nextS = this.baseScale() * next;
    const cx = c.width / 2, cy = c.height / 2;
    this.offX = cx - (cx - this.offX) * (nextS / prevS);
    this.offY = cy - (cy - this.offY) * (nextS / prevS);
    this.zoom = next;
    this.clampAndDraw();
  }

  onDown(ev: PointerEvent): void {
    this.dragging = true;
    this.touched = true;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  onMove(ev: PointerEvent): void {
    if (!this.dragging) return;
    const c = this.canvasRef.nativeElement;
    // Pointer moves in CSS px; the canvas backing store may be 2-3x that.
    const k = c.width / (c.clientWidth || 1);
    this.offX += (ev.clientX - this.lastX) * k;
    this.offY += (ev.clientY - this.lastY) * k;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    this.clampAndDraw();
  }

  onUp(ev: PointerEvent): void {
    this.dragging = false;
    (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
  }

  /** Keep the image covering the frame — never let a blank edge show. */
  private clampAndDraw(): void {
    const c = this.canvasRef.nativeElement;
    if (!this.img) return;
    const s = this.baseScale() * this.zoom;
    const dw = this.img.width * s, dh = this.img.height * s;
    this.offX = Math.min(0, Math.max(c.width - dw, this.offX));
    this.offY = Math.min(0, Math.max(c.height - dh, this.offY));
    this.draw();
  }

  private draw(): void {
    const c = this.canvasRef?.nativeElement;
    if (!c || !this.img) return;
    const ctx = c.getContext('2d')!;
    const s = this.baseScale() * this.zoom;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(this.img as CanvasImageSource, this.offX, this.offY, this.img.width * s, this.img.height * s);
  }

  /** Bake the framing to a JPEG at OUT_W×OUT_H and hand it back. */
  async confirm(): Promise<void> {
    if (!this.img || this.busy) return;
    this.busy = true;
    try {
      const c = this.canvasRef.nativeElement;
      const k = OUT_W / c.width;                 // preview → output scale factor
      const out = document.createElement('canvas');
      out.width = OUT_W;
      out.height = OUT_H;
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUT_W, OUT_H);
      const s = this.baseScale() * this.zoom * k;
      ctx.drawImage(this.img as CanvasImageSource,
        this.offX * k, this.offY * k, this.img.width * s, this.img.height * s);
      const blob = await new Promise<Blob | null>(r => out.toBlob(r, 'image/jpeg', 0.86));
      if (!blob) throw new Error('Could not process the photo');
      this.modalCtrl.dismiss(blob);
    } catch {
      this.busy = false;
      this.modalCtrl.dismiss(null);
    }
  }

  cancel(): void {
    this.modalCtrl.dismiss(null);
  }
}
