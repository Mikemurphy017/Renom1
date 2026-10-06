"use client";

/**
 * Pulls candidate stills for covers out of the advisor's own take, and loads
 * uploaded headshots the same way, so the cover templates get one kind of input.
 */
export interface Still {
  id: string;
  source: "frame" | "headshot";
  canvas: HTMLCanvasElement;
  /** Seconds into the take, for frames. */
  time?: number;
  /** Where to keep in shot when cropping, 0–1 of width/height (the face when we can find it). */
  focus: { x: number; y: number };
  score: number;
}

const MAX_SIDE = 1920;

function toCanvas(src: CanvasImageSource, w: number, h: number) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Sharpness (Laplacian variance), contrast and exposure on a small copy. */
function quality(c: HTMLCanvasElement) {
  const w = 96;
  const h = Math.max(1, Math.round((c.height / c.width) * w));
  const s = document.createElement("canvas");
  s.width = w;
  s.height = h;
  const ctx = s.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(c, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    sum += L[i];
  }
  const mean = sum / (w * h);
  let v = 0;
  let lap = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      v += (L[i] - mean) ** 2;
      const l = 4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w];
      lap += l * l;
      n++;
    }
  const contrast = Math.sqrt(v / Math.max(1, n));
  const sharp = lap / Math.max(1, n);
  const exposure = 1 - Math.min(1, Math.abs(mean - 0.5) * 2);
  return Math.min(1, sharp * 40) * 0.5 + Math.min(1, contrast * 4) * 0.3 + exposure * 0.2;
}

type Detected = { boundingBox: DOMRectReadOnly };
/** Chrome's Shape Detection API where available; otherwise assume a centred speaker. */
async function findFace(c: HTMLCanvasElement): Promise<{ x: number; y: number } | null> {
  const FD = (globalThis as unknown as { FaceDetector?: new (o: object) => { detect(i: CanvasImageSource): Promise<Detected[]> } }).FaceDetector;
  if (!FD) return null;
  try {
    const faces = await new FD({ fastMode: true, maxDetectedFaces: 1 }).detect(c);
    const b = faces[0]?.boundingBox;
    return b ? { x: (b.x + b.width / 2) / c.width, y: (b.y + b.height / 2) / c.height } : null;
  } catch {
    return null;
  }
}

const DEFAULT_FOCUS = { x: 0.5, y: 0.36 };

function once(el: HTMLMediaElement, ev: string, ms = 6000) {
  return new Promise<void>((res, rej) => {
    const t = setTimeout(() => (cleanup(), rej(new Error(`Timed out waiting for ${ev}`))), ms);
    const ok = () => (cleanup(), res());
    const bad = () => (cleanup(), rej(new Error("The video couldn’t be read")));
    const cleanup = () => {
      clearTimeout(t);
      el.removeEventListener(ev, ok);
      el.removeEventListener("error", bad);
    };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });
}

/** The best few stills from a take, spread through it. */
export async function framesFromVideo(src: string, durationSec: number, want = 4): Promise<Still[]> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  v.src = src;
  try {
    await once(v, "loadeddata", 15000);
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : durationSec;
    const marks = [0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86].map((f) => Math.max(0.1, Math.min(dur - 0.25, dur * f)));
    const stills: Still[] = [];
    for (const t of marks) {
      try {
        const seeked = once(v, "seeked");
        v.currentTime = t;
        await seeked;
      } catch {
        continue;
      }
      if (!v.videoWidth) continue;
      const canvas = toCanvas(v, v.videoWidth, v.videoHeight);
      const face = await findFace(canvas);
      stills.push({ id: `f${Math.round(t * 10)}`, source: "frame", canvas, time: t, focus: face ?? DEFAULT_FOCUS, score: quality(canvas) + (face ? 0.3 : 0) });
    }
    // Best first, but keep them apart in time so the options don't look alike.
    const picked: Still[] = [];
    for (const s of [...stills].sort((a, b) => b.score - a.score)) {
      if (picked.every((p) => Math.abs((p.time ?? 0) - (s.time ?? 0)) > dur * 0.1)) picked.push(s);
      if (picked.length === want) break;
    }
    return picked;
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

export async function stillFromImage(url: string, id: string): Promise<Still> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const canvas = toCanvas(img, img.naturalWidth, img.naturalHeight);
  const face = await findFace(canvas);
  return { id, source: "headshot", canvas, focus: face ?? { x: 0.5, y: 0.32 }, score: 1 };
}
