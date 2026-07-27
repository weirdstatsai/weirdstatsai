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
/**
 * True when a ranking/table has real, comparable numbers to rank BY — i.e. ≥2
 * labelled rows whose values aren't all zero and aren't all identical (there's
 * variance to order on). When false, the items are a curated *list* ("top
 * animes"), not a measured ranking, and should render as a clean ordered list
 * rather than a numeric ranking with empty bars/gauges. Single source of truth
 * for both the render-time style gate and the alternatives picker.
 */
export function rowsHaveMetric(card: WeirdCard | null | undefined): boolean {
  const vals = (card?.rows ?? [])
    .filter(r => r && String(r.label ?? '').trim())
    .map(r => Number(r?.value))
    .filter(v => Number.isFinite(v));
  if (vals.length < 2 || new Set(vals).size <= 1) return false;
  // Variance alone isn't enough: the agent often echoes the RANK as the value
  // (1, 2, 3…), which has variance but is not a metric — bars would just show
  // 20%…100% of nothing. isCuratedList catches that and the all-zero case.
  return !isCuratedList(card);
}

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

/**
 * True when a ranking/table's row values are NOT a real comparable metric.
 *
 * The backend's LIST-vs-METRIC rule tells the agent that a curated "top/best X"
 * list (best SUVs, top anime) has no honest number to rank by, and to emit
 * `value: 0` with a short note in `extra` instead. In practice the model also
 * echoes the rank as the value (1,2,3…) or repeats one identical figure. All
 * three render as meaningless bars and a stray "0" next to every row, which is
 * worse than showing nothing — so callers should fall back to a clean
 * rank + name + note list.
 */
export function isCuratedList(card: { rows?: Array<{ value: number }> } | null | undefined): boolean {
  const rows = card?.rows ?? [];
  if (rows.length < 2) return false;
  const vals = rows.map(r => Number(r.value));
  if (vals.some(v => !isFinite(v))) return false;
  if (vals.every(v => v === 0)) return true;              // the documented signal
  if (vals.every((v, i) => v === i + 1)) return true;     // value is just the rank
  if (vals.every(v => v === vals[0])) return true;        // one repeated figure
  return false;
}
