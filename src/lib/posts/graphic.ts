"use client";

import { loadFonts, inkOn, mix, rgba, type Fonts } from "@/lib/thumbs/kit";
import type { PostAspect } from "@/lib/types";

/**
 * Post graphics, drawn in the browser on a canvas: a headline and the
 * advisor's name either over a photo (an AI photo of them, or their own) or
 * on a plain branded card with no photo at all.
 */

export type GraphicTheme = "navy" | "light" | "brand";
export type GraphicPlace = "bottom" | "top";

export interface GraphicInput {
  headline: string;
  /** The advisor's name and the line under it (credentials, firm). Either can be empty. */
  name: string;
  sub: string;
  /** Over this photo; without one it's a card. */
  photo?: HTMLImageElement | null;
  /** Shape of a card (a photo keeps its own shape). */
  aspect: PostAspect;
  /** Card colours. */
  theme: GraphicTheme;
  /** Where the words sit on a photo. */
  place: GraphicPlace;
  /** The advisor's brand colours, if they've set any: [main, accent]. */
  brand?: string[];
}

const NAVY = "#0B1B33";
const BRASS = "#B08D57";
const CREAM = "#F6F3EC";
const W = 1080;
const HEIGHTS: Record<PostAspect, number> = { "1:1": 1080, "4:5": 1350, "16:9": 608 };

const isHex = (c?: string): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** A sensible headline from a post's first line when the writer didn't give one. */
export function headlineFrom(text: string, topic: string) {
  const first = (text.split("\n").find((l) => l.trim()) ?? topic).replace(/\{\{BOOKING_LINK\}\}/g, "").trim();
  const sentence = first.split(/(?<=[.!?])\s/)[0] ?? first;
  const words = sentence.split(/\s+/);
  return words.length <= 12 ? sentence : `${words.slice(0, 11).join(" ").replace(/[,;:]$/, "")}…`;
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That picture couldn’t be loaded."));
    img.src = url;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest size at which the text fits the box, and its lines. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, from: number, to: number, leading = 1.12) {
  for (let px = from; px >= to; px -= 2) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length * px * leading <= maxH && widest <= maxW) return { px, lines, lh: px * leading };
  }
  ctx.font = font(to);
  return { px: to, lines: wrap(ctx, text, maxW), lh: to * leading };
}

function footer(ctx: CanvasRenderingContext2D, f: Fonts, i: GraphicInput, x: number, y: number, ink: string, soft: string, s: number) {
  // Draws the name and the line under it from y down; returns the height used.
  let used = 0;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (i.name) {
    ctx.font = `700 ${40 * s}px ${f.sans}`;
    ctx.fillStyle = ink;
    ctx.fillText(i.name, x, y + 40 * s);
    used += 52 * s;
  }
  if (i.sub) {
    ctx.font = `500 ${30 * s}px ${f.sans}`;
    ctx.fillStyle = soft;
    ctx.fillText(i.sub, x, y + used + 30 * s);
    used += 42 * s;
  }
  return used;
}

const footerHeight = (i: GraphicInput, s: number) => (i.name ? 52 * s : 0) + (i.sub ? 42 * s : 0);

/** Draws the graphic at posting size and sets the canvas's size to match. */
export async function drawGraphic(canvas: HTMLCanvasElement, i: GraphicInput) {
  const f = await loadFonts();
  const photo = i.photo && i.photo.naturalWidth ? i.photo : null;
  const H = photo ? Math.max(566, Math.min(1350, Math.round((W * photo.naturalHeight) / photo.naturalWidth))) : HEIGHTS[i.aspect];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can’t draw the graphic.");
  // Type is sized for a square; a wide card has less height to work with.
  const s = H < 800 ? 0.74 : 1;
  const pad = 72 * s;
  const accent = isHex(i.brand?.[1]) ? i.brand![1] : BRASS;
  const headline = i.headline.trim() || "Your headline";
  const serif = (px: number) => `600 ${px}px ${f.serif}`;

  if (photo) {
    // The photo fills the frame; the words sit on a scrim so they read on anything.
    const r = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    const dw = photo.naturalWidth * r;
    const dh = photo.naturalHeight * r;
    ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const fh = footerHeight(i, s);
    const boxH = H * 0.34;
    const t = fit(ctx, headline, serif, W - pad * 2, boxH, 84 * s, 40 * s);
    const textH = t.lines.length * t.lh;
    const block = textH + (fh ? fh + 44 * s : 0) + 26 * s;
    const top = i.place === "top";
    const scrimH = Math.min(H, block + pad * 2.4);
    const g = ctx.createLinearGradient(0, top ? 0 : H - scrimH, 0, top ? scrimH : H);
    const dark = rgba(NAVY, 0.94);
    g.addColorStop(top ? 0 : 1, dark);
    g.addColorStop(0.55, rgba(NAVY, 0.72));
    g.addColorStop(top ? 1 : 0, rgba(NAVY, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, top ? 0 : H - scrimH, W, scrimH);

    let y = top ? pad : H - pad - block;
    ctx.fillStyle = accent;
    ctx.fillRect(pad, y, 96 * s, 8 * s);
    y += 26 * s;
    ctx.font = serif(t.px);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 18;
    t.lines.forEach((l, n) => ctx.fillText(l, pad, y + t.px * 0.9 + n * t.lh));
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    if (fh) footer(ctx, f, i, pad, y + textH + 30 * s, "#FFFFFF", "rgba(255,255,255,.78)", s);
    return;
  }

  // A card: no photo.
  const brandBg = isHex(i.brand?.[0]) ? i.brand![0] : NAVY;
  const bg = i.theme === "light" ? CREAM : i.theme === "brand" ? brandBg : NAVY;
  const ink = i.theme === "light" ? NAVY : inkOn(bg, NAVY);
  const soft = mix(ink, bg, 0.32);
  const mark = i.theme === "brand" && !isHex(i.brand?.[1]) ? mix(ink, bg, 0.2) : accent;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // A quiet shape in the corner, so it isn't a flat rectangle.
  ctx.fillStyle = rgba(ink, 0.05);
  ctx.beginPath();
  ctx.arc(W - 60 * s, 60 * s, 330 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(mark, 0.16);
  ctx.beginPath();
  ctx.arc(W - 60 * s, 60 * s, 190 * s, 0, Math.PI * 2);
  ctx.fill();
  // A hairline frame.
  ctx.strokeStyle = rgba(ink, 0.14);
  ctx.lineWidth = 2;
  ctx.strokeRect(28 * s, 28 * s, W - 56 * s, H - 56 * s);

  const fh = footerHeight(i, s);
  const footY = H - pad - fh;
  const topY = pad + 30 * s;
  const maxH = footY - topY - (fh ? 70 * s : 0) - 34 * s;
  const t = fit(ctx, headline, serif, W - pad * 2 - 20 * s, maxH, 104 * s, 40 * s);
  const textH = t.lines.length * t.lh;
  // The headline sits a little above the middle of the space it has.
  let y = topY + Math.max(0, (maxH - textH) * 0.42);
  ctx.fillStyle = mark;
  ctx.fillRect(pad, y, 110 * s, 9 * s);
  y += 34 * s;
  ctx.font = serif(t.px);
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  t.lines.forEach((l, n) => ctx.fillText(l, pad, y + t.px * 0.9 + n * t.lh));
  if (fh) {
    ctx.fillStyle = rgba(ink, 0.18);
    ctx.fillRect(pad, footY - 26 * s, W - pad * 2, 2);
    footer(ctx, f, i, pad, footY, ink, soft, s);
  }
}

export const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t save the graphic."))), "image/jpeg", 0.92));
