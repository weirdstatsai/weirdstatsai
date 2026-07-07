import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getAnimalSvg } from '../../animal-icons';
import { WeirdCard, ACCENT_COLORS } from '../../../models/weird-card.model';

@Component({
  selector: 'app-card-fact',
  templateUrl: './card-fact.component.html',
  styleUrls: ['./card-fact.component.scss'],
})
export class CardFactComponent implements OnChanges {
  @Input() card!: WeirdCard;
  @Input() size: 'feed' | 'full' | 'alt' = 'feed';
  @Input() fontSize: 'small' | 'medium' | 'large' = 'medium';

  accent = '#6C5CE7';
  gradFrom = '#f5f3ff';
  gradTo   = '#ffffff';

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * The owner's saved font-size choice (uiMeta.factFontSize) wins over the
   * `fontSize` input default, so a size picked on the detail page also shows
   * on the small feed tile — falling back to the input when none was saved.
   */
  get effectiveFontSize(): 'small' | 'medium' | 'large' {
    return this.card?.uiMeta?.factFontSize ?? this.fontSize;
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
  }
}
