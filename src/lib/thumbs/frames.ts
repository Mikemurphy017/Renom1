"use client";

/**
 * Pulls candidate stills for covers out of the advisor's own take, and loads
 * uploaded headshots the same way, so the cover templates get one kind of input.
 */
export interface Still {
  id: string;
  source: "frame" | "headshot" | "ai";
  canvas: HTMLCanvasElement;
  /** Seconds into the take, for frames. */
  time?: number;
  /** Where to keep in shot when cropping, 0–1 of width/height (the face when we can find it). */
  focus: { x: number; y: number };
  /** The face, when found: centre x/y, width and height, 0–1 of the frame. */
  face?: { x: number; y: number; w: number; h: number };
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

/** Sharpness (Laplacian variance), contrast and exposure on a small copy; -1 for a blank frame. */
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
  s.width = s.height = 0;
  if (mean < 0.03 && contrast < 0.02) return -1; // blank (not yet decoded)
  const exposure = 1 - Math.min(1, Math.abs(mean - 0.5) * 2);
  return Math.min(1, sharp * 40) * 0.5 + Math.min(1, contrast * 4) * 0.3 + exposure * 0.2;
}

type Face = NonNullable<Still["face"]>;
type Detected = { boundingBox: DOMRectReadOnly };

/**
 * Chrome's Shape Detection API, where it's switched on (Safari and Firefox don't
 * have it, nor do most Chrome installs), else a skin-tone guess.
 */
async function findFace(c: HTMLCanvasElement): Promise<{ face: Face; sure: boolean } | null> {
  const FD = (globalThis as unknown as { FaceDetector?: new (o: object) => { detect(i: CanvasImageSource): Promise<Detected[]> } }).FaceDetector;
  if (FD) {
    try {
      const faces = await new FD({ fastMode: true, maxDetectedFaces: 3 }).detect(c);
      const b = faces.map((f) => f.boundingBox).sort((p, q) => q.width * q.height - p.width * p.height)[0];
      if (b) return { face: { x: (b.x + b.width / 2) / c.width, y: (b.y + b.height / 2) / c.height, w: b.width / c.width, h: b.height / c.height }, sure: true };
    } catch {
      /* fall through to the guess */
    }
  }
  const g = guessFace(c);
  return g ? { face: g, sure: false } : null;
}

/**
 * Without a face detector: the window that looks most like a face at thumbnail
 * size: mostly skin tones (YCbCr skin range), busy inside (eyes, brows, mouth;
 * a blurred wall or a wooden desk is smooth), less skin around it, and in the
 * upper middle where speakers sit. Returns null when nothing plausible turns up.
 */
export function guessFace(c: HTMLCanvasElement): Face | null {
  const w = 96;
  const h = Math.max(1, Math.round((c.height / c.width) * w));
  const s = document.createElement("canvas");
  s.width = w;
  s.height = h;
  const ctx = s.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(c, 0, 0, w, h);
  let d: Uint8ClampedArray;
  try {
    d = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  } finally {
    s.width = s.height = 0;
  }
  const L = new Float32Array(w * h);
  const skin = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4];
    const g = d[i * 4 + 1];
    const b = d[i * 4 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
    L[i] = y;
    skin[i] = +(y > 40 && y < 248 && cb > 78 && cb < 128 && cr > 134 && cr < 175 && r > g && r > b && r - b > 15);
  }
  const detail = new Float32Array(w * h);
  let mean = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      detail[i] = Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]);
      mean += detail[i];
    }
  mean /= Math.max(1, (w - 2) * (h - 2));
  // Summed-area tables, so every window costs four lookups.
  const table = (v: Float32Array) => {
    const t = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += v[y * w + x];
        t[(y + 1) * (w + 1) + x + 1] = t[y * (w + 1) + x + 1] + row;
      }
    }
    return (x0: number, y0: number, x1: number, y1: number) => {
      const a = Math.max(0, Math.min(w, Math.round(x0)));
      const b = Math.max(0, Math.min(h, Math.round(y0)));
      const c2 = Math.max(0, Math.min(w, Math.round(x1)));
      const e = Math.max(0, Math.min(h, Math.round(y1)));
      return { sum: t[e * (w + 1) + c2] - t[b * (w + 1) + c2] - t[e * (w + 1) + a] + t[b * (w + 1) + a], area: Math.max(0, (c2 - a) * (e - b)) };
    };
  };
  const S = table(skin);
  const D = table(detail);
  let best: { score: number; face: Face } | null = null;
  const m = Math.min(w, h);
  for (let fh = Math.max(5, m * 0.08); fh <= m * 0.75; fh *= 1.12) {
    const fw = fh * 0.78;
    const step = Math.max(1, fh / 6);
    for (let y = 0; y + fh <= h; y += step)
      for (let x = 0; x + fw <= w; x += step) {
        const inn = S(x, y, x + fw, y + fh);
        const skinIn = inn.sum / Math.max(1, inn.area);
        if (skinIn < 0.45) continue;
        const det = D(x, y, x + fw, y + fh);
        const busy = det.sum / Math.max(1, det.area) / Math.max(1, mean);
        if (busy < 1.1) continue;
        const px = fw * 0.4;
        const py = fh * 0.3;
        const out = S(x - px, y - py, x + fw + px, y + fh + py);
        const ringArea = out.area - inn.area;
        const skinRing = ringArea > 0 ? (out.sum - inn.sum) / ringArea : 0;
        const apart = skinIn - skinRing * 0.7;
        if (apart <= 0.1) continue;
        const cx = (x + fw / 2) / w;
        const cy = (y + fh / 2) / h;
        const prior = Math.exp(-(((cx - 0.5) / 0.45) ** 2) - (((cy - 0.38) / 0.5) ** 2));
        const score = skinIn * Math.min(2.5, busy) * apart * prior * Math.pow(fh / m, 0.35);
        // The window settles on the inner face; a detector box runs a little wider and taller.
        if (!best || score > best.score) best = { score, face: { x: cx, y: cy, w: (fw * 1.2) / w, h: (fh * 1.2) / h } };
      }
  }
  return best?.face ?? null;
}

/** Where to aim when there's no face at all: the upper middle, at a usual head size. */
function defaultFace(c: HTMLCanvasElement): Face {
  const m = Math.min(c.width, c.height);
  return { x: 0.5, y: c.height > c.width ? 0.3 : 0.36, w: (0.22 * m) / c.width, h: (0.28 * m) / c.height };
}

/** The middle value of each field: guesses from several frames of one take steady each other. */
function median(fs: Face[]): Face {
  const mid = (k: keyof Face) => [...fs].map((f) => f[k]).sort((a, b) => a - b)[Math.floor(fs.length / 2)];
  return { x: mid("x"), y: mid("y"), w: mid("w"), h: mid("h") };
}

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

/** The best few stills from a take, spread through it, plus the frames at `keep` (seconds; e.g. a saved cover's). */
export async function framesFromVideo(src: string, durationSec: number, want = 4, keep: number[] = []): Promise<Still[]> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  v.src = src;
  try {
    // iOS Safari won't load a video's frames until it has been played; a muted inline play is allowed.
    const loaded = once(v, "loadeddata", 15000);
    await v
      .play()
      .then(() => v.pause())
      .catch(() => {});
    await loaded;
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : durationSec;
    const clamp = (t: number) => Math.max(0.1, Math.min(dur - 0.25, t));
    const kept = keep.filter((t) => Number.isFinite(t)).map(clamp);
    // One frame per tenth of a second (that's the still's id): asked-for frames win.
    const seen = new Set<number>();
    const marks = [...kept, ...[0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86].map((f) => clamp(dur * f))].filter((t) => !seen.has(Math.round(t * 10)) && !!seen.add(Math.round(t * 10)));
    const stills: Still[] = [];
    const guesses: (Face | null)[] = [];
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
      const q = quality(canvas);
      // iOS can hand back a black frame before the video has decoded: skip it.
      if (q < 0) {
        canvas.width = canvas.height = 0;
        continue;
      }
      const found = await findFace(canvas);
      guesses.push(found && !found.sure ? found.face : null);
      const face = found?.face ?? defaultFace(canvas);
      stills.push({ id: `f${Math.round(t * 10)}`, source: "frame", canvas, time: t, focus: { x: face.x, y: face.y }, face, score: q + (found?.sure ? 0.3 : found ? 0.1 : 0) });
    }
    // Guessed faces: a speaker barely moves, so the median of the guesses beats any one of them.
    // (Only when most guesses agree: a take with a cut or a speaker who moves keeps its own.)
    const guessed = guesses.filter((g): g is Face => !!g);
    const m = guessed.length >= 3 ? median(guessed) : null;
    const off = (g: Face, m: Face) => Math.abs(g.x - m.x) > m.w * 0.6 || Math.abs(g.y - m.y) > m.h * 0.6;
    if (m && guessed.filter((g) => !off(g, m)).length >= guessed.length * 0.7) {
      stills.forEach((s, k) => {
        const g = guesses[k];
        if (g && off(g, m)) {
          s.face = m;
          s.focus = { x: m.x, y: m.y };
        }
      });
    }
    // Frames asked for first, then the best, kept apart in time so the options don't look alike.
    const picked: Still[] = stills.filter((s) => kept.some((t) => Math.abs((s.time ?? -1) - t) < 0.01));
    for (const s of [...stills].sort((a, b) => b.score - a.score)) {
      if (picked.length >= want) break;
      if (picked.every((p) => Math.abs((p.time ?? 0) - (s.time ?? 0)) > dur * 0.1)) picked.push(s);
      if (picked.length === want) break;
    }
    for (const s of stills) if (!picked.includes(s)) s.canvas.width = s.canvas.height = 0;
    return picked;
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

/** A still from a photo; `known` is a face box found elsewhere (more reliable than the guess). */
export async function stillFromImage(url: string, id: string, known?: Face | null): Promise<Still> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const canvas = toCanvas(img, img.naturalWidth, img.naturalHeight);
  const face = known ?? (await findFace(canvas))?.face ?? { ...defaultFace(canvas), y: 0.32 };
  return { id, source: "headshot", canvas, focus: { x: face.x, y: face.y }, face, score: 1 };
}
