/**
 * PDF-Lens prototype — orchestrator.
 *
 * Flow: open a PDF → render pages + extract text → group into blocks → analyze
 * for stat "hotspots". The square is a *tool*: click it to pick it up (the page
 * blurs except the sharp square), move the cursor to roam (snapping to stat
 * spots), click to drop it on the page → the stats zoom in as a panel on the
 * right. Cancel closes the panel and releases the tool. Isolated from the app.
 */
import './ui/styles.css';
import { loadPdf, renderPage, fitScale, type RenderedPage } from './pdf/pdf-renderer';
import { extractBlocks } from './pdf/text-blocks';
import { HeuristicAnalyzer } from './hotspot/heuristic-analyzer';
import { Lens } from './lens/lens';
import { renderCube } from './cubes/stat-cube';
import type { Hotspot, TextBlock } from './core/types';

const PAGE_TARGET_WIDTH = 720; // css px the page is rendered to
const PAGE_GAP = 24;
const MAX_PAGES = 8;
const analyzer = new HeuristicAnalyzer();

interface PageLayer { canvas: HTMLCanvasElement; offsetY: number; }
type Mode = 'idle' | 'roaming' | 'locked';

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
      <div class="pages" id="pages"></div>
      <div class="scrim" id="scrim"></div>
    </div>
    <aside class="stat-panel" id="statPanel" hidden>
      <div class="stat-panel-head">
        <span class="stat-panel-title">Stats in this spot</span>
        <button class="stat-cancel" id="statCancel">✕ Cancel</button>
      </div>
      <div class="stat-panel-body" id="statBody"></div>
    </aside>
    <div class="hint" id="hint" hidden></div>
    <div class="overlay" id="overlay"></div>
  </div>
`;

const content = document.getElementById('content') as HTMLDivElement;
const pages = document.getElementById('pages') as HTMLDivElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const hint = document.getElementById('hint') as HTMLDivElement;
const countEl = document.getElementById('count') as HTMLDivElement;
const fileInput = document.getElementById('file') as HTMLInputElement;
const statPanel = document.getElementById('statPanel') as HTMLElement;
const statBody = document.getElementById('statBody') as HTMLDivElement;
document.getElementById('statCancel')!.addEventListener('click', cancel);

let pageLayers: PageLayer[] = [];
let lens: Lens | null = null;
let mode: Mode = 'idle';

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
const DEFAULT_NOTE = 'The lens only lands where real data lives — no empty spots, no invented numbers.';

// ---- open / sample wiring (top-bar buttons are stable) ----
const pick = () => fileInput.click();
document.getElementById('open')!.addEventListener('click', pick);
document.getElementById('sample')!.addEventListener('click', () => loadUrl('sample.pdf'));
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) f.arrayBuffer().then(open);
});

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

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let offsetY = 0;
  let maxW = 0;
  const blocks: TextBlock[] = [];
  for (const page of rendered) {
    const canvas = page.canvas;
    canvas.className = 'page-canvas';
    canvas.style.top = `${offsetY / dpr}px`;
    canvas.style.width = `${page.width / dpr}px`;
    pages.appendChild(canvas);
    pageLayers.push({ canvas, offsetY: offsetY / dpr });

    for (const b of extractBlocks(page.items, page.pageIndex)) {
      b.rect = { ...b.rect, top: b.rect.top + offsetY };
      b.center = { x: b.center.x, y: b.center.y + offsetY };
      blocks.push(b);
    }
    maxW = Math.max(maxW, page.width);
    offsetY += page.height + PAGE_GAP;
  }
  content.style.width = `${maxW / dpr}px`;
  content.style.height = `${offsetY / dpr}px`;

  showLoading('Finding stats…');
  const hotspots = await analyzer.analyze(blocks.map((b) => scaleBlock(b, dpr)));

  overlay.hidden = true;
  countEl.innerHTML = `<b>${hotspots.length}</b> stat spot${hotspots.length === 1 ? '' : 's'} found`;
  setHint('Click the <b>square</b> to pick up the lens');

  lens = new Lens(content, { size: 200, drawCutout });
  lens.setHotspots(hotspots, lockAt); // clicking a hotspot marker locks straight onto it
  lens.element.addEventListener('click', () => { if (mode === 'idle') startRoaming(); });
  mode = 'idle';
}

function scaleBlock(b: TextBlock, dpr: number): TextBlock {
  const s = (n: number) => n / dpr;
  return {
    ...b,
    rect: { left: s(b.rect.left), top: s(b.rect.top), width: s(b.rect.width), height: s(b.rect.height) },
    center: { x: s(b.center.x), y: s(b.center.y) },
  };
}

/** Paint a sharp 1:1 cutout of the page under the lens (so it stays crisp while
 *  the rest of the page is blurred). */
function drawCutout(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const layer = pageLayers.find((l) => cy >= l.offsetY && cy < l.offsetY + l.canvas.height / dpr) ?? pageLayers[0];
  if (!layer) return;
  const sx = (cx - size / 2) * dpr;
  const sy = (cy - layer.offsetY - size / 2) * dpr;
  try {
    ctx.drawImage(layer.canvas, sx, sy, size * dpr, size * dpr, 0, 0, size, size);
  } catch { /* out of bounds near edges — keep the white fill */ }
}

// ---- tool state machine ----
function contentPoint(e: PointerEvent | MouseEvent): { x: number; y: number } {
  const r = content.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onRoamMove(e: PointerEvent): void {
  if (mode !== 'roaming' || !lens) return;
  const p = contentPoint(e);
  const near = lens.nearestTo(p.x, p.y);
  if (near) {
    const dx = near.block.center.x - p.x;
    const dy = near.block.center.y - p.y;
    const pull = Math.max(0, 1 - Math.hypot(dx, dy) / 240) ** 2; // magnetic near a spot
    lens.place(p.x + dx * pull, p.y + dy * pull);
    lens.markActive(near);
  } else {
    lens.place(p.x, p.y);
  }
}

function onRoamClick(): void {
  if (mode !== 'roaming' || !lens) return;
  const near = lens.nearestTo(lens.position.x, lens.position.y);
  if (near) lockAt(near);
}

function startRoaming(): void {
  if (!lens || mode !== 'idle') return;
  mode = 'roaming';
  content.classList.add('tool-active');
  lens.setTool(true);
  setHint('Move over the document — click a highlighted spot to analyze');
  window.addEventListener('pointermove', onRoamMove);
  // Defer so the click that picked up the lens doesn't immediately drop it.
  setTimeout(() => window.addEventListener('click', onRoamClick), 0);
}

function lockAt(h: Hotspot): void {
  if (!lens) return;
  window.removeEventListener('pointermove', onRoamMove);
  window.removeEventListener('click', onRoamClick);
  mode = 'locked';
  content.classList.add('tool-active', 'locked');
  lens.setTool(true);
  lens.place(h.block.center.x, h.block.center.y);
  lens.markActive(h);
  openPanel(h);
  setHint('');
}

function cancel(): void {
  window.removeEventListener('pointermove', onRoamMove);
  window.removeEventListener('click', onRoamClick);
  mode = 'idle';
  content.classList.remove('tool-active', 'locked');
  closePanel();
  lens?.setTool(false);
  lens?.markActive(null);
  if (lens) setHint('Click the <b>square</b> to pick up the lens');
}

// ---- right-side stat panel ----
function openPanel(h: Hotspot): void {
  statBody.replaceChildren();
  h.cards.forEach((card, i) => {
    const el = renderCube(card);
    el.style.animationDelay = `${i * 60}ms`;
    statBody.appendChild(el);
  });
  statPanel.hidden = false;
  requestAnimationFrame(() => statPanel.classList.add('open'));
}

function closePanel(): void {
  statPanel.classList.remove('open');
  window.setTimeout(() => { if (!statPanel.classList.contains('open')) statPanel.hidden = true; }, 260);
}

function setHint(html: string): void {
  hint.innerHTML = html;
  hint.hidden = !html;
}

function reset(): void {
  window.removeEventListener('pointermove', onRoamMove);
  window.removeEventListener('click', onRoamClick);
  pageLayers = [];
  lens = null;
  mode = 'idle';
  pages.replaceChildren();
  content.querySelectorAll('.hotspot, .lens').forEach((n) => n.remove());
  content.classList.remove('tool-active', 'locked');
  statPanel.hidden = true;
  statPanel.classList.remove('open');
  statBody.replaceChildren();
  setHint('');
  countEl.textContent = '';
}
