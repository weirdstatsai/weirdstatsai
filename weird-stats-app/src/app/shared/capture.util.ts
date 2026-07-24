/**
 * Pin a capture frame's live layout as inline styles before a dom-to-image
 * render, and restore afterwards.
 *
 * Why: dom-to-image renders a CLONE of the node inside an offscreen SVG
 * foreignObject. In that context the browser re-resolves styles — and
 * container-query units (the premium story card's whole type scale is
 * `clamp(..cqw..)`) do NOT resolve against the real card container there, so
 * fonts blow up to their clamp caps while the layout boxes keep their real
 * width. Result: split hero numbers ("8"/"6" on separate lines), wrapped
 * units, overlapping labels — but only in the shared/downloaded PNG, never on
 * screen. Media-query- and font-fallback-driven reflow in the clone cause
 * subtler versions of the same drift.
 *
 * Freezing every layout-relevant computed value (already resolved to px by the
 * live render) onto each element's inline style makes the clone a faithful
 * pixel copy of what's on screen: the clone has nothing left to re-resolve.
 */

const FREEZE_PROPS = [
  'font-size', 'line-height', 'letter-spacing',
  'width', 'height',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'row-gap', 'column-gap', 'flex-basis', 'border-radius',
] as const;

/**
 * Inline the computed layout of `root` and every descendant. Returns a restore
 * function that puts the original inline styles back — call it in a `finally`
 * so a failed capture can never leave the live DOM pinned.
 *
 * Two phases, strictly read-then-write: neutralizing `container-type` (or even
 * pinning a parent's box) mid-walk would make every LATER getComputedStyle
 * re-resolve cqw against the viewport and pin the blown-up values — the very
 * bug this util exists to prevent.
 */
export function freezeCaptureLayout(root: HTMLElement): () => void {
  const els: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

  // Phase 1 — READ everything while the live layout (container queries
  // included) is fully intact. No DOM writes of any kind in this pass.
  const snapshots = els.map(el => {
    const cs = getComputedStyle(el);
    return {
      el,
      inline: el.getAttribute('style'),
      values: FREEZE_PROPS.map(p => cs.getPropertyValue(p)),
      isCqContainer: cs.getPropertyValue('container-type') !== '' &&
                     cs.getPropertyValue('container-type') !== 'normal',
    };
  });

  // Phase 2 — WRITE the pinned values (+ neutralize container queries: their
  // outputs are now inlined, and inline styles out-rank the stylesheet's cq
  // clamps in the clone, so nothing is left for the clone to re-resolve).
  for (const s of snapshots) {
    FREEZE_PROPS.forEach((p, i) => {
      if (s.values[i]) s.el.style.setProperty(p, s.values[i]);
    });
    if (s.isCqContainer) s.el.style.setProperty('container-type', 'normal');
  }

  return () => {
    for (const s of snapshots) {
      if (s.inline === null) s.el.removeAttribute('style');
      else s.el.setAttribute('style', s.inline);
    }
  };
}
