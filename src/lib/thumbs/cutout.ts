"use client";

import type { Still } from "./frames";

/**
 * Cut the advisor out of a photo, in the browser (MediaPipe's selfie
 * segmenter, ~250 KB), so creator-style covers can put them on a bold
 * background with a sticker outline. Nothing leaves the device. When the
 * model can't load or finds no person, covers fall back to a framed photo.
 */

type Segmenter = { segment(image: HTMLCanvasElement): { confidenceMasks?: { width: number; height: number; getAsFloat32Array(): Float32Array; close(): void }[]; close(): void } };

let loading: Promise<Segmenter | null> | null = null;

function segmenter(): Promise<Segmenter | null> {
  loading ??= (async () => {
    try {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/api/vision");
      return (await ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/models/selfie_segmenter.tflite", delegate: "CPU" },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })) as unknown as Segmenter;
    } catch (e) {
      console.warn("[covers] cutouts unavailable:", e);
      return null;
    }
  })();
  return loading;
}

const done = new WeakMap<HTMLCanvasElement, HTMLCanvasElement | null>();

/** The person on a transparent background, or null. Cached per photo. */
export async function cutout(src: HTMLCanvasElement): Promise<HTMLCanvasElement | null> {
  if (done.has(src)) return done.get(src)!;
  const seg = await segmenter();
  if (!seg) return null;
  let out: HTMLCanvasElement | null = null;
  try {
    // The model works at 256×256; a smaller copy is faster and loses nothing.
    const k = Math.min(1, 640 / Math.max(src.width, src.height));
    const small = document.createElement("canvas");
    small.width = Math.round(src.width * k);
    small.height = Math.round(src.height * k);
    small.getContext("2d")!.drawImage(src, 0, 0, small.width, small.height);
    const res = seg.segment(small);
    const mask = res.confidenceMasks?.[0];
    if (mask) {
      const conf = mask.getAsFloat32Array();
      const alpha = document.createElement("canvas");
      alpha.width = mask.width;
      alpha.height = mask.height;
      const actx = alpha.getContext("2d")!;
      const img = actx.createImageData(mask.width, mask.height);
      let person = 0;
      for (let i = 0; i < conf.length; i++) {
        // A soft but firm edge: below 0.3 gone, above 0.7 solid.
        const a = Math.min(1, Math.max(0, (conf[i] - 0.3) / 0.4));
        img.data[i * 4 + 3] = Math.round(a * 255);
        if (a > 0.5) person++;
      }
      actx.putImageData(img, 0, 0);
      const share = person / conf.length;
      // No person, or the whole frame (a close-up the model can't separate): don't cut.
      if (share > 0.03 && share < 0.92) {
        out = document.createElement("canvas");
        out.width = src.width;
        out.height = src.height;
        const o = out.getContext("2d")!;
        o.drawImage(src, 0, 0);
        o.globalCompositeOperation = "destination-in";
        o.imageSmoothingQuality = "high";
        o.drawImage(alpha, 0, 0, out.width, out.height);
      }
      mask.close();
    }
    res.close();
  } catch (e) {
    console.warn("[covers] cutout failed:", e);
  }
  done.set(src, out);
  return out;
}

/**
 * When the person runs off the top of the photo (hair touching the edge, as
 * webcam framing often does), the cutout would end in a flat line. Complete the
 * crown: mirror the top of the hair upward into a rounded cap, and extend the
 * photo by the same amount, so covers can show the whole head with room above it.
 * Returns the taller photo and cutout with the face moved to match, or null when the head isn't cut.
 */
function completeHead(s: Still, cut: HTMLCanvasElement): Partial<Still> | null {
  const W = cut.width;
  const H = cut.height;
  const cx = cut.getContext("2d", { willReadFrequently: true })!;
  const row = cx.getImageData(0, 0, W, 2).data;
  // The longest run of solid pixels along the top edge.
  let best = [0, 0];
  let start = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && row[x * 4 + 3] > 140;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      if (x - start > best[1] - best[0]) best = [start, x];
      start = -1;
    }
  }
  const [x0, x1] = best;
  const w = x1 - x0;
  // Only a head-sized cut: not a sliver, and not the whole width (a close-up the cap can't fix).
  if (w < W * 0.06 || w > W * 0.8) return null;
  const capH = Math.round(w * 0.34);
  const band = Math.max(4, Math.min(capH, Math.round(H * 0.05)));
  const cap = document.createElement("canvas");
  cap.width = W;
  cap.height = capH;
  const c = cap.getContext("2d")!;
  // The top band of hair, mirrored upward (so it meets itself at the seam) and stretched to the cap's height.
  c.save();
  c.translate(0, capH);
  c.scale(1, -capH / band);
  c.drawImage(cut, x0, 0, w, band, x0, 0, w, band);
  c.restore();
  // Rounded: keep only a half-ellipse sitting on the cut, a little narrower at the top.
  c.globalCompositeOperation = "destination-in";
  c.beginPath();
  c.ellipse(x0 + w / 2, capH, w / 2, capH, 0, Math.PI, Math.PI * 2);
  c.lineTo(x1, capH);
  c.closePath();
  c.fill();
  const tall = (base: HTMLCanvasElement, withCap: boolean, fillTop: boolean) => {
    const t = document.createElement("canvas");
    t.width = W;
    t.height = H + capH;
    const tc = t.getContext("2d")!;
    // The photo's top row, stretched up: a plausible wall behind the new crown.
    if (fillTop) tc.drawImage(base, 0, 0, W, 1, 0, 0, W, capH + 1);
    tc.drawImage(base, 0, capH);
    if (withCap) tc.drawImage(cap, 0, 0);
    return t;
  };
  const k = H / (H + capH);
  const shiftY = (y: number) => (y * H + capH) / (H + capH);
  return {
    canvas: tall(s.canvas, true, true),
    cut: tall(cut, true, false),
    focus: { x: s.focus.x, y: shiftY(s.focus.y) },
    face: s.face ? { ...s.face, y: shiftY(s.face.y), h: s.face.h * k } : undefined,
  };
}

/** The cutout for a still, with the top of the head completed when the photo cut it off. */
export async function cutStill(s: Still): Promise<Partial<Still>> {
  const cut = await cutout(s.canvas);
  if (!cut) return { cut: null };
  try {
    return completeHead(s, cut) ?? { cut };
  } catch {
    return { cut };
  }
}

/** Cut out every still that has a person, one at a time; calls back with the changes as each is ready. */
export async function cutAll(stills: Still[], onEach: (id: string, patch: Partial<Still>) => void, alive: () => boolean) {
  for (const s of stills) {
    if (!alive()) return;
    if (s.cut !== undefined) continue;
    onEach(s.id, await cutStill(s));
    // Let the page breathe between photos.
    await new Promise((r) => setTimeout(r, 0));
  }
}
