# PDF Lens — prototype

An isolated experiment: **upload a PDF, and a magnetic "lens" snaps only to the
places that contain real data, spawning stat cards that orbit the lens.** It's a
proof-of-concept for a future WeirdStats feature.

> **Fully isolated from the main app.** This folder is never built or deployed by
> the WeirdStats pipelines — Firebase Hosting only serves `weird-stats-app/www`
> and Render only builds `services/backend`. Nothing here can affect the live app.

---

## The idea

1. **Scan** — on upload, the whole document's text is analyzed once to find
   *stat hotspots*: paragraphs rich enough in data to produce a stat card. Each
   hotspot records which of the six card types it can support.
2. **Land** — the lens can be dragged, but it is *magnetic*: it only ever locks
   onto a hotspot. Dead zones (narrative prose, headings) are unreachable, so the
   tool never lands on empty text and never invents numbers.
3. **Orbit** — when the lens locks on, the hotspot's stat cards appear as small
   cubes around the lens, with connector lines back to it.

The six card types mirror the WeirdStats `CardType` union **minus `fact`**
(`kpi · chart · ranking · versus · table · map`) — "all stats except the facts".

---

## Run it

```bash
cd experiments/pdf-lens
npm install
npm run dev          # http://localhost:4321  → click "Load sample"
```

Other scripts:

```bash
npm run build        # typecheck (tsc --noEmit) + production build to dist/
npm run preview      # serve the built dist/ on :4321
python3 tools/make_sample.py   # regenerate public/sample.pdf (needs reportlab)
```

---

## Architecture

The code is deliberately modular so it can port into WeirdStats later. Data
flows one direction: **PDF → text blocks → hotspots → lens → cubes.**

| Module | Responsibility |
|---|---|
| `src/pdf/pdf-renderer.ts` | Render pages (pdf.js) and project every text run into device pixels — the accuracy-critical layer. |
| `src/pdf/text-blocks.ts` | Cluster raw runs into paragraph-level blocks with bounding boxes (the unit the lens snaps to). |
| `src/hotspot/heuristic-analyzer.ts` | The **swappable** `StatAnalyzer`. Scores each block and derives supported card types + previews. |
| `src/lens/lens.ts` | The magnetic loupe: drag, magnetic pull, snap-to-hotspot, hotspot markers, live magnifier. |
| `src/cubes/stat-cube.ts` | Renders one orbiting cube per card type (kpi/chart/ranking/versus/table/map). |
| `src/cubes/orbit-layout.ts` | Places cubes around the lens, biased toward open space near page edges. |
| `src/core/types.ts` | Shared domain types, aligned with the WeirdStats `WeirdCard` model. |
| `src/main.ts` | Orchestrator — upload, render, analyze, wire the lens + cubes. |

### The one seam that matters: `StatAnalyzer`

```ts
interface StatAnalyzer {
  analyze(blocks: TextBlock[]): Promise<Hotspot[]>;
}
```

Everything downstream (lens, cubes, layout) depends only on this interface. The
prototype ships `HeuristicAnalyzer` — **fully offline, no API keys** — which
finds hotspots by number/percentage density and builds previews from the block's
*actual* numbers. To go to production, implement this same interface with a call
to the WeirdStats backend (a new `/api/analyze` endpoint that turns a text block
into real `WeirdCard`s) and swap it in `main.ts`. Nothing else changes.

---

## What's real vs. mocked

**Real:** PDF rendering, text extraction with coordinates, paragraph grouping,
the magnetic lens + magnifier, hotspot detection, cube layout, the "never land on
empty text" guarantee. The sample's narrative paragraph produces **no** hotspot —
demonstrating the tool won't fabricate stats.

**Mocked (until the AI analyzer is wired):** the *quality* of the extracted
stats. The heuristic derives plausible numbers from the text but doesn't reason
about them the way an LLM would.

---

## Known limitations / next steps

- **Digital PDFs only.** Scanned/image PDFs need OCR (tesseract.js) — deferred.
- **Heuristic is approximate.** It can mislabel which numbers are "the" metric;
  the AI analyzer replaces this. (Bare years like `2024` are already filtered.)
- **Cube-vs-cube overlap.** `orbit-layout` avoids screen edges but dense hotspots
  (5–6 cards) can still overlap each other — needs pairwise collision resolution.
- **Single-column assumption** in block grouping; multi-column layouts need work.
- **Mobile** ergonomics (a lens + 6 cubes on a phone) are the biggest open UX
  question and are not yet tuned.
