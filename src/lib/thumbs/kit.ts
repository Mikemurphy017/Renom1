"use client";

import type { VideoFormat } from "@/lib/types";
import type { Still } from "./frames";

/**
 * The shared pieces cover templates are drawn with: palettes, fonts, photo
 * placement and fitted, highlightable headline type.
 */

export interface CoverText {
  headline: string;
  accent: string;
  kicker: string;
}

export interface CoverInput extends CoverText {
  still: Still;
  /** "Jane Doe, CFP®" */
  byline: string;
  /** The advisor's brand color; replaces the palette's highlight. */
  accentColor?: string;
  /** Palette id (each template has its own default). */
  palette?: string;
  /** Short talking points, for the checklist layouts. */
  points?: string[];
}

export type CoverLook = "Bold" | "Editorial" | "Minimal" | "Number" | "Quote";
export const LOOKS: CoverLook[] = ["Bold", "Editorial", "Minimal", "Number", "Quote"];

export interface CoverTemplate {
  id: string;
  label: string;
  shape: VideoFormat;
  look: CoverLook;
  /** Palettes that suit this layout, best first. */
  palettes: string[];
  draw(ctx: CanvasRenderingContext2D, W: number, H: number, input: CoverInput, f: Fonts, p: Palette): void;
}

// ── palettes ──────────────────────────────────────────────────────────────────

export interface Palette {
  id: string;
  label: string;
  /** Deep color for blocks and scrims. */
  bg: string;
  /** Light color for cards and paper. */
  paper: string;
  /** Text on paper. */
  ink: string;
  /** The highlight. */
  accent: string;
  /** Highlight for words set on paper (a deeper partner to the accent). */
  mark: string;
}

export const PALETTES: Palette[] = [
  { id: "classic", label: "Navy & brass", bg: "#0B1F3A", paper: "#F7F5F0", ink: "#0B1F3A", accent: "#C9A469", mark: "#8B2E2E" },
  { id: "forest", label: "Green & cream", bg: "#123A2E", paper: "#F4EEE1", ink: "#123A2E", accent: "#E2B65C", mark: "#A4552F" },
  { id: "coral", label: "Charcoal & coral", bg: "#1E2125", paper: "#F7F4EF", ink: "#1E2125", accent: "#FF6B57", mark: "#D9432F" },
  { id: "cobalt", label: "White & cobalt", bg: "#0D1C3F", paper: "#FFFFFF", ink: "#0D1C3F", accent: "#3B6BFF", mark: "#2147D8" },
  { id: "signal", label: "Black & yellow", bg: "#101010", paper: "#FFFFFF", ink: "#101010", accent: "#FFD23F", mark: "#101010" },
  { id: "plum", label: "Plum & peach", bg: "#3B1527", paper: "#F6EDE6", ink: "#3B1527", accent: "#F2A07B", mark: "#B23A48" },
  { id: "teal", label: "Teal & mint", bg: "#0B3540", paper: "#EEF6F4", ink: "#0B3540", accent: "#4FD8BC", mark: "#0E7C6B" },
];

/** A palette, with the advisor's color as the highlight when they have one. */
export function paletteOf(id: string | undefined, accentColor?: string): Palette {
  const base = PALETTES.find((p) => p.id === id) ?? PALETTES[0];
  const c = hex(accentColor);
  return c ? { ...base, accent: c, mark: c } : base;
}

// ── color math (contrast keeps words readable whatever the advisor picks) ──────

function hex(c?: string): string | null {
  if (!c) return null;
  const m = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1];
  return `#${h.toUpperCase()}`;
}

function rgb(c: string): [number, number, number] {
  const n = parseInt((hex(c) ?? "#000000").slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgba = (c: string, a: number) => `rgba(${rgb(c).join(",")},${a})`;

export function mix(a: string, b: string, t: number) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, k) => Math.round(v + (y[k] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

function lum(c: string) {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** `c`, nudged lighter or darker until it reads on `bg`. */
export function readable(c: string, bg: string, min = 3) {
  const to = lum(bg) > 0.35 ? "#000000" : "#FFFFFF";
  for (let t = 0; t <= 1; t += 0.1) {
    const out = t ? mix(c, to, t) : c;
    if (contrast(out, bg) >= min) return out;
  }
  return to;
}

/** Black or white text, whichever reads on `bg`. */
export const inkOn = (bg: string, dark = "#101010") => (contrast(dark, bg) >= contrast("#FFFFFF", bg) ? dark : "#FFFFFF");

export const darken = (c: string, t = 0.45) => mix(c, "#000000", t);

// ── fonts ─────────────────────────────────────────────────────────────────────

export interface Fonts {
  /** Inter */
  sans: string;
  /** Fraunces */
  serif: string;
  anton: string;
  bebas: string;
  /** Montserrat 600/800/900 (+ 900 italic) */
  mont: string;
  /** Playfair Display 700 (+ 900 italic) */
  playfair: string;
}

const FACES: [family: string, file: string, weight: string, style: string][] = [
  ["Cover Anton", "Anton_400Regular.ttf", "400", "normal"],
  ["Cover Bebas", "BebasNeue_400Regular.ttf", "400", "normal"],
  ["Cover Montserrat", "Montserrat_600SemiBold.ttf", "600", "normal"],
  ["Cover Montserrat", "Montserrat_800ExtraBold.ttf", "800", "normal"],
  ["Cover Montserrat", "Montserrat_900Black.ttf", "900", "normal"],
  ["Cover Montserrat", "Montserrat_900Black_Italic.ttf", "900", "italic"],
  ["Cover Playfair", "PlayfairDisplay_700Bold.ttf", "700", "normal"],
  ["Cover Playfair", "PlayfairDisplay_900Black_Italic.ttf", "900", "italic"],
];

let fontsReady: Promise<Fonts> | null = null;
/**
 * next/font hashes the Inter and Fraunces family names; read them from the CSS
 * variables. The display faces in public/fonts are registered under our own
 * names so covers don't depend on the page's stylesheet.
 */
export function loadFonts(): Promise<Fonts> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const css = getComputedStyle(document.documentElement);
      const sans = css.getPropertyValue("--font-inter").trim() || "Inter, system-ui, sans-serif";
      const serif = css.getPropertyValue("--font-fraunces").trim() || "Georgia, serif";
      await Promise.allSettled([
        ...FACES.map(async ([family, file, weight, style]) => {
          const face = new FontFace(family, `url(/fonts/${file})`, { weight, style });
          document.fonts.add(await face.load());
        }),
        ...["900", "800", "700", "600"].map((w) => document.fonts.load(`${w} 100px ${sans}`)),
        document.fonts.load(`600 100px ${serif}`),
        document.fonts.load(`italic 600 100px ${serif}`),
      ]);
      return {
        sans,
        serif,
        anton: `"Cover Anton", Impact, ${sans}`,
        bebas: `"Cover Bebas", "Arial Narrow", ${sans}`,
        mont: `"Cover Montserrat", ${sans}`,
        playfair: `"Cover Playfair", ${serif}`,
      };
    })();
  }
  return fontsReady;
}

// ── photo ─────────────────────────────────────────────────────────────────────

export interface PhotoOpts {
  /** Where the face lands in the box, 0–1. */
  bias?: { x: number; y: number };
  /** How far we may zoom in so the face can sit off-centre (1 = never). */
  zoom?: number;
  /** Clip to this shape instead of the box. */
  clip?: Path2D;
  /** Two-color tint (shadows → highlights), or black and white. */
  tone?: { dark: string; light: string } | "mono";
  /** Fade the top edge out over this many pixels (onto whatever is beneath). */
  fadeTop?: number;
  /** Blur radius in px, for soft backgrounds. */
  blur?: number;
}

/** Cover-fit the still into a box, keeping its focus point (the face) in frame. */
export function photo(ctx: CanvasRenderingContext2D, s: Still, x: number, y: number, w: number, h: number, o: PhotoOpts = {}) {
  const c = s.canvas;
  const bias = o.bias ?? { x: 0.5, y: 0.42 };
  const k0 = Math.max(w / c.width, h / c.height);
  // Zoom in just enough that the face can reach `bias` without running out of picture.
  const need = (f: number, b: number, size: number, full: number) => {
    const room = Math.min(b > 0 ? (f * full) / b : Infinity, b < 1 ? ((1 - f) * full) / (1 - b) : Infinity);
    return room >= size ? 1 : size / Math.max(1, room);
  };
  const z = Math.min(o.zoom ?? 1.3, Math.max(1, need(s.focus.x, bias.x, w / k0, c.width), need(s.focus.y, bias.y, h / k0, c.height)));
  const k = k0 * z;
  const sw = w / k;
  const sh = h / k;
  const sx = Math.min(c.width - sw, Math.max(0, s.focus.x * c.width - sw * bias.x));
  const sy = Math.min(c.height - sh, Math.max(0, s.focus.y * c.height - sh * bias.y));

  const plain = !o.tone && !o.fadeTop && !o.blur;
  ctx.save();
  if (o.clip) ctx.clip(o.clip);
  else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  if (plain) {
    ctx.filter = "contrast(1.08) saturate(1.06) brightness(1.03)";
    ctx.drawImage(c, sx, sy, sw, sh, x, y, w, h);
  } else {
    // Work on a copy at the box's size (pixel work is the same in every browser, unlike ctx.filter).
    const bw = Math.max(1, Math.round(w));
    const bh = Math.max(1, Math.round(h));
    let off = document.createElement("canvas");
    off.width = bw;
    off.height = bh;
    let octx = off.getContext("2d", { willReadFrequently: !!o.tone })!;
    octx.drawImage(c, sx, sy, sw, sh, 0, 0, bw, bh);
    if (o.blur) {
      // Shrink and grow back: a cheap blur that works everywhere.
      const d = Math.max(2, Math.round(o.blur / 4));
      const tiny = document.createElement("canvas");
      tiny.width = Math.max(1, Math.round(bw / d));
      tiny.height = Math.max(1, Math.round(bh / d));
      const t = tiny.getContext("2d")!;
      t.imageSmoothingQuality = "high";
      t.drawImage(off, 0, 0, tiny.width, tiny.height);
      octx.imageSmoothingQuality = "high";
      octx.clearRect(0, 0, bw, bh);
      octx.drawImage(tiny, 0, 0, bw, bh);
    }
    if (o.tone) tone(octx, bw, bh, o.tone);
    if (o.fadeTop) {
      const m = document.createElement("canvas");
      m.width = bw;
      m.height = bh;
      const mctx = m.getContext("2d")!;
      mctx.drawImage(off, 0, 0);
      mctx.globalCompositeOperation = "destination-in";
      mctx.fillStyle = linear(mctx, 0, 0, 0, o.fadeTop, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,1)"]]);
      mctx.fillRect(0, 0, bw, bh);
      off = m;
      octx = mctx;
    }
    ctx.drawImage(off, x, y, w, h);
  }
  ctx.restore();
}

function tone(ctx: CanvasRenderingContext2D, w: number, h: number, t: NonNullable<PhotoOpts["tone"]>) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const [a, b] = t === "mono" ? [[18, 18, 18], [246, 244, 238]] : [rgb(t.dark), rgb(t.light)];
  for (let i = 0; i < d.length; i += 4) {
    let l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    l = Math.min(1, Math.max(0, (l - 0.5) * 1.18 + 0.52));
    d[i] = a[0] + (b[0] - a[0]) * l;
    d[i + 1] = a[1] + (b[1] - a[1]) * l;
    d[i + 2] = a[2] + (b[2] - a[2]) * l;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Tall covers: a soft, darkened copy of the frame fills the canvas and the sharp
 * frame sits from `top` down, so the face lands below the words whatever shape
 * the take was recorded in.
 */
export function bleed(ctx: CanvasRenderingContext2D, s: Still, W: number, H: number, top: number, o: PhotoOpts = {}) {
  photo(ctx, s, -40, -40, W + 80, H + 80, { bias: { x: 0.5, y: 0.3 }, blur: 48, tone: o.tone });
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(0, 0, W, H);
  photo(ctx, s, 0, top, W, H - top, { bias: { x: 0.5, y: 0.36 }, zoom: 1.7, fadeTop: Math.min(320, top), ...o });
}

export function linear(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function poly(points: [number, number][]) {
  const p = new Path2D();
  points.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

export function rounded(x: number, y: number, w: number, h: number, r: number) {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
}

export function circle(cx: number, cy: number, r: number) {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

// ── type ──────────────────────────────────────────────────────────────────────

export const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");
export const hitsOf = (i: CoverText) => new Set(i.accent.split(/\s+/).map(norm).filter(Boolean));

export interface TextStyle {
  font: (size: number) => string;
  /** Highlighted words in another face (an italic, say). */
  accentFont?: (size: number) => string;
  upper?: boolean;
  lineHeight?: number;
  /** Extra tracking in em. */
  tracking?: number;
}

export interface FitBox {
  w: number;
  /** Tallest the block may be. */
  h?: number;
  lines: number;
  max: number;
  min: number;
}

export interface Fitted {
  size: number;
  lines: string[][];
}

export function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function measurer(ctx: CanvasRenderingContext2D, st: TextStyle, size: number, hits?: Set<string>) {
  const track = (st.tracking ?? 0) * size;
  ctx.font = st.font(size);
  setTracking(ctx, track);
  const space = ctx.measureText(" ").width;
  const width = (w: string) => {
    if (st.accentFont && hits?.has(norm(w))) {
      ctx.font = st.accentFont(size);
      const out = ctx.measureText(w).width;
      ctx.font = st.font(size);
      return out;
    }
    return ctx.measureText(w).width;
  };
  return { space, width };
}

/** Largest size at which the words wrap into the box. Long headlines get smaller type and more lines, never overflow. */
export function fit(ctx: CanvasRenderingContext2D, text: string, st: TextStyle, box: FitBox, hits?: Set<string>): Fitted {
  const words = (st.upper ? text.toUpperCase() : text).split(/\s+/).filter(Boolean);
  if (!words.length) return { size: box.max, lines: [] };
  const lh = st.lineHeight ?? 1;
  const attempt = (size: number, maxLines: number) => {
    const { space, width } = measurer(ctx, st, size, hits);
    const lines: string[][] = [];
    let cur: string[] = [];
    let curW = 0;
    for (const w of words) {
      const ww = width(w);
      if (ww > box.w) return null;
      if (cur.length && curW + space + ww > box.w) {
        lines.push(cur);
        cur = [w];
        curW = ww;
      } else {
        curW += (cur.length ? space : 0) + ww;
        cur.push(w);
      }
    }
    if (cur.length) lines.push(cur);
    if (lines.length > maxLines) return null;
    if (box.h && lines.length * size * lh > box.h) return null;
    return balance(lines, box.w, space, width);
  };
  const step = (s: number) => Math.max(1, Math.round(s * 0.04));
  for (let size = box.max; size >= box.min; size -= step(size)) {
    const lines = attempt(size, box.lines);
    if (lines) return { size, lines };
  }
  // Too many words for the layout: allow a few more lines and smaller type.
  for (let size = box.min; size >= Math.max(10, box.min * 0.4); size -= step(size)) {
    const lines = attempt(size, box.lines + 3);
    if (lines) return { size, lines };
  }
  const size = Math.max(10, Math.round(box.min * 0.4));
  return { size, lines: words.map((w) => [w]) };
}

/** Avoid a lonely last word: move words down while it doesn't add a line. */
function balance(lines: string[][], maxW: number, space: number, width: (w: string) => number) {
  if (lines.length < 2) return lines;
  const lw = (l: string[]) => l.reduce((a, w, i) => a + width(w) + (i ? space : 0), 0);
  const out = lines.map((l) => [...l]);
  for (let i = out.length - 1; i > 0; i--) {
    while (out[i - 1].length > 1 && lw(out[i]) < lw(out[i - 1]) * 0.55 && lw([out[i - 1][out[i - 1].length - 1], ...out[i]]) <= maxW) {
      out[i].unshift(out[i - 1].pop()!);
    }
  }
  return out;
}

export const blockHeight = (f: Fitted, st: TextStyle) => f.size * (st.lineHeight ?? 1) * f.lines.length;

export interface DrawOpts {
  x: number;
  y: number;
  align?: "left" | "center" | "right";
  /** Which edge of the block `y` is. */
  anchor?: "top" | "middle" | "bottom";
  color: string;
  accent: string;
  hits: Set<string>;
  /** color: the word in the accent. box: on a solid block. marker: a highlighter stroke behind it. */
  accentMode?: "color" | "box" | "marker";
  /** Text color on the box. */
  boxText?: string;
  shadow?: "soft" | "hard";
  /** Stroke around letters, width in em. */
  outline?: { width: number; color: string };
}

/** Draw fitted lines word by word so the accent word can be colored. Returns the block's extent. */
export function drawLines(ctx: CanvasRenderingContext2D, fitted: Fitted, st: TextStyle, o: DrawOpts) {
  const { size, lines } = fitted;
  const lh = size * (st.lineHeight ?? 1);
  const blockH = lh * lines.length;
  const top = o.anchor === "bottom" ? o.y - blockH : o.anchor === "middle" ? o.y - blockH / 2 : o.y;
  const { space, width } = measurer(ctx, st, size, o.hits);
  ctx.font = st.font(size);
  const capH = ctx.measureText("H").actualBoundingBoxAscent || size * 0.72;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let widest = 0;
  lines.forEach((line, n) => {
    const base = top + n * lh + (lh + capH) / 2;
    const widths = line.map(width);
    const lineW = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    widest = Math.max(widest, lineW);
    let x = o.align === "center" ? o.x - lineW / 2 : o.align === "right" ? o.x - lineW : o.x;
    line.forEach((w, k) => {
      const hit = o.hits.has(norm(w));
      const font = hit && st.accentFont ? st.accentFont(size) : st.font(size);
      ctx.save();
      ctx.font = font;
      if (hit && o.accentMode === "box") {
        const px = size * 0.14;
        const py = size * 0.12;
        ctx.fillStyle = o.accent;
        ctx.beginPath();
        ctx.roundRect(x - px, base - capH - py, widths[k] + px * 2, capH + py * 2, size * 0.06);
        ctx.fill();
      } else if (hit && o.accentMode === "marker") {
        ctx.fillStyle = rgba(o.accent, 0.85);
        ctx.fillRect(x - size * 0.06, base - capH * 0.42, widths[k] + size * 0.12, capH * 0.52);
      }
      const fill = hit ? (o.accentMode === "box" ? (o.boxText ?? "#101010") : o.accentMode === "marker" ? o.color : o.accent) : o.color;
      if (o.shadow === "hard") {
        ctx.fillStyle = "rgba(0,0,0,.55)";
        if (o.outline) {
          ctx.lineJoin = "round";
          ctx.lineWidth = o.outline.width * size * 2;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.strokeText(w, x + size * 0.05, base + size * 0.06);
        }
        ctx.fillText(w, x + size * 0.05, base + size * 0.06);
      } else if (o.shadow === "soft" && !(hit && o.accentMode === "box")) {
        ctx.shadowColor = "rgba(0,0,0,.5)";
        ctx.shadowBlur = size * 0.2;
        ctx.shadowOffsetY = size * 0.04;
      }
      if (o.outline && !(hit && o.accentMode === "box")) {
        ctx.lineJoin = "round";
        ctx.lineWidth = o.outline.width * size * 2;
        ctx.strokeStyle = o.outline.color;
        ctx.strokeText(w, x, base);
        ctx.shadowColor = "transparent";
      }
      ctx.fillStyle = fill;
      ctx.fillText(w, x, base);
      ctx.restore();
      x += widths[k] + space;
    });
  });
  return { top, bottom: top + blockH, width: widest };
}

/** Fit and draw in one go. */
export function headline(ctx: CanvasRenderingContext2D, text: string, st: TextStyle, box: FitBox, o: DrawOpts) {
  const fitted = fit(ctx, text, st, box, o.hits);
  return { ...drawLines(ctx, fitted, st, o), size: fitted.size };
}

/** One line of small type; shrinks (then trims) to fit `maxW`. Returns its width. */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: { size: number; font: (s: number) => string; color: string; align?: CanvasTextAlign; tracking?: number; upper?: boolean; maxW?: number; baseline?: CanvasTextBaseline; shadow?: boolean }
) {
  let t = o.upper ? text.toUpperCase() : text;
  if (!t.trim()) return 0;
  ctx.save();
  let size = o.size;
  const set = () => {
    ctx.font = o.font(size);
    setTracking(ctx, (o.tracking ?? 0) * size);
  };
  set();
  if (o.maxW) {
    while (ctx.measureText(t).width > o.maxW && size > o.size * 0.7) {
      size -= 1;
      set();
    }
    while (ctx.measureText(t).width > o.maxW && t.length > 2) t = t.slice(0, -2).trimEnd() + "…";
  }
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.baseline ?? "alphabetic";
  if (o.shadow) {
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = size * 0.45;
  }
  ctx.fillText(t, x, y);
  const w = ctx.measureText(t).width;
  ctx.restore();
  return w;
}

/** Small tracked capitals above a headline. */
export function kicker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, f: Fonts, align: CanvasTextAlign = "left", maxW?: number) {
  return label(ctx, text, x, y, { size, font: (s) => `700 ${s}px ${f.sans}`, color, align, tracking: 0.18, upper: true, baseline: "top", maxW });
}

/** Rounded label. Returns its height. */
export function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string, f: Fonts, align: "left" | "center" = "left") {
  if (!text.trim()) return 0;
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
  return h;
}

export function byline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, f: Fonts, align: CanvasTextAlign = "left", shadow = true) {
  return label(ctx, text, x, y, { size, font: (s) => `600 ${s}px ${f.sans}`, color, align, tracking: 0.02, shadow });
}

/** "Jane Doe, CFP®" → name and credentials. */
export function splitByline(b: string) {
  const [name, ...rest] = b.split(",");
  return { name: name.trim(), creds: rest.join(",").trim() };
}

export const initials = (b: string) =>
  splitByline(b)
    .name.split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .filter((c) => /\p{L}/u.test(c))
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Logo-style signature: initials in a circle, then the name. */
export function monogram(ctx: CanvasRenderingContext2D, b: string, x: number, y: number, size: number, bg: string, fg: string, nameColor: string, f: Fonts) {
  if (!b.trim()) return;
  const r = size;
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x + r, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  label(ctx, initials(b) || "•", x + r, y + r * 0.02, { size: r * 0.78, font: (s) => `700 ${s}px ${f.sans}`, color: fg, align: "center", baseline: "middle", tracking: 0.02 });
  label(ctx, b, x + r * 2 + r * 0.6, y, { size: r * 0.8, font: (s) => `600 ${s}px ${f.sans}`, color: nameColor, baseline: "middle", tracking: 0.01 });
}

/**
 * The figure that carries a "big number" layout: the first number in the
 * headline ("$7,000", "73%", "3"), or the highlighted word if there isn't one.
 */
export function heroOf(text: CoverText) {
  const words = text.headline.split(/\s+/).filter(Boolean);
  const clean = (w: string) => w.replace(/^[^\w$€£]+|[^\w%+]+$/g, "");
  let k = words.findIndex((w) => /\d/.test(w));
  if (k < 0) k = words.findIndex((w) => norm(w) && text.accent.split(/\s+/).map(norm).includes(norm(w)));
  if (k < 0) k = words.reduce((best, w, n) => (w.length > words[best].length ? n : best), 0);
  if (!words.length) return { hero: "", rest: "", isNumber: false };
  const hero = clean(words[k]) || words[k];
  // A figure pulled from the end leaves a lead-in ("I'd split it in…"); mark it as one.
  const rest = words.filter((_, n) => n !== k).join(" ") + (k === words.length - 1 && words.length > 1 ? "…" : "");
  return { hero, rest, isNumber: /\d/.test(hero) };
}

/** Trim a talking point to a few words that read at thumbnail size. */
export function shortPoint(s: string, max = 34) {
  const t = s.replace(/^[-•*\d.)\s]+/, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t.replace(/[.,;:]$/, "");
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 10 ? cut.lastIndexOf(" ") : max).replace(/[,;:—–-]$/, "").trim() + "…";
}

/** A tick in a rounded box. */
export function checkbox(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, filled = false, tickColor?: string) {
  ctx.save();
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.2);
  if (filled) ctx.fill();
  else ctx.stroke();
  ctx.strokeStyle = tickColor ?? color;
  ctx.lineWidth = Math.max(3, s * 0.13);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + s * 0.24, y + s * 0.52);
  ctx.lineTo(x + s * 0.43, y + s * 0.7);
  ctx.lineTo(x + s * 0.77, y + s * 0.3);
  ctx.stroke();
  ctx.restore();
}

// Common type styles.
export const HEAVY = (f: Fonts): TextStyle => ({ font: (s) => `900 ${s}px ${f.sans}`, upper: true, lineHeight: 0.98, tracking: -0.02 });
export const SERIF = (f: Fonts): TextStyle => ({ font: (s) => `600 ${s}px ${f.serif}`, accentFont: (s) => `italic 600 ${s}px ${f.serif}`, lineHeight: 1.06, tracking: -0.015 });
export const ANTON = (f: Fonts): TextStyle => ({ font: (s) => `400 ${s}px ${f.anton}`, upper: true, lineHeight: 1.0, tracking: 0.005 });
export const BEBAS = (f: Fonts): TextStyle => ({ font: (s) => `400 ${s}px ${f.bebas}`, upper: true, lineHeight: 0.9, tracking: 0.02 });
export const MONT = (f: Fonts, upper = true): TextStyle => ({ font: (s) => `900 ${s}px ${f.mont}`, upper, lineHeight: upper ? 1.0 : 1.04, tracking: -0.01 });
export const MONT_ITALIC = (f: Fonts): TextStyle => ({ font: (s) => `italic 900 ${s}px ${f.mont}`, upper: true, lineHeight: 1.0, tracking: -0.01 });
export const PLAYFAIR = (f: Fonts): TextStyle => ({ font: (s) => `700 ${s}px ${f.playfair}`, accentFont: (s) => `italic 900 ${s}px ${f.playfair}`, lineHeight: 1.08, tracking: -0.01 });
export const CLEAN = (f: Fonts): TextStyle => ({ font: (s) => `700 ${s}px ${f.sans}`, lineHeight: 1.1, tracking: -0.025 });
