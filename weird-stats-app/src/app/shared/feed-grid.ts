/**
 * Shared layout logic for the 2-column card feed grids (Home, Explore).
 *
 * A half-width card is "standalone" when it sits in the left column and no
 * card will fill the right column beside it — because the next card is
 * full-width (forces a row break) or there is no next card. Standalone cards
 * span the full row so the grid never shows a hole.
 *
 * The column can't be derived by simply counting previous half-width cards:
 * standalone cards consume the entire row too, so the walk has to replay the
 * grid's packing decisions from the start.
 */
export function isStandaloneInGrid<T>(
  cards: T[],
  index: number,
  isFullWidth: (card: T) => boolean,
): boolean {
  if (index < 0 || index >= cards.length || isFullWidth(cards[index])) return false;

  let col = 0;
  for (let i = 0; i < index; i++) {
    if (isFullWidth(cards[i])) {
      col = 0;
      continue;
    }
    if (col === 0) {
      const next = cards[i + 1];
      const standalone = !next || isFullWidth(next);
      col = standalone ? 0 : 1;
    } else {
      col = 0;
    }
  }

  if (col !== 0) return false;
  const next = cards[index + 1];
  return !next || isFullWidth(next);
}
