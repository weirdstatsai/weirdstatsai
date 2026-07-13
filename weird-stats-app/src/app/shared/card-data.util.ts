import { WeirdCard } from '../models/weird-card.model';

/**
 * Frontend mirror of the backend's `card_data_ok` gate (validator.py).
 *
 * True when a card actually carries the data its cardType needs to render.
 * Used to stop a hollow card (empty chart, row-less ranking, value-less kpi)
 * from being shared/published as a "No data available" shell. The backend now
 * repairs/degrades hollow cards at generation time, so this is defence-in-depth
 * for cards already stored before that fix, and a guard on share/publish.
 */
export function cardHasData(card: WeirdCard | null | undefined): boolean {
  if (!card) return false;
  const rows = (card.rows ?? []).filter(r => r && String(r.label ?? '').trim());
  switch (card.cardType) {
    case 'chart':
      return (card.labels?.length ?? 0) > 0
        && (card.datasets ?? []).some(d => (d?.data?.length ?? 0) > 0);
    case 'ranking':
    case 'table':
    case 'map':
      return rows.length >= 1;
    case 'versus':
      return rows.length >= 2;
    case 'kpi':
      return card.metric?.value != null || rows.length >= 1;
    case 'fact':
      return !!String(card.insight ?? '').trim();
    default:
      return true;
  }
}
