/**
 * PDF rendering + text extraction, built on Mozilla pdf.js (pdfjs-dist).
 *
 * This is the accuracy-critical layer. Each page is rendered to a canvas, and
 * every text run from `getTextContent()` is projected from PDF space into the
 * same device-pixel space as the canvas, so a screen rectangle (the lens) can
 * be hit-tested against real text.
 */
import * as pdfjsLib from 'pdfjs-dist';
// Vite bundles the pdf.js worker as a first-class module worker.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import type { TextItem, Rect } from '../core/types';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export interface RenderedPage {
  pageIndex: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  items: TextItem[];
}

/** Load a PDF from raw bytes. */
export async function loadPdf(data: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  // `data` may be transferred to the worker, so hand pdf.js its own copy.
  return pdfjsLib.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}

/**
 * Render one page and extract its text runs, all in device pixels at `scale`.
 */
export async function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  scale: number,
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageIndex + 1); // pdf.js is 1-indexed
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const textContent = await page.getTextContent();
  const items: TextItem[] = [];
  for (const raw of textContent.items) {
    // Skip the marked-content markers pdf.js interleaves.
    if (!('str' in raw)) continue;
    const item = raw as import('pdfjs-dist/types/src/display/api').TextItem;
    if (!item.str || !item.str.trim()) continue;

    // Project the text-space transform into viewport (device) space.
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const width = item.width * scale;
    const rect: Rect = {
      left: tx[4],
      top: tx[5] - fontHeight, // tx[5] is the baseline; box top sits a font-height above
      width,
      height: fontHeight,
    };
    items.push({ str: item.str, rect, fontHeight });
  }

  page.cleanup();
  return { pageIndex, canvas, width: canvas.width, height: canvas.height, items };
}

/** A scale that renders the page crisply to roughly `targetWidth` device px. */
export function fitScale(pageWidthPt: number, targetWidth: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return (targetWidth / pageWidthPt) * dpr;
}
