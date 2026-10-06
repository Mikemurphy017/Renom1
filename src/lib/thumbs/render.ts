"use client";

import type { VideoFormat } from "@/lib/types";
import type { Still } from "./frames";

/**
 * Cover templates, drawn on a canvas at the platforms' native sizes:
 * long form 1280×720 (YouTube, LinkedIn), short form 1080×1920 (Reels,
 * TikTok, Shorts). Real frame of the advisor + a few big words.
 */

export const COVER_SIZE: Record<VideoFormat, [number, number]> = { long: [1280, 720], short: [1080, 1920] };

export interface CoverText {
  headline: string;
  accent: string;
  kicker: string;
}

export interface CoverInput extends CoverText {
  still: Still;
  /** "Jane Doe, CFP®" */
  byline: string;
  /** Brand accent (defaults to brass). */
  accentColor?: string;
}

export interface CoverTemplate {
  id: string;
  label: string;
  shape: VideoFormat;
  draw(ctx: CanvasRenderingContext2D, W: number, H: number, input: CoverInput, f: Fonts): void;
}

const NAVY = "#0B1F3A";
const IVORY = "#F7F5F0";
const BRASS = "#C9A469";
const OXBLOOD = "#8B2E2E";

interface Fonts {
  sans: string;
  serif: string;
}

let fontsReady: Promise<Fonts> | null = null;
/** next/font hashes family names; read them from the CSS variables and wait for the weights we draw with. */
export function loadFonts(): Promise<Fonts> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const css = getComputedStyle(document.documentElement);
      const sans = css.getPropertyValue("--font-inter").trim() || "Inter, system-ui, sans-serif";
      const serif = css.getPropertyValue("--font-fraunces").trim() || "Georgia, serif";
      await Promise.allSettled([
        document.fonts.load(`900 100px ${sans}`),
        document.fonts.load(`700 100px ${sans}`),
        document.fonts.load(`600 100px ${serif}`),
        document.fonts.load(`italic 600 100px ${serif}`),
      ]);
      return { sans, serif };
    })();
  }
  return fontsReady;
}

// ── drawing helpers ───────────────────────────────────────────────────────────

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");

/** Cover-fit the still into a box, keeping its focus point (the face) in frame. */
function photo(ctx: CanvasRenderingContext2D, s: Still, x: number, y: number, w: number, h: number, bias = { x: 0.5, y: 0.42 }) {
  const c = s.canvas;
  const k = Math.max(w / c.width, h / c.height);
  const sw = w / k;
  const sh = h / k;
  // Put the face at `bias` of the box (a bit above centre reads naturally).
  const sx = Math.min(c.width - sw, Math.max(0, s.focus.x * c.width - sw * bias.x));
  const sy = Math.min(c.height - sh, Math.max(0, s.focus.y * c.height - sh * bias.y));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.filter = "contrast(1.08) saturate(1.06) brightness(1.03)";
  ctx.drawImage(c, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function linear(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

interface TextStyle {
  font: (size: number) => string;
  upper?: boolean;
  lineHeight?: number;
  /** Extra tracking in em. */
  tracking?: number;
}

/** Largest size at which the words wrap into maxLines within maxW. */
function fit(ctx: CanvasRenderingContext2D, text: string, st: TextStyle, maxW: number, maxLines: number, maxSize: number, minSize: number) {
  const words = (st.upper ? text.toUpperCase() : text).split(/\s+/).filter(Boolean);
  for (let size = maxSize; size >= minSize; size -= Math.max(1, Math.round(size * 0.04))) {
    ctx.font = st.font(size);
    setTracking(ctx, (st.tracking ?? 0) * size);
    const space = ctx.measureText(" ").width;
    const lines: string[][] = [];
    let cur: string[] = [];
    let curW = 0;
    let ok = true;
    for (const w of words) {
      const ww = ctx.measureText(w).width;
      if (ww > maxW) { ok = false; break; }
      if (cur.length && curW + space + ww > maxW) {
        lines.push(cur);
        cur = [w];
        curW = ww;
      } else {
        curW += (cur.length ? space : 0) + ww;
        cur.push(w);
      }
    }
    if (cur.length) lines.push(cur);
    if (ok && lines.length <= maxLines) return { size, lines: balance(ctx, lines, maxW, space) };
  }
  ctx.font = st.font(minSize);
  return { size: minSize, lines: [words] };
}

/** Avoid a lonely last word: move words down while it doesn't add a line. */
function balance(ctx: CanvasRenderingContext2D, lines: string[][], maxW: number, space: number) {
  if (lines.length < 2) return lines;
  const width = (l: string[]) => l.reduce((a, w, i) => a + ctx.measureText(w).width + (i ? space : 0), 0);
  const out = lines.map((l) => [...l]);
  for (let i = out.length - 1; i > 0; i--) {
    while (out[i - 1].length > 1 && width(out[i]) < width(out[i - 1]) * 0.55 && width([out[i - 1][out[i - 1].length - 1], ...out[i]]) <= maxW) {
      out[i].unshift(out[i - 1].pop()!);
    }
  }
  return out;
}

function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

interface DrawOpts {
  x: number;
  y: number;
  align: "left" | "center";
  color: string;
  accent: string;
  accentWords: Set<string>;
  /** "box": accent word on a solid block in `accent`, text in boxText. */
  accentMode?: "color" | "box";
  boxText?: string;
  shadow?: boolean;
  anchor?: "top" | "bottom";
}

/** Draw fitted lines word by word so the accent word can be colored. Returns the block's bottom y. */
function drawLines(ctx: CanvasRenderingContext2D, fitted: { size: number; lines: string[][] }, st: TextStyle, o: DrawOpts) {
  const { size, lines } = fitted;
  const lh = size * (st.lineHeight ?? 0.98);
  ctx.font = st.font(size);
  setTracking(ctx, (st.tracking ?? 0) * size);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const space = ctx.measureText(" ").width;
  const blockH = lh * lines.length;
  let y = (o.anchor === "bottom" ? o.y - blockH : o.y) + size * 0.8;
  for (const line of lines) {
    const widths = line.map((w) => ctx.measureText(w).width);
    const lineW = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = o.align === "center" ? o.x - lineW / 2 : o.x;
    line.forEach((w, i) => {
      const hit = o.accentWords.has(norm(w));
      if (hit && o.accentMode === "box") {
        const padX = size * 0.12;
        ctx.save();
        ctx.fillStyle = o.accent;
        ctx.fillRect(x - padX, y - size * 0.82, widths[i] + padX * 2, size * 0.98);
        ctx.restore();
      }
      ctx.save();
      if (o.shadow && !(hit && o.accentMode === "box")) {
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = size * 0.18;
        ctx.shadowOffsetY = size * 0.04;
      }
      ctx.fillStyle = hit ? (o.accentMode === "box" ? (o.boxText ?? NAVY) : o.accent) : o.color;
      ctx.fillText(w, x, y);
      ctx.restore();
      x += widths[i] + space;
    });
    y += lh;
  }
  return (o.anchor === "bottom" ? o.y - blockH : o.y) + blockH;
}

function kicker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, f: Fonts, align: "left" | "center" = "left") {
  if (!text.trim()) return;
  ctx.save();
  ctx.font = `700 ${size}px ${f.sans}`;
  setTracking(ctx, size * 0.18);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.restore();
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string, f: Fonts, align: "left" | "center" = "left") {
  if (!text.trim()) return;
  ctx.save();
  ctx.font = `800 ${size}px ${f.sans}`;
  setTracking(ctx, size * 0.12);
  const t = text.toUpperCase();
  const w = ctx.measureText(t).width;
  const padX = size * 0.7;
  if (align === "center") x -= w / 2 + padX;
  const h = size * 1.9;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w + padX * 2, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(t, x + padX, y + h / 2 + size * 0.04);
  ctx.restore();
}

function byline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, f: Fonts, align: CanvasTextAlign = "left") {
  if (!text.trim()) return;
  ctx.save();
  ctx.font = `600 ${size}px ${f.sans}`;
  setTracking(ctx, size * 0.02);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = size * 0.4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

const accentSet = (i: CoverInput) => new Set(i.accent.split(/\s+/).map(norm).filter(Boolean));

const HEAVY: (f: Fonts) => TextStyle = (f) => ({ font: (s) => `900 ${s}px ${f.sans}`, upper: true, lineHeight: 0.94, tracking: -0.02 });
const SERIF: (f: Fonts) => TextStyle = (f) => ({ font: (s) => `600 ${s}px ${f.serif}`, lineHeight: 1.02, tracking: -0.015 });

// ── long form 1280×720 ───────────────────────────────────────────────────────

const LONG: CoverTemplate[] = [
  {
    id: "spotlight",
    label: "Spotlight",
    shape: "long",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? BRASS;
      ctx.fillStyle = NAVY;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, W * 0.4, 0, W * 0.6, H, { x: 0.5, y: 0.4 });
      ctx.fillStyle = linear(ctx, W * 0.4, 0, W * 0.66, 0, [[0, NAVY], [0.35, rgba(NAVY, 0.75)], [1, rgba(NAVY, 0)]]);
      ctx.fillRect(W * 0.4, 0, W * 0.27, H);
      ctx.fillStyle = linear(ctx, 0, H * 0.7, 0, H, [[0, rgba(NAVY, 0)], [1, rgba(NAVY, 0.6)]]);
      ctx.fillRect(0, H * 0.7, W, H * 0.3);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, W * 0.5, 3, 128, 54);
      const blockH = fitted.size * 0.94 * fitted.lines.length;
      const top = Math.max(H * 0.2, (H - blockH) / 2 + 10);
      kicker(ctx, i.kicker, 64, top - 52, 26, brass, f);
      const bottom = drawLines(ctx, fitted, st, { x: 64, y: top, align: "left", color: IVORY, accent: brass, accentWords: accentSet(i) });
      ctx.fillStyle = brass;
      ctx.fillRect(64, bottom + 22, 96, 7);
      byline(ctx, i.byline, 64, H - 44, 24, rgba(IVORY, 0.8), f);
    },
  },
  {
    id: "marker",
    label: "Marker",
    shape: "long",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? BRASS;
      photo(ctx, i.still, 0, 0, W, H, { x: 0.68, y: 0.42 });
      ctx.fillStyle = linear(ctx, 0, 0, W * 0.72, 0, [[0, rgba("#06111F", 0.92)], [0.55, rgba("#06111F", 0.6)], [1, rgba("#06111F", 0)]]);
      ctx.fillRect(0, 0, W, H);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, W * 0.56, 3, 136, 56);
      pill(ctx, i.kicker, 60, 56, 22, OXBLOOD, IVORY, f);
      drawLines(ctx, fitted, st, { x: 64, y: H - 84, anchor: "bottom", align: "left", color: "#FFFFFF", accent: brass, accentWords: accentSet(i), accentMode: "box", boxText: NAVY, shadow: true });
      byline(ctx, i.byline, W - 48, H - 40, 22, rgba("#FFFFFF", 0.85), f, "right");
    },
  },
  {
    id: "ivory",
    label: "Private bank",
    shape: "long",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? "#9C7A47";
      ctx.fillStyle = IVORY;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, W * 0.53, 0, W * 0.47, H, { x: 0.5, y: 0.4 });
      ctx.fillStyle = brass;
      ctx.fillRect(W * 0.53 - 4, 0, 8, H);
      ctx.strokeStyle = rgba(NAVY, 0.18);
      ctx.lineWidth = 2;
      ctx.strokeRect(28, 28, W * 0.53 - 56, H - 56);
      const st = SERIF(f);
      const fitted = fit(ctx, i.headline, st, W * 0.4, 4, 104, 48);
      const blockH = fitted.size * 1.02 * fitted.lines.length;
      const top = (H - blockH) / 2 + 12;
      kicker(ctx, i.kicker, 72, top - 50, 22, brass, f);
      drawLines(ctx, fitted, { ...st, font: (s) => `600 ${s}px ${f.serif}` }, { x: 72, y: top, align: "left", color: NAVY, accent: OXBLOOD, accentWords: accentSet(i) });
      byline(ctx, i.byline, 72, H - 64, 22, rgba(NAVY, 0.7), f);
    },
  },
  {
    id: "band",
    label: "Banner",
    shape: "long",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? BRASS;
      photo(ctx, i.still, 0, 0, W, H, { x: 0.5, y: 0.34 });
      const bandH = H * 0.36;
      ctx.fillStyle = linear(ctx, 0, H - bandH - 80, 0, H - bandH, [[0, rgba(NAVY, 0)], [1, rgba(NAVY, 0.5)]]);
      ctx.fillRect(0, H - bandH - 80, W, 80);
      ctx.fillStyle = rgba(NAVY, 0.94);
      ctx.fillRect(0, H - bandH, W, bandH);
      ctx.fillStyle = brass;
      ctx.fillRect(0, H - bandH, W, 6);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, W - 128, 2, 112, 48);
      const blockH = fitted.size * 0.94 * fitted.lines.length;
      drawLines(ctx, fitted, st, { x: W / 2, y: H - bandH / 2 - blockH / 2 + 4, align: "center", color: IVORY, accent: brass, accentWords: accentSet(i) });
      pill(ctx, i.kicker, W / 2, H - bandH - 19, 20, brass, NAVY, f, "center");
    },
  },
];

// ── short form 1080×1920 ─────────────────────────────────────────────────────
// Platform UI covers the bottom ~25% and the right edge, so words sit in the upper half.

const SHORT: CoverTemplate[] = [
  {
    id: "hook",
    label: "Hook",
    shape: "short",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? BRASS;
      photo(ctx, i.still, 0, 0, W, H, { x: 0.5, y: 0.55 });
      ctx.fillStyle = linear(ctx, 0, 0, 0, H * 0.62, [[0, rgba("#06111F", 0.9)], [0.6, rgba("#06111F", 0.55)], [1, rgba("#06111F", 0)]]);
      ctx.fillRect(0, 0, W, H * 0.62);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, W - 150, 4, 180, 72);
      kicker(ctx, i.kicker, W / 2, 250, 40, brass, f, "center");
      drawLines(ctx, fitted, st, { x: W / 2, y: 330, align: "center", color: "#FFFFFF", accent: brass, accentWords: accentSet(i), accentMode: "box", boxText: NAVY, shadow: true });
      byline(ctx, i.byline, W / 2, H * 0.73, 34, rgba("#FFFFFF", 0.9), f, "center");
    },
  },
  {
    id: "card",
    label: "Private bank",
    shape: "short",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? "#9C7A47";
      const cardH = H * 0.42;
      photo(ctx, i.still, 0, cardH - 40, W, H - cardH + 40, { x: 0.5, y: 0.36 });
      ctx.fillStyle = IVORY;
      ctx.fillRect(0, 0, W, cardH);
      ctx.fillStyle = brass;
      ctx.fillRect(0, cardH, W, 10);
      const st = SERIF(f);
      const fitted = fit(ctx, i.headline, st, W - 180, 4, 150, 70);
      const blockH = fitted.size * 1.02 * fitted.lines.length;
      const top = Math.max(300, (cardH + 120 - blockH) / 2 + 40);
      kicker(ctx, i.kicker, W / 2, top - 76, 34, brass, f, "center");
      drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: NAVY, accent: OXBLOOD, accentWords: accentSet(i) });
      byline(ctx, i.byline, W / 2, H * 0.74, 34, rgba("#FFFFFF", 0.92), f, "center");
    },
  },
  {
    id: "captions",
    label: "Captions",
    shape: "short",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? BRASS;
      photo(ctx, i.still, 0, 0, W, H, { x: 0.5, y: 0.5 });
      ctx.fillStyle = rgba("#06111F", 0.18);
      ctx.fillRect(0, 0, W, H);
      // Stacked caption blocks, one per line, like burned-in captions.
      const st: TextStyle = { font: (s) => `900 ${s}px ${f.sans}`, upper: true, lineHeight: 1.32, tracking: -0.01 };
      const fitted = fit(ctx, i.headline, st, W - 260, 4, 124, 64);
      ctx.font = st.font(fitted.size);
      setTracking(ctx, -0.01 * fitted.size);
      const space = ctx.measureText(" ").width;
      const lh = fitted.size * 1.32;
      let y = H * 0.36 - (lh * fitted.lines.length) / 2;
      const set = accentSet(i);
      for (const line of fitted.lines) {
        const widths = line.map((w) => ctx.measureText(w).width);
        const lw = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
        const padX = fitted.size * 0.32;
        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "rgba(0,0,0,.3)";
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.roundRect(W / 2 - lw / 2 - padX, y, lw + padX * 2, fitted.size * 1.18, fitted.size * 0.22);
        ctx.fill();
        ctx.restore();
        let x = W / 2 - lw / 2;
        line.forEach((w, k) => {
          ctx.fillStyle = set.has(norm(w)) ? OXBLOOD : NAVY;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(w, x, y + fitted.size * 0.92);
          x += widths[k] + space;
        });
        y += lh;
      }
      pill(ctx, i.kicker, W / 2, H * 0.36 - (lh * fitted.lines.length) / 2 - 130, 34, brass, NAVY, f, "center");
      byline(ctx, i.byline, W / 2, H * 0.73, 34, rgba("#FFFFFF", 0.92), f, "center");
    },
  },
  {
    id: "frame",
    label: "Framed",
    shape: "short",
    draw(ctx, W, H, i, f) {
      const brass = i.accentColor ?? BRASS;
      ctx.fillStyle = NAVY;
      ctx.fillRect(0, 0, W, H);
      const px = 70;
      const py = H * 0.4;
      photo(ctx, i.still, px, py, W - px * 2, H * 0.5, { x: 0.5, y: 0.4 });
      ctx.strokeStyle = brass;
      ctx.lineWidth = 6;
      ctx.strokeRect(px - 16, py - 16, W - px * 2 + 32, H * 0.5 + 32);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, W - 150, 4, 168, 70);
      const blockH = fitted.size * 0.94 * fitted.lines.length;
      kicker(ctx, i.kicker, W / 2, Math.max(150, py - 110 - blockH - 70), 36, brass, f, "center");
      drawLines(ctx, fitted, st, { x: W / 2, y: py - 90, anchor: "bottom", align: "center", color: IVORY, accent: brass, accentWords: accentSet(i) });
      byline(ctx, i.byline, W / 2, py + H * 0.5 + 100, 34, rgba(IVORY, 0.8), f, "center");
    },
  },
];

export const TEMPLATES: Record<VideoFormat, CoverTemplate[]> = { long: LONG, short: SHORT };

/** Draw one cover at full size. */
export async function renderCover(t: CoverTemplate, input: CoverInput): Promise<HTMLCanvasElement> {
  const f = await loadFonts();
  const [W, H] = COVER_SIZE[t.shape];
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  t.draw(ctx, W, H, input, f);
  return c;
}

export const toJpeg = (c: HTMLCanvasElement, q = 0.9) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn’t export the cover"))), "image/jpeg", q));
