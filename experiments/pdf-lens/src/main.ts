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
import { layoutOrbit, type CubeBox } from './cubes/orbit-layout';
import type { Hotspot, TextBlock } from './core/types';

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

// ---- cubes ----
function spawnCubes(h: Hotspot): void {
  cubeEls.forEach((c) => c.remove());
  cubeEls = [];
  connectors.replaceChildren();
  if (!lens) return;

  // Build + measure cubes offscreen first.
  const boxes: CubeBox[] = [];
  for (const card of h.cards) {
    const cube = renderCube(card);
    cube.style.visibility = 'hidden';
    content.appendChild(cube);
    cubeEls.push(cube);
    boxes.push({ width: cube.offsetWidth, height: cube.offsetHeight });
  }

  const lp = lens.position;
  const placements = layoutOrbit({
    lens: { x: lp.x, y: lp.y, radius: lens.radius },
    stage: { width: content.clientWidth, height: content.clientHeight },
    cubes: boxes,
  });

  connectors.setAttribute('width', String(content.clientWidth));
  connectors.setAttribute('height', String(content.clientHeight));

  placements.forEach((p, i) => {
    const cube = cubeEls[i];
    cube.style.left = `${p.x}px`;
    cube.style.top = `${p.y}px`;
    cube.style.visibility = 'visible';
    cube.style.animationDelay = `${i * 45}ms`;

    // Grow away from the lens on hover/click so the enlarged card stays clear.
    const cubeCx = p.x + boxes[i].width / 2;
    const cubeCy = p.y + boxes[i].height / 2;
    cube.style.transformOrigin =
      `${cubeCx <= lp.x ? 'right' : 'left'} ${cubeCy <= lp.y ? 'bottom' : 'top'}`;
    cube.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = cube.classList.contains('active');
      cubeEls.forEach((c) => c.classList.remove('active'));
      if (!wasActive) cube.classList.add('active');
    });

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(lp.x));
    line.setAttribute('y1', String(lp.y));
    line.setAttribute('x2', String(p.anchorX));
    line.setAttribute('y2', String(p.anchorY));
    connectors.appendChild(line);
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
