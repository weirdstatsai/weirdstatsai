/**
 * Group raw text runs into paragraph-level blocks.
 *
 * pdf.js hands back hundreds of short runs with no notion of "paragraph". We
 * cluster them: runs on the same baseline become a line, and vertically-close,
 * horizontally-overlapping lines become a block. The block is the unit the lens
 * snaps to — landing the user on coherent prose, never half a sentence.
 */
import type { TextItem, TextBlock, Rect } from '../core/types';

interface Line {
  items: TextItem[];
  rect: Rect;
}

function boundsOf(rects: Rect[]): Rect {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}

/** Cluster runs sharing a baseline into lines (left-to-right). */
function toLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  const lines: Line[] = [];
  for (const item of sorted) {
    const tol = item.fontHeight * 0.6;
    const line = lines.find(
      (l) => Math.abs(l.items[0].rect.top - item.rect.top) <= tol,
    );
    if (line) {
      line.items.push(item);
      line.rect = boundsOf(line.items.map((i) => i.rect));
    } else {
      lines.push({ items: [item], rect: { ...item.rect } });
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.rect.left - b.rect.left);
  }
  return lines.sort((a, b) => a.rect.top - b.rect.top);
}

function lineText(line: Line): string {
  return line.items
    .map((i) => i.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function horizontallyOverlap(a: Rect, b: Rect): boolean {
  const ax2 = a.left + a.width;
  const bx2 = b.left + b.width;
  const overlap = Math.min(ax2, bx2) - Math.max(a.left, b.left);
  return overlap > Math.min(a.width, b.width) * 0.15;
}

/**
 * Merge lines into paragraph blocks. A new block starts when the vertical gap
 * jumps (heading / paragraph break) or the columns stop overlapping.
 */
export function extractBlocks(items: TextItem[], pageIndex: number): TextBlock[] {
  const lines = toLines(items);
  if (!lines.length) return [];

  const groups: Line[][] = [];
  let current: Line[] = [];

  for (const line of lines) {
    if (current.length === 0) {
      current = [line];
      continue;
    }
    const prev = current[current.length - 1];
    const gap = line.rect.top - (prev.rect.top + prev.rect.height);
    const lineHeight = Math.max(prev.rect.height, line.rect.height);
    const sameParagraph = gap < lineHeight * 0.9 && horizontallyOverlap(prev.rect, line.rect);
    if (sameParagraph) {
      current.push(line);
    } else {
      groups.push(current);
      current = [line];
    }
  }
  if (current.length) groups.push(current);

  return groups.map((group, i) => {
    const rect = boundsOf(group.map((l) => l.rect));
    const text = group.map(lineText).join(' ').replace(/\s+/g, ' ').trim();
    return {
      id: `p${pageIndex}-${i}`,
      pageIndex,
      text,
      rect,
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    };
  });
}
