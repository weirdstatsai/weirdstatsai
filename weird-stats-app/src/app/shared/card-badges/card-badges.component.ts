import { Component, Input } from '@angular/core';
import { WeirdCard, CardType, ACCENT_COLORS } from '../../models/weird-card.model';

const TYPE_LABELS: Record<CardType, string> = {
  kpi: 'KPI card',
  chart: 'Chart card',
  ranking: 'Ranking card',
  table: 'Table card',
  map: 'Map card',
  versus: 'Versus card',
  fact: 'Fact card',
};

/**
 * Category + card-type badges, rendered ABOVE the card itself (not inside its
 * clipped/gradient box) wherever a card is shown at full size — detail view,
 * both share renderers, the OG image, and the profile draft preview. Each card
 * component still has its own internal .wcard-head for the feed/alt tiles;
 * _card-base.scss hides that internal row only at .full size so there is no
 * duplicate badge row once this external one is in place.
 */
@Component({
  selector: 'app-card-badges',
  templateUrl: './card-badges.component.html',
  styleUrls: ['./card-badges.component.scss'],
})
export class CardBadgesComponent {
  @Input() card?: WeirdCard;

  get typeLabel(): string {
    return TYPE_LABELS[this.card?.cardType as CardType] ?? '';
  }

  // Not a descendant of .wcard, so --accent isn't inherited — bind it directly
  // from the card so the category badge keeps its accent colour.
  get accent(): string {
    const h = (this.card?.uiMeta?.accentColor ?? '').trim();
    return (ACCENT_COLORS as readonly string[]).includes(h) ? h : ACCENT_COLORS[0];
  }
}
