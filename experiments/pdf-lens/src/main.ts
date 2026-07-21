/**
 * PDF-Lens prototype — orchestrator.
 *
 * Flow: open a PDF → render pages + extract text → group into blocks → analyze
 * for stat "hotspots" → the magnetic lens snaps between hotspots → each landing
 * spawns orbiting stat cubes. All isolated from the WeirdStats app.
 */
import './ui/styles.css';
import { loadPdf, renderPage, fitScale, type RenderedPage } from './pdf/pdf-renderer';
import { extractBlocks } from './pdf/text-blocks';
import { HeuristicAnalyzer } from './hotspot/heuristic-analyzer';
import { Lens } from './lens/lens';
import { renderCube } from './cubes/stat-cube';
import type { Hotspot, TextBlock } from './core/types';

const TILE_HALF = 23;  // half the resting icon size (46px)
const TILE_GAP = 12;   // gap between the window edge and the icon

const PAGE_TARGET_WIDTH = 720; // css px the page is rendered to
const PAGE_GAP = 24;
const MAX_PAGES = 8;
const analyzer = new HeuristicAnalyzer();

interface PageLayer { canvas: HTMLCanvasElement; offsetY: number; }

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="top">
    <div class="brand">
      <span class="mark">◔</span>
      <div>WeirdStats <small>PDF Lens · prototype</small></div>
    </div>
    <div class="spacer"></div>
    <div class="stat-count" id="count"></div>
    <button class="btn" id="sample">Load sample</button>
    <button class="btn primary" id="open">Open PDF</button>
    <input type="file" id="file" accept="application/pdf" hidden />
  </div>
  <div class="stage" id="stage">
    <div class="content" id="content">
      <svg class="connectors" id="connectors"></svg>
    </div>
    <div class="hint" id="hint" hidden>Drag the <b>lens</b> — it snaps to spots that hold a stat</div>
    <div class="overlay" id="overlay"></div>
  </div>
`;

const content = document.getElementById('content') as HTMLDivElement;
const connectors = document.getElementById('connectors') as unknown as SVGSVGElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const hint = document.getElementById('hint') as HTMLDivElement;
const countEl = document.getElementById('count') as HTMLDivElement;
const fileInput = document.getElementById('file') as HTMLInputElement;

let pageLayers: PageLayer[] = [];
let lens: Lens | null = null;
let cubeEls: HTMLElement[] = [];

const dropMarkup = (note: string) => `
  <div class="drop" id="drop">
    <div class="big">📄🔎</div>
    <h2>Drop a PDF to find its stats</h2>
    <p>${note}</p>
    <div class="row">
      <button class="btn primary" id="open2">Open a PDF</button>
      <button class="btn" id="sample2">Try the sample</button>
    </div>
  </div>`;
const DEFAULT_NOTE = 'The lens will only land where real data lives — no empty spots, no invented numbers.';

// ---- open / sample wiring (top-bar buttons are stable) ----
const pick = () => fileInput.click();
document.getElementById('open')!.addEventListener('click', pick);
document.getElementById('sample')!.addEventListener('click', () => loadUrl('sample.pdf'));
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) f.arrayBuffer().then(open);
});

// Overlay content is re-rendered on state change, so (re)bind its buttons each time.
function renderDrop(note = DEFAULT_NOTE): void {
  overlay.hidden = false;
  overlay.innerHTML = dropMarkup(note);
  overlay.querySelector('#open2')!.addEventListener('click', pick);
  overlay.querySelector('#sample2')!.addEventListener('click', () => loadUrl('sample.pdf'));
  const el = overlay.querySelector('#drop') as HTMLElement;
  ['dragover', 'dragleave', 'drop'].forEach((ev) =>
    el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.toggle('over', ev === 'dragover'); }),
  );
  el.addEventListener('drop', (e) => {
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f && f.type === 'application/pdf') f.arrayBuffer().then(open);
  });
}
renderDrop();

async function loadUrl(url: string): Promise<void> {
  showLoading('Loading document…');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    await open(await res.arrayBuffer());
  } catch {
    renderDrop('Could not load that PDF — try opening your own.');
  }
}

function showLoading(text: string): void {
  overlay.hidden = false;
  overlay.innerHTML = `<div class="drop"><div class="spinner"></div><div class="loading-text">${text}</div></div>`;
}

// ---- core pipeline ----
function open(data: ArrayBuffer): Promise<void> {
  return runPipeline(data).catch((e) => {
    console.error('PDF-Lens pipeline failed:', e);
    renderDrop('Something went wrong reading that PDF — try another file.');
  });
}

async function runPipeline(data: ArrayBuffer): Promise<void> {
  showLoading('Rendering pages…');
  reset();

  const pdf = await loadPdf(data);
  const page1 = await pdf.getPage(1);
  const scale = fitScale(page1.getViewport({ scale: 1 }).width, PAGE_TARGET_WIDTH);

  const total = Math.min(pdf.numPages, MAX_PAGES);
  const rendered: RenderedPage[] = [];
  for (let i = 0; i < total; i++) rendered.push(await renderPage(pdf, i, scale));

  // Lay pages out vertically in content space and collect blocks (translated).
  let offsetY = 0;
  let maxW = 0;
  const blocks: TextBlock[] = [];
  for (const page of rendered) {
    const canvas = page.canvas;
    canvas.className = 'page-canvas';
    canvas.style.top = `${offsetY}px`;
    canvas.style.width = `${page.width / (Math.min(window.devicePixelRatio || 1, 2))}px`;
    content.appendChild(canvas);
    pageLayers.push({ canvas, offsetY });

    for (const b of extractBlocks(page.items, page.pageIndex)) {
      // translate into content space (add page offset)
      b.rect = { ...b.rect, top: b.rect.top + offsetY };
      b.center = { x: b.center.x, y: b.center.y + offsetY };
      blocks.push(b);
    }
    maxW = Math.max(maxW, page.width);
    offsetY += page.height + PAGE_GAP;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  content.style.width = `${maxW / dpr}px`;
  content.style.height = `${offsetY / dpr}px`;
  // page canvases are in device px; scale content coords back to css px
  scaleLayers(dpr);

  showLoading('Finding stats…');
  const hotspots = await analyzer.analyze(blocks.map((b) => scaleBlock(b, dpr)));

  overlay.hidden = true;
  hint.hidden = false;
  countEl.innerHTML = `<b>${hotspots.length}</b> stat spot${hotspots.length === 1 ? '' : 's'} found`;

  lens = new Lens(content, {
    size: 210,
    onLock: (h) => spawnCubes(h),
  });
  lens.setHotspots(hotspots);
}

/** Page canvases render in device px; display + coordinate space use css px. */
function scaleLayers(dpr: number): void {
  for (const layer of pageLayers) {
    const cssTop = layer.offsetY / dpr;
    layer.canvas.style.top = `${cssTop}px`;
    layer.offsetY = cssTop;
  }
}
function scaleBlock(b: TextBlock, dpr: number): TextBlock {
  const s = (n: number) => n / dpr;
  return {
    ...b,
    rect: { left: s(b.rect.left), top: s(b.rect.top), width: s(b.rect.width), height: s(b.rect.height) },
    center: { x: s(b.center.x), y: s(b.center.y) },
  };
}

// ---- stat tiles ----
// Small square icon tiles distributed around the PERIMETER of the lens window.
// Each hugs its edge and expands OUTWARD (away from the window) on hover/click.
type Side = 'top' | 'right' | 'bottom' | 'left';

function placeTile(cube: HTMLElement, side: Side, cx: number, cy: number): void {
  const cw = content.clientWidth;
  const ch = content.clientHeight;
  cube.style.left = cube.style.right = cube.style.top = cube.style.bottom = 'auto';
  // Anchor the edge nearest the window so growth pushes outward; center the
  // tile on the other axis so it stays lined up with its icon.
  if (side === 'top') {
    cube.style.left = `${cx}px`;
    cube.style.bottom = `${ch - (cy + TILE_HALF)}px`;
    cube.style.transform = 'translateX(-50%)';
  } else if (side === 'bottom') {
    cube.style.left = `${cx}px`;
    cube.style.top = `${cy - TILE_HALF}px`;
    cube.style.transform = 'translateX(-50%)';
  } else if (side === 'left') {
    cube.style.top = `${cy}px`;
    cube.style.right = `${cw - (cx + TILE_HALF)}px`;
    cube.style.transform = 'translateY(-50%)';
  } else {
    cube.style.top = `${cy}px`;
    cube.style.left = `${cx - TILE_HALF}px`;
    cube.style.transform = 'translateY(-50%)';
  }
}

function spawnCubes(h: Hotspot): void {
  cubeEls.forEach((c) => c.remove());
  cubeEls = [];
  connectors.replaceChildren();
  if (!lens) return;

  const lp = lens.position;
  const r = lens.radius;
  const n = h.cards.length;
  const out = r + TILE_GAP + TILE_HALF; // distance from center to an icon's center

  h.cards.forEach((card, i) => {
    const cube = renderCube(card);
    // Spread evenly around the window, projecting each angle onto the square.
    const ang = (-90 + (i * 360) / n) * (Math.PI / 180);
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const t = r / Math.max(Math.abs(dx), Math.abs(dy)); // hit point on the square border
    const bx = lp.x + dx * t;
    const by = lp.y + dy * t;

    let side: Side;
    let cx: number;
    let cy: number;
    if (Math.abs(dx) > Math.abs(dy)) {
      side = dx > 0 ? 'right' : 'left';
      cx = dx > 0 ? lp.x + out : lp.x - out;
      cy = by;
    } else {
      side = dy > 0 ? 'bottom' : 'top';
      cy = dy > 0 ? lp.y + out : lp.y - out;
      cx = bx;
    }

    cube.classList.add(`side-${side}`);
    placeTile(cube, side, cx, cy);
    cube.style.animationDelay = `${i * 40}ms`;
    cube.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = cube.classList.contains('active');
      cubeEls.forEach((c) => c.classList.remove('active'));
      if (!wasActive) cube.classList.add('active');
    });
    content.appendChild(cube);
    cubeEls.push(cube);
  });
}

function reset(): void {
  pageLayers = [];
  cubeEls = [];
  lens = null;
  content.querySelectorAll('.page-canvas, .hotspot, .lens, .cube').forEach((n) => n.remove());
  connectors.replaceChildren();
  hint.hidden = true;
  countEl.textContent = '';
}
