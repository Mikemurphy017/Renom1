"use client";

import type { VideoFormat } from "@/lib/types";
import { loadFonts, paletteOf, type CoverInput, type CoverTemplate } from "./kit";
import { LONG } from "./long";
import { SHORT } from "./short";

/**
 * Cover templates, drawn on a canvas at the platforms' native sizes:
 * long form 1280×720 (YouTube, LinkedIn), short form 1080×1920 (Reels,
 * TikTok, Shorts). Real frame of the advisor + a few big words, in one of
 * several looks and palettes (see long.ts, short.ts and kit.ts).
 */

export { LOOKS, PALETTES, heroOf, loadFonts, paletteOf } from "./kit";
export type { CoverInput, CoverLook, CoverTemplate, CoverText, Palette } from "./kit";

export const COVER_SIZE: Record<VideoFormat, [number, number]> = { long: [1280, 720], short: [1080, 1920] };

export const TEMPLATES: Record<VideoFormat, CoverTemplate[]> = { long: LONG, short: SHORT };

export const templateOf = (shape: VideoFormat, id: string) => TEMPLATES[shape].find((t) => t.id === id);

/** Draw one cover. `scale` < 1 draws a smaller copy (for previews) with the same layout. */
export async function renderCover(t: CoverTemplate, input: CoverInput, scale = 1): Promise<HTMLCanvasElement> {
  const f = await loadFonts();
  const [W, H] = COVER_SIZE[t.shape];
  const c = document.createElement("canvas");
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  t.draw(ctx, W, H, input, f, paletteOf(input.palette ?? t.palettes[0], input.accentColor));
  return c;
}

export const toJpeg = (c: HTMLCanvasElement, q = 0.9) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn’t export the cover"))), "image/jpeg", q));
