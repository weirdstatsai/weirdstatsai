import { Component, Input, OnChanges, AfterViewInit, OnDestroy, ElementRef, NgZone } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, ACCENT_COLORS } from '../../../models/weird-card.model';

/** The fact card renders in one of a small set of fixed layouts. Poster is the
 *  as-generated default; editorial is a pull-quote; split pairs a colour panel
 *  with the text. All three live inside the SAME fixed frame — the text
 *  auto-shrinks to fit (see fit()) so the whole fact always shows, uncut. */
export type FactStyle = 'poster' | 'editorial' | 'split';

/** Style choices offered by the detail-page picker. Single source of truth. */
export const FACT_STYLES: Array<{ key: FactStyle; label: string }> = [
  { key: 'poster',    label: 'Poster' },
  { key: 'editorial', label: 'Editorial' },
  { key: 'split',     label: 'Split' },
];

@Component({
  selector: 'app-card-fact',
  templateUrl: './card-fact.component.html',
  styleUrls: ['./card-fact.component.scss'],
})
export class CardFactComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  /** Explicit style override — set by the alt-style previews. When absent the
   *  live card falls back to the owner's saved choice (uiMeta.selectedStyle). */
  @Input() factStyle?: FactStyle;

  accent = '#6C5CE7';
  gradFrom = '#f5f3ff';
  gradTo   = '#ffffff';

  private ro?: ResizeObserver;
  private raf = 0;

  constructor(
    private sanitizer: DomSanitizer,
    private host: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) {}

  /** Layout in effect: explicit input first, then the saved style, then poster. */
  get effStyle(): FactStyle {
    const s = this.factStyle ?? (this.card?.uiMeta?.selectedStyle as FactStyle | undefined);
    return (s === 'editorial' || s === 'split') ? s : 'poster';
  }

  get bgSvg(): SafeHtml | null {
    const svg = getAnimalSvg(this.card?.uiMeta?.icon ?? '');
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }

  ngOnChanges(): void {
    const h = (this.card?.uiMeta?.accentColor ?? '').trim();
    this.accent   = (ACCENT_COLORS as readonly string[]).includes(h) ? h : ACCENT_COLORS[0];
    this.gradFrom = this.card?.uiMeta?.gradientFrom || '#f5f3ff';
    this.gradTo   = this.card?.uiMeta?.gradientTo   || '#ffffff';
    this.scheduleFit();
  }

  ngAfterViewInit(): void {
    this.scheduleFit();
    // Re-fit whenever the card's box changes (column count, orientation, the
    // detail frame). Skipped for the tiny alt previews.
    if (this.size !== 'alt' && typeof ResizeObserver !== 'undefined') {
      const frame = this.frameEl();
      if (frame) {
        this.zone.runOutsideAngular(() => {
          this.ro = new ResizeObserver(() => this.scheduleFit());
          this.ro.observe(frame);
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  private frameEl(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.wcard');
  }

  private scheduleFit(): void {
    if (this.size === 'alt') return;
    if (typeof requestAnimationFrame === 'undefined') return;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame(() => { this.raf = 0; this.fit(); });
    });
  }

  /**
   * Shrink the text (via the `--ft` multiplier the scss applies to every font
   * size) until the whole fact fits the frame — so no title or body is ever
   * clipped. The available box is the HOST element: in the feed it's the fixed
   * grid tile, in the detail view it's the fixed 360px frame. The `.wcard`
   * itself can grow past that (min-height), so we measure the card's content
   * height (its scrollHeight) against the host and step down until it fits.
   * One rAF pass, floored so the type never turns microscopic.
   */
  private fit(): void {
    const frame = this.frameEl();
    if (!frame) return;
    const available = this.host.nativeElement.clientHeight;
    if (available <= 0) return;

    frame.style.setProperty('--ft', '1');
    let ft = 1;
    for (let i = 0; i < 16 && frame.scrollHeight > available + 1 && ft > 0.42; i++) {
      ft = Math.max(0.42, ft - 0.06);
      frame.style.setProperty('--ft', String(ft));
    }
  }
}
