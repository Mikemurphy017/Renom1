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

/** Cut out every still that has a person, one at a time; calls back as each is ready. */
export async function cutAll(stills: Still[], onEach: (id: string, cut: HTMLCanvasElement | null) => void, alive: () => boolean) {
  for (const s of stills) {
    if (!alive()) return;
    if (s.cut !== undefined) continue;
    onEach(s.id, await cutout(s.canvas));
    // Let the page breathe between photos.
    await new Promise((r) => setTimeout(r, 0));
  }
}
