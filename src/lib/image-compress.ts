// Client-side image compression. Resizes to a max dimension and re-encodes to
// WebP (visually lossless at high quality, ~60-80% smaller than PNG/JPEG). Runs
// fully in the browser — no library, no server cost. Returns a data URI.

export interface CompressOptions {
  /** Max width/height in px; the image is scaled down to fit (never up). */
  maxDim?: number;
  /** Encoder quality 0–1 (WebP). 0.85–0.9 ≈ visually lossless. */
  quality?: number;
  /** Fallback format if the browser can't encode WebP. PNG keeps transparency. */
  fallbackMime?: "image/png" | "image/jpeg";
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  // createImageBitmap respects EXIF orientation (important for phone photos).
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
      };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode error"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Compress an image File into a (small) data URI. */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<string> {
  const { maxDim = 1280, quality = 0.85, fallbackMime = "image/png" } = opts;
  const src = await loadBitmap(file);

  const scale = Math.min(1, maxDim / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  src.draw(ctx, w, h);

  const webp = canvas.toDataURL("image/webp", quality);
  if (webp.startsWith("data:image/webp")) return webp;
  // Browser ignored WebP and returned PNG — use the requested fallback.
  return canvas.toDataURL(fallbackMime, quality);
}
