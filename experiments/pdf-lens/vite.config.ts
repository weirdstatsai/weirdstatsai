import { defineConfig } from 'vite';

// Isolated prototype — served on its own port, no relation to the WeirdStats
// Angular app or the FastAPI backend. pdfjs-dist ships its worker as a separate
// chunk; Vite handles the worker import in src/pdf/pdf-renderer.ts.
export default defineConfig({
  base: './',
  server: { port: 4321, host: true },
  build: {
    outDir: 'dist',
    target: 'es2021',
    chunkSizeWarningLimit: 1200,
  },
});
