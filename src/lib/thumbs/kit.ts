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

export type CoverLook = "Framed" | "Bold" | "Editorial" | "Minimal" | "Number" | "Quote";
export const LOOKS: CoverLook[] = ["Framed", "Bold", "Editorial", "Minimal", "Number", "Quote"];

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
      const f: Fonts = {
        sans,
        serif,
        anton: `"Cover Anton", Impact, ${sans}`,
        bebas: `"Cover Bebas", "Arial Narrow", ${sans}`,
        mont: `"Cover Montserrat", ${sans}`,
        playfair: `"Cover Playfair", ${serif}`,
      };
      // Draw each face once: WebKit can paint the fallback on a canvas's first use of a just-loaded font.
      const warm = document.createElement("canvas");
      warm.width = warm.height = 4;
      const w = warm.getContext("2d");
      if (w)
        for (const font of [`900 4px ${sans}`, `700 4px ${sans}`, `600 4px ${serif}`, `italic 600 4px ${serif}`, `4px ${f.anton}`, `4px ${f.bebas}`, `900 4px ${f.mont}`, `italic 900 4px ${f.mont}`, `700 4px ${f.playfair}`, `italic 900 4px ${f.playfair}`]) {
          w.font = font;
          w.fillText("Ag", 0, 4);
        }
      release(warm);
      return f;
    })();
  }
  return fontsReady;
}

// ── canvas helpers (work the same in Safari 15+, Firefox and Chrome) ─────────────

/** A rounded rectangle on a path or context. (`roundRect` itself is Safari 16+ only.) */
export function rrect(p: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  p.moveTo(x + q, y);
  p.arcTo(x + w, y, x + w, y + h, q);
  p.arcTo(x + w, y + h, x, y + h, q);
  p.arcTo(x, y + h, x, y, q);
  p.arcTo(x, y, x + w, y, q);
  p.closePath();
}

/** Fill a rounded rectangle. */
export function fillRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  rrect(ctx, x, y, w, h, r);
  ctx.fill();
}

/** Free a scratch canvas's memory now rather than at the next GC (iOS caps total canvas memory). */
export function release(c: HTMLCanvasElement) {
  c.width = 0;
  c.height = 0;
}

function scratch(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** How much the context is scaled (previews draw the full-size layout at a fraction). */
function scaleOf(ctx: CanvasRenderingContext2D) {
  try {
    const m = ctx.getTransform();
    return Math.hypot(m.a, m.b) || 1;
  } catch {
    return 1;
  }
}

// ── photo ─────────────────────────────────────────────────────────────────────

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PhotoOpts {
  /** Where the face's centre should land in the box, 0–1. */
  bias?: { x: number; y: number };
  /** How far we may zoom in so the face can sit at `bias` (1 = never). */
  zoom?: number;
  /** Face height we'd like, as a share of the box height (we zoom in on faces far from the camera). */
  face?: number;
  /** Insets (px) the head must stay inside: covered by words, a scrim or a clip. */
  safe?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Clip to this shape instead of the box. */
  clip?: Path2D;
  /** Two-color tint (shadows → highlights), or black and white. */
  tone?: { dark: string; light: string } | "mono";
  /** Fade the top edge out over this many pixels (onto whatever is beneath). */
  fadeTop?: number;
  /** Blur radius in px, for soft backgrounds. */
  blur?: number;
}

/** Where a photo landed: the face and the whole head (hair to chin), in canvas pixels. */
export interface Shot {
  face: Box;
  head: Box;
}

/**
 * The face in a still, as a box (centre x/y, width, height; 0–1 of the frame).
 * Without a detected box we assume a speaker's usual size around the focus point.
 */
export function faceOf(s: Still): Box {
  if (s.face) return s.face;
  const c = s.canvas;
  const m = Math.min(c.width, c.height);
  return { x: s.focus.x, y: s.focus.y, w: (0.22 * m) / c.width, h: (0.28 * m) / c.height };
}

interface Crop extends Shot {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Cover-fit a still into a w×h box: the face lands near `bias`, at a sensible
 * size, and the whole head stays inside the safe area whenever the frame
 * allows (else at least the face, from brow to chin). Positions are relative to the box.
 */
export function crop(s: Still, w: number, h: number, o: PhotoOpts = {}): Crop {
  const cw = s.canvas.width;
  const ch = s.canvas.height;
  const F = faceOf(s);
  const fx = F.x * cw;
  const fy = F.y * ch;
  const fw = F.w * cw;
  const fh = F.h * ch;
  // A detector's box runs brow to chin; hair and ears sit outside it.
  const head = { x0: fx - fw * 0.7, x1: fx + fw * 0.7, y0: fy - fh * 0.9, y1: fy + fh * 0.62 };
  const core = { x0: fx - fw * 0.42, x1: fx + fw * 0.42, y0: fy - fh * 0.42, y1: fy + fh * 0.5 };
  const bias = o.bias ?? { x: 0.5, y: 0.42 };
  const safe = { l: o.safe?.left ?? 0, r: w - (o.safe?.right ?? 0), t: o.safe?.top ?? 0, b: h - (o.safe?.bottom ?? 0) };
  const k0 = Math.max(w / cw, h / ch);
  // Never blow source pixels up more than ~2.4×, or zoom in so far the face fills the box.
  const zCap = Math.max(1, Math.min(2.6, 2.4 / k0, (0.6 * h) / (fh * k0)));
  const need = (f: number, b: number, size: number, full: number) => {
    const room = Math.min(b > 0 ? (f * full) / b : Infinity, b < 1 ? ((1 - f) * full) / (1 - b) : Infinity);
    return room >= size ? 1 : size / Math.max(1, room);
  };
  // Zoom to move the face sideways only: a face high in the frame is better left high than blown up
  // (the safe area still pulls it in when it must).
  const zBias = Math.min(o.zoom ?? 1.3, need(F.x, bias.x, w / k0, cw));
  const zSize = Math.min(2.2, ((o.face ?? 0.34) * h) / (fh * k0));
  const zPref = Math.max(1, Math.min(zCap, Math.max(zBias, zSize)));

  const place = (z: number) => {
    const k = k0 * z;
    const sw = w / k;
    const sh = h / k;
    let sx = Math.min(cw - sw, Math.max(0, fx - sw * bias.x));
    let sy = Math.min(ch - sh, Math.max(0, fy - sh * bias.y));
    // Slide the window so the region sits inside the safe area, if any slide does.
    const into = (v: number, lo: number, hi: number, a0: number, a1: number, s0: number, s1: number) => {
      const a = Math.max(lo, a1 - s1 / k);
      const b = Math.min(hi, a0 - s0 / k);
      return a <= b + 0.5 ? Math.min(b, Math.max(a, v)) : null;
    };
    let level = 0;
    for (const [n, r] of [[2, head], [1, core]] as const) {
      const x = into(sx, 0, cw - sw, r.x0, r.x1, safe.l, safe.r);
      const y = into(sy, 0, ch - sh, r.y0, r.y1, safe.t, safe.b);
      if (x !== null && y !== null) {
        sx = x;
        sy = y;
        level = n;
        break;
      }
      // Close-ups: keep the eyes and mouth in, let the hair go.
      if (n === 1 && x !== null) sx = x;
      if (n === 1 && y !== null) sy = y;
    }
    return { z, k, sx, sy, sw, sh, level };
  };
  // Best fit nearest the zoom we'd like; zoom further in only when that's what keeps the face clear.
  let best = place(zPref);
  for (let z = 1; z <= zCap + 1e-6; z += 0.05) {
    const p = place(z);
    if (p.level > best.level || (p.level === best.level && Math.abs(z - zPref) < Math.abs(best.z - zPref))) best = p;
  }
  const { k, sx, sy, sw, sh } = best;
  const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x: (x0 - sx) * k, y: (y0 - sy) * k, w: (x1 - x0) * k, h: (y1 - y0) * k });
  return { sx, sy, sw, sh, face: box(fx - fw / 2, fy - fh / 2, fx + fw / 2, fy + fh / 2), head: box(head.x0, head.y0, head.x1, head.y1) };
}

const shift = (b: Box, x: number, y: number): Box => ({ x: b.x + x, y: b.y + y, w: b.w, h: b.h });

/** Cover-fit the still into a box (see `crop`) and return where the face landed. */
export function photo(ctx: CanvasRenderingContext2D, s: Still, x: number, y: number, w: number, h: number, o: PhotoOpts = {}): Shot {
  const p = crop(s, w, h, o);
  // Work on a copy at the box's on-screen size: pixel work is the same in every
  // browser (older Safari has no ctx.filter), and it’s cheap for previews.
  const sc = scaleOf(ctx);
  const off = scratch(w * sc, h * sc);
  const octx = off.getContext("2d", { willReadFrequently: true })!;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(s.canvas, p.sx, p.sy, p.sw, p.sh, 0, 0, off.width, off.height);
  if (o.blur) {
    // Shrink and grow back: a cheap blur that works everywhere.
    const d = Math.max(2, Math.round((o.blur * sc) / 4));
    const tiny = scratch(off.width / d, off.height / d);
    const t = tiny.getContext("2d")!;
    t.imageSmoothingQuality = "high";
    t.drawImage(off, 0, 0, tiny.width, tiny.height);
    octx.clearRect(0, 0, off.width, off.height);
    octx.drawImage(tiny, 0, 0, off.width, off.height);
    release(tiny);
  }
  grade(octx, off.width, off.height, o.tone ?? (o.blur ? null : "grade"));
  if (o.fadeTop) {
    octx.globalCompositeOperation = "destination-in";
    octx.fillStyle = linear(octx, 0, 0, 0, o.fadeTop * sc, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,1)"]]);
    octx.fillRect(0, 0, off.width, off.height);
    octx.globalCompositeOperation = "source-over";
  }
  ctx.save();
  if (o.clip) ctx.clip(o.clip);
  else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  ctx.drawImage(off, x, y, w, h);
  ctx.restore();
  release(off);
  return { face: shift(p.face, x, y), head: shift(p.head, x, y) };
}

/** A gentle lift (a touch more contrast, color and light), a two-color tint, or black and white. */
function grade(ctx: CanvasRenderingContext2D, w: number, h: number, t: PhotoOpts["tone"] | "grade" | null) {
  if (!t) return;
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return; // a cross-origin photo without CORS: leave it as it is
  }
  const d = img.data;
  if (t === "grade") {
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      for (let c = 0; c < 3; c++) {
        const v = l + (d[i + c] - l) * 1.06; // saturation
        d[i + c] = ((v - 128) * 1.08 + 128) * 1.03; // contrast, brightness (Uint8Clamped clamps)
      }
    }
  } else {
    const [a, b] = t === "mono" ? [[18, 18, 18], [246, 244, 238]] : [rgb(t.dark), rgb(t.light)];
    for (let i = 0; i < d.length; i += 4) {
      let l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      l = Math.min(1, Math.max(0, (l - 0.5) * 1.18 + 0.52));
      d[i] = a[0] + (b[0] - a[0]) * l;
      d[i + 1] = a[1] + (b[1] - a[1]) * l;
      d[i + 2] = a[2] + (b[2] - a[2]) * l;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * For layouts with words down one side over a full-bleed photo: which side the
 * face should go so the words stay clear of it. `prefer` wins unless the frame
 * leaves clearly more room the other way (a speaker sitting far to one side).
 */
export function faceSide(s: Still, w: number, h: number, o: PhotoOpts & { bias: { x: number; y: number } }, prefer: "left" | "right" = "right"): "left" | "right" {
  const bx = Math.max(o.bias.x, 1 - o.bias.x);
  const r = crop(s, w, h, { ...o, bias: { x: bx, y: o.bias.y } });
  const l = crop(s, w, h, { ...o, bias: { x: 1 - bx, y: o.bias.y } });
  const roomR = r.head.x / w;
  const roomL = (w - (l.head.x + l.head.w)) / w;
  if (prefer === "right") return roomL > roomR + 0.06 ? "left" : "right";
  return roomR > roomL + 0.06 ? "right" : "left";
}

/** Tall covers: the sharp frame sits from `top` down over a soft, darkened copy (see `bleed`). */
const BLEED: PhotoOpts = { bias: { x: 0.5, y: 0.36 }, zoom: 1.3, face: 0.25, safe: { top: 40, left: 24, right: 24 } };
/** The face's centre may sit no lower than this share of a tall cover (below it, the app's buttons). */
const BLEED_LOW = 0.68;

/**
 * Where the sharp photo of a `bleed` can start: from `top` down to well past the
 * middle. Starting lower slides the face down and, for a landscape take, shows
 * it smaller, both of which make room for words above it.
 */
function bleedStarts(s: Still, W: number, H: number, top: number, o: PhotoOpts) {
  const out: { y: number; headTop: number }[] = [];
  for (let y = top; y <= Math.max(top, H * 0.62); y += 12) {
    const p = crop(s, W, H - y, o);
    if (y > top && y + p.face.y + p.face.h / 2 > H * BLEED_LOW) break;
    out.push({ y, headTop: y + p.head.y });
  }
  return out;
}

/**
 * Lowest y the words above a `bleed` photo can reach and still leave the head clear.
 */
export function headroom(s: Still, W: number, H: number, top: number, o: PhotoOpts = {}) {
  return Math.max(...bleedStarts(s, W, H, top, { ...BLEED, ...o }).map((b) => b.headTop));
}

/**
 * Tall covers: a graphic ground in the palette fills the canvas and the frame
 * sits from `top` down, fading into it, so the face lands below the words
 * whatever shape the take was recorded in. The photo appears once. With
 * `clear`, the photo starts lower (within reason) until the head is below that line.
 */
export function bleed(ctx: CanvasRenderingContext2D, s: Still, W: number, H: number, top: number, p: Palette, o: PhotoOpts & { clear?: number; pattern?: Pattern } = {}): Shot {
  const { clear, pattern, ...rest } = o;
  const opts: PhotoOpts = { ...BLEED, ...rest };
  let y = top;
  if (clear !== undefined) {
    const starts = bleedStarts(s, W, H, top, opts);
    y = (starts.find((b) => b.headTop >= clear) ?? starts.reduce((a, b) => (b.headTop > a.headTop ? b : a))).y;
  }
  ground(ctx, W, H, p, pattern ?? "rings", { cx: W / 2, cy: y + 120 });
  return photo(ctx, s, 0, y, W, H - y, { ...opts, fadeTop: Math.min(320, y) });
}

// ── graphics ──────────────────────────────────────────────────────────────────

export type Pattern = "rings" | "rays" | "grid" | "stripes" | "dots" | "ruled" | "plain";

/**
 * A graphic backdrop: the palette's deep color (or `base`) in a soft gradient,
 * a quiet pattern in the accent (or `ink`) and a glow at cx/cy, where the
 * photo usually sits.
 */
export function ground(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, pattern: Pattern = "plain", o: { cx?: number; cy?: number; base?: string; ink?: string; strength?: number } = {}) {
  const base = o.base ?? p.bg;
  const light = lum(base) > 0.35;
  const ink = o.ink ?? (light ? p.ink : p.accent);
  const a = (light ? 0.07 : 0.11) * (o.strength ?? 1);
  const cx = o.cx ?? W / 2;
  const cy = o.cy ?? H * 0.6;
  const u = Math.min(W, H) / 60;
  ctx.save();
  ctx.fillStyle = linear(ctx, 0, 0, 0, H, light ? [[0, base], [1, mix(base, "#000000", 0.05)]] : [[0, darken(base, 0.4)], [1, mix(base, "#FFFFFF", 0.03)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = rgba(ink, a);
  ctx.fillStyle = rgba(ink, a);
  ctx.lineWidth = Math.max(2, u * 0.18);
  const far = Math.hypot(W, H);
  if (pattern === "rings") {
    for (let r = u * 9; r < far; r += u * 5.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (pattern === "rays") {
    const n = 36;
    ctx.fillStyle = rgba(ink, a * 1.3);
    for (let k = 0; k < n; k += 2) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * far, cy + Math.sin(a0) * far);
      ctx.lineTo(cx + Math.cos(a1) * far, cy + Math.sin(a1) * far);
      ctx.closePath();
      ctx.fill();
    }
  } else if (pattern === "grid") {
    const step = u * 6;
    ctx.beginPath();
    for (let x = (cx % step) - step; x < W + step; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = (cy % step) - step; y < H + step; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  } else if (pattern === "stripes") {
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    const step = u * 4;
    for (let x = -far; x < far; x += step * 2) ctx.fillRect(x, -far, step * 0.55, far * 2);
  } else if (pattern === "dots") {
    const step = u * 3.2;
    ctx.fillStyle = rgba(ink, a * 1.7);
    for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, u * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === "ruled") {
    const step = u * 3.6;
    ctx.beginPath();
    for (let y = step * 2; y < H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // The glow: lighter on dark grounds, a touch of the accent on light ones.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
  g.addColorStop(0, light ? rgba(p.accent, 0.1) : rgba(mix(base, "#FFFFFF", 0.22), 0.55));
  g.addColorStop(1, rgba(base, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** An arch (a window with a round top), x/y its top-left, running down to y + h. */
export function arch(x: number, y: number, w: number, h: number) {
  const p = new Path2D();
  const r = w / 2;
  p.moveTo(x, y + h);
  p.lineTo(x, y + r);
  p.arc(x + r, y + r, r, Math.PI, 0);
  p.lineTo(x + w, y + h);
  p.closePath();
  return p;
}

/** A star or burst: `n` points between radii r0 and r1. */
export function star(cx: number, cy: number, r0: number, r1: number, n: number, turn = 0) {
  const p = new Path2D();
  for (let k = 0; k < n * 2; k++) {
    const r = k % 2 ? r0 : r1;
    const a = turn - Math.PI / 2 + (k * Math.PI) / n;
    if (k) p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else p.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  p.closePath();
  return p;
}

/** A dashed ring with a few dots riding on it, like an orbit. */
export function orbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, width: number, dots: number[] = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([width * 0.4, width * 2.6]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  for (const d of dots) {
    ctx.beginPath();
    ctx.arc(cx + Math.cos(d) * r, cy + Math.sin(d) * r, width * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A strip of tape, centred at x/y. */
export function tape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

/** A small round badge (a rosette with points) holding a word or two. */
export function badge(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, bg: string, fg: string, f: Fonts, turn = -0.14) {
  if (!text.trim()) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  ctx.shadowColor = "rgba(0,0,0,.28)";
  ctx.shadowBlur = r * 0.25;
  ctx.shadowOffsetY = r * 0.06;
  ctx.fillStyle = bg;
  ctx.fill(star(0, 0, r * 0.9, r, 18));
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  const ks: TextStyle = { font: (s) => `900 ${s}px ${f.mont}`, upper: true, lineHeight: 1.0 };
  const kf = fit(ctx, text, ks, { w: r * 1.35, h: r * 1.1, lines: 3, max: r * 0.4, min: r * 0.2 });
  drawLines(ctx, kf, ks, { x: 0, y: 0, anchor: "middle", align: "center", color: fg, accent: fg, hits: new Set() });
  ctx.restore();
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
  rrect(p, x, y, w, h, r);
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
        fillRound(ctx, x - px, base - capH - py, widths[k] + px * 2, capH + py * 2, size * 0.06);
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

/**
 * Kicker, headline and byline as one block, centred between `top` and `bottom`
 * (pass `kick` / `by` colors to draw those). Returns the block's extent.
 */
export function stack(
  ctx: CanvasRenderingContext2D,
  i: CoverInput,
  f: Fonts,
  o: Omit<DrawOpts, "y" | "hits" | "anchor"> & { st: TextStyle; w: number; top: number; bottom: number; max: number; min: number; lines?: number; kick?: string; by?: string; kSize: number; bSize: number }
) {
  const align = o.align ?? "left";
  const by = o.by && i.byline.trim() ? o.bSize * 2.6 : 0;
  const kick = o.kick && i.kicker.trim() ? o.kSize * 2.2 : 0;
  const room = o.bottom - o.top;
  const fitted = fit(ctx, i.headline, o.st, { w: o.w, h: room - by - kick, lines: o.lines ?? 4, max: o.max, min: o.min }, hitsOf(i));
  const y = o.top + kick + Math.max(0, (room - kick - by - blockHeight(fitted, o.st)) / 2);
  if (kick) kicker(ctx, i.kicker, o.x, y - kick, o.kSize, o.kick!, f, align, o.w);
  const b = drawLines(ctx, fitted, o.st, { ...o, y, align, hits: hitsOf(i) });
  if (by) byline(ctx, i.byline, o.x, b.bottom + o.bSize * 2.2, o.bSize, o.by!, f, align, false);
  return b;
}

/**
 * YouTube-style words: every line set as wide as the column, so short lines get
 * huge ("THE / $200K / PRISON"); a very short word ("THE") stays smaller. The
 * accent words take the accent color. Returns the block's extent.
 */
export function bigLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  st: TextStyle,
  o: { x: number; y: number; w: number; h: number; lines?: number; max: number; align?: "left" | "center"; color: string; accent: string; hits: Set<string>; anchor?: "top" | "middle" | "bottom"; outline?: string }
) {
  const lines = fit(ctx, text, st, { w: o.w, h: o.h, lines: o.lines ?? 3, max: o.max, min: 24 }, o.hits).lines;
  const lh = st.lineHeight ?? 1;
  const widthAt = (line: string[], size: number) => {
    ctx.font = st.font(size);
    setTracking(ctx, (st.tracking ?? 0) * size);
    return ctx.measureText(line.join(" ")).width;
  };
  let sizes = lines.map((l) => Math.min(o.max, (o.w * 100) / Math.max(1, widthAt(l, 100))));
  const big = Math.max(...sizes);
  sizes = sizes.map((z, i) => (lines.length > 1 && lines[i].join("").length <= 3 ? Math.min(z, big * 0.5) : z));
  const total = sizes.reduce((a, z) => a + z * lh, 0);
  const k = total > o.h ? o.h / total : 1;
  sizes = sizes.map((z) => z * k);
  const blockH = total * k;
  let y = o.anchor === "bottom" ? o.y - blockH : o.anchor === "middle" ? o.y - blockH / 2 : o.y;
  const top = y;
  let widest = 0;
  lines.forEach((line, i) => {
    const size = sizes[i];
    drawLines(ctx, { size, lines: [line] }, st, { x: o.x, y, align: o.align ?? "left", color: o.color, accent: o.accent, hits: o.hits, shadow: "soft", outline: o.outline ? { width: 0.025, color: o.outline } : undefined });
    widest = Math.max(widest, widthAt(line, size));
    y += size * lh;
  });
  return { top, bottom: y, width: widest, size: Math.max(...sizes) };
}

/** "FIX THIS / NOW": the headline split into the words above and the accent word(s) for the pill (else the last word). */
export function pillSplit(text: string, hits: Set<string>) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { lead: "", pill: words.join(" ") };
  let a = words.findIndex((w) => hits.has(norm(w)));
  let b = a;
  while (b + 1 < words.length && hits.has(norm(words[b + 1]))) b++;
  // Accent words in the middle of the line read badly on a pill: use the tail instead.
  if (a < 0 || (b < words.length - 1 && a > 0)) a = b = words.length - 1;
  return { lead: [...words.slice(0, a), ...words.slice(b + 1)].join(" "), pill: words.slice(a, b + 1).join(" ") };
}

/** A rounded pill with heavy dark text, sized to the words. Returns its box. */
export function bigPill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxW: number, bg: string, fg: string, f: Fonts, align: "left" | "center" = "left") {
  const t = text.trim().toUpperCase();
  const font = (s: number) => `900 ${s}px ${f.mont}`;
  ctx.save();
  let s = size;
  ctx.font = font(s);
  setTracking(ctx, -0.01 * s);
  while (ctx.measureText(t).width + s * 0.9 > maxW && s > 20) {
    s -= 2;
    ctx.font = font(s);
    setTracking(ctx, -0.01 * s);
  }
  const tw = ctx.measureText(t).width;
  const w = tw + s * 0.9;
  const h = s * 1.32;
  const left = align === "center" ? x - w / 2 : x;
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = s * 0.25;
  ctx.shadowOffsetY = s * 0.06;
  ctx.fillStyle = bg;
  fillRound(ctx, left, y, w, h, h / 2);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(t, left + s * 0.45, y + h / 2 + s * 0.04);
  ctx.restore();
  return { x: left, y, w, h };
}

/** Fit and draw in one go. */
export function headline(ctx: CanvasRenderingContext2D, text: string, st: TextStyle, box: FitBox, o: DrawOpts) {
  const fitted = fit(ctx, text, st, box, o.hits);
  return { ...drawLines(ctx, fitted, st, o), size: fitted.size };
}

/**
 * Wide letter-spacing is drawn letter by letter: canvas `letterSpacing` only
 * arrived in Safari 18.4 (and adds a trailing gap where it exists), so this
 * keeps small capitals looking the same everywhere.
 */
const MANUAL_TRACKING = 0.04;

function trackedWidth(ctx: CanvasRenderingContext2D, t: string, px: number) {
  if (!px) return ctx.measureText(t).width;
  const chars = Array.from(t);
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + px * (chars.length - 1);
}

function fillTracked(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, px: number, align: CanvasTextAlign) {
  if (!px) {
    ctx.textAlign = align;
    ctx.fillText(t, x, y);
    return;
  }
  const w = trackedWidth(ctx, t, px);
  let cx = align === "center" ? x - w / 2 : align === "right" || align === "end" ? x - w : x;
  ctx.textAlign = "left";
  for (const c of Array.from(t)) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + px;
  }
}

/** One line of small type; shrinks (then trims) to fit `maxW`. Returns its width. */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: { size: number; font: (s: number) => string; color: string; align?: CanvasTextAlign; tracking?: number; upper?: boolean; maxW?: number; baseline?: CanvasTextBaseline; shadow?: boolean }
) {
  let t = (o.upper ? text.toUpperCase() : text).trim();
  if (!t) return 0;
  ctx.save();
  const manual = Math.abs(o.tracking ?? 0) >= MANUAL_TRACKING;
  let size = o.size;
  const px = () => (manual ? (o.tracking ?? 0) * size : 0);
  const set = () => {
    ctx.font = o.font(size);
    setTracking(ctx, manual ? 0 : (o.tracking ?? 0) * size);
  };
  const width = () => trackedWidth(ctx, t, px());
  set();
  if (o.maxW) {
    while (width() > o.maxW && size > o.size * 0.7) {
      size -= 1;
      set();
    }
    while (width() > o.maxW && t.length > 2) t = t.slice(0, -2).trimEnd() + "…";
  }
  ctx.fillStyle = o.color;
  ctx.textBaseline = o.baseline ?? "alphabetic";
  if (o.shadow) {
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = size * 0.45;
  }
  fillTracked(ctx, t, x, y, px(), o.align ?? "left");
  const w = width();
  ctx.restore();
  return w;
}

/** Small tracked capitals above a headline. */
export function kicker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, f: Fonts, align: CanvasTextAlign = "left", maxW?: number) {
  return label(ctx, text, x, y, { size, font: (s) => `700 ${s}px ${f.sans}`, color, align, tracking: 0.16, upper: true, baseline: "top", maxW });
}

/** Rounded label. Returns its height. */
export function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, fg: string, f: Fonts, align: "left" | "center" = "left", maxW?: number) {
  if (!text.trim()) return 0;
  const padX = size * 0.75;
  const font = (s: number) => `800 ${s}px ${f.sans}`;
  ctx.save();
  ctx.font = font(size);
  setTracking(ctx, 0);
  const t = text.trim().toUpperCase();
  const w = Math.min(trackedWidth(ctx, t, size * 0.12), maxW ? maxW - padX * 2 : Infinity);
  if (align === "center") x -= w / 2 + padX;
  const h = Math.round(size * 1.9);
  ctx.fillStyle = bg;
  fillRound(ctx, x, y, w + padX * 2, h, h / 2);
  ctx.restore();
  label(ctx, t, x + padX, y + h / 2 + size * 0.05, { size, font, color: fg, tracking: 0.12, baseline: "middle", maxW: w + 1 });
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
 * headline ("$7,000", "73%", "401(k)"), or the highlighted word if there isn't
 * one, with the words before and after it so the layout can keep reading order.
 */
export function heroOf(text: CoverText) {
  const words = text.headline.split(/\s+/).filter(Boolean);
  if (!words.length) return { hero: "", before: "", after: "", rest: "", isNumber: false };
  // Strip outer punctuation, but keep a closing bracket that has its opener ("401(k)").
  const clean = (w: string) => {
    const t = w.replace(/^[^\w$€£(]+|[^\w%+)]+$/g, "");
    return t.endsWith(")") && !t.includes("(") ? t.slice(0, -1) : t;
  };
  let k = words.findIndex((w) => /\d/.test(w));
  if (k < 0) k = words.findIndex((w) => norm(w) && text.accent.split(/\s+/).map(norm).includes(norm(w)));
  if (k < 0) k = words.reduce((best, w, n) => (w.length > words[best].length ? n : best), 0);
  const hero = clean(words[k]) || words[k];
  const before = words.slice(0, k).join(" ");
  const after = words.slice(k + 1).join(" ");
  return { hero, before, after, rest: [before, after].filter(Boolean).join(" "), isNumber: /\d/.test(hero) };
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
  rrect(ctx, x, y, s, s, s * 0.2);
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
