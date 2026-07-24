/**
 * Client-side image downscale + JPEG compression, so card background photos
 * upload fast and stay light (~150–250 KB typical) regardless of what the
 * user picks from their camera roll.
 */
export async function compressImage(file: File, maxEdge = 1200, quality = 0.85): Promise<Blob> {
  // Prefer createImageBitmap (fast, EXIF-orientation aware in modern engines);
  // fall back to a plain <img> decode where it's unavailable.
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl = '';
  try {
    source = await createImageBitmap(file);
  } catch {
    objectUrl = URL.createObjectURL(file);
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });
  }

  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext('2d')!.drawImage(source as CanvasImageSource, 0, 0, cw, ch);

  if ('close' in source) source.close();
  if (objectUrl) URL.revokeObjectURL(objectUrl);

  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('Image compression failed');
  return blob;
}
