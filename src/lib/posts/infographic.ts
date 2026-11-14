"use client";

import { inkOn, loadFonts, mix, rgba, type Fonts } from "@/lib/thumbs/kit";
import type { PostAspect } from "@/lib/types";
import { HYPOTHETICAL_NOTE, type Infographic } from "./infographic-spec";

/**
 * Infographics for posts, drawn in the browser on a canvas: a big number, bars,
 * a donut, a side-by-side, a growth line or numbered steps, in bright palettes.
 */

export interface InfoPalette {
  id: string;
  label: string;
  bg: [string, string];
  ink: string;
  colors: [string, string, string, string];
}

export const INFO_PALETTES: InfoPalette[] = [
  { id: "sunset", label: "Sunset", bg: ["#FF7A45", "#FF2E7E"], ink: "#FFFFFF", colors: ["#FFE45C", "#2B1660", "#7CF5D0", "#FFFFFF"] },
  { id: "ocean", label: "Ocean", bg: ["#1238FF", "#00B8F0"], ink: "#FFFFFF", colors: ["#FFE45C", "#7CF5D0", "#FF7AB6", "#FFFFFF"] },
  { id: "berry", label: "Berry", bg: ["#5B2EFF", "#C13BFF"], ink: "#FFFFFF", colors: ["#FFD23F", "#3DF5C5", "#FF7AB6", "#FFFFFF"] },
  { id: "citrus", label: "Citrus", bg: ["#FFE45C", "#9BEA5B"], ink: "#14213D", colors: ["#FF5A36", "#1D4ED8", "#14213D", "#FFFFFF"] },
  { id: "mint", label: "Mint", bg: ["#F2FFF8", "#D2F6E6"], ink: "#0B1B33", colors: ["#00B37E", "#FF6B4A", "#3D5AFE", "#FFB020"] },
  { id: "midnight", label: "Midnight", bg: ["#0B1B33", "#1C3A6E"], ink: "#FFFFFF", colors: ["#FFC233", "#3DF5C5", "#FF6B9A", "#6AA8FF"] },
];

const isHex = (c?: string): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c);

/** The advisor's brand colours as a palette, if they've set them. */
export function brandPalette(brand?: string[]): InfoPalette | null {
  if (!isHex(brand?.[0])) return null;
  const main = brand![0];
  const ink = inkOn(main, "#0B1B33");
  return { id: "brand", label: "Your brand", bg: [main, mix(main, ink === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.28)], ink, colors: [isHex(brand?.[1]) ? brand![1] : "#FFC233", "#3DF5C5", "#FF6B9A", ink] };
}

export interface InfographicInput {
  spec: Infographic;
  palette: InfoPalette;
  aspect: PostAspect;
  name: string;
  sub: string;
}

const W = 1080;
const HEIGHTS: Record<PostAspect, number> = { "1:1": 1080, "4:5": 1350, "16:9": 608 };
type Box = { x: number; y: number; w: number; h: number };

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

function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, from: number, to: number, leading = 1.1, maxLines = 4) {
  for (let px = from; px >= to; px -= 2) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.length * px * leading <= maxH && Math.max(...lines.map((l) => ctx.measureText(l).width)) <= maxW) return { px, lines, lh: px * leading };
  }
  ctx.font = font(to);
  return { px: to, lines: wrap(ctx, text, maxW).slice(0, maxLines), lh: to * leading };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** The largest single-line size that fits the width. */
function oneLine(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, from: number, to: number) {
  for (let px = from; px > to; px -= 4) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxW) return px;
  }
  ctx.font = font(to);
  return to;
}

const isLight = (c: string) => inkOn(c, "#000000") !== "#FFFFFF";

function background(ctx: CanvasRenderingContext2D, p: InfoPalette, H: number) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, p.bg[0]);
  g.addColorStop(1, p.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Soft colour blobs, so it glows rather than sits flat.
  const blob = (x: number, y: number, r: number, c: string, a: number) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, rgba(c, a));
    rg.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(W * 0.92, H * 0.08, W * 0.55, p.colors[0], 0.38);
  blob(W * 0.05, H * 0.95, W * 0.6, p.colors[2], 0.3);
  // A dot grid in the corner.
  ctx.fillStyle = rgba(p.ink, 0.16);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    ctx.beginPath();
    ctx.arc(W - 70 - i * 26, 70 + j * 26, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A colour that reads on the background: the palette's first accent unless it's too close to it. */
const pop = (p: InfoPalette, n = 0) => p.colors[n % p.colors.length];

// ── layouts ──

function drawStat(ctx: CanvasRenderingContext2D, f: Fonts, i: Infographic, p: InfoPalette, b: Box, s: number) {
  const st = i.stat!;
  const pct = /^(\d{1,3}(?:\.\d+)?)\s*%$/.exec(st.value);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const anton = (px: number) => `${px}px ${f.anton}`;
  if (pct && Number(pct[1]) <= 100) {
    // A ring that fills to the percentage, the figure inside it.
    ctx.font = `600 ${34 * s}px ${f.sans}`;
    const label = wrap(ctx, st.label, b.w * 0.9).slice(0, 2);
    const labelH = label.length * 42 * s + 20 * s;
    const r = Math.min(b.w * 0.36, (b.h - labelH) / 2 - 8);
    const cx = b.x + b.w / 2;
    const cy = b.y + r + 4;
    ctx.lineCap = "round";
    ctx.lineWidth = r * 0.2;
    ctx.strokeStyle = rgba(p.ink, 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, pop(p, 0));
    g.addColorStop(1, pop(p, 2));
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Number(pct[1])) / 100);
    ctx.stroke();
    const px = oneLine(ctx, st.value, anton, r * 1.3, r * 0.75, 40);
    ctx.font = anton(px);
    ctx.fillStyle = p.ink;
    ctx.fillText(st.value, cx, cy + px * 0.36);
    ctx.font = `600 ${34 * s}px ${f.sans}`;
    ctx.fillStyle = p.ink;
    label.forEach((l, n) => ctx.fillText(l, cx, cy + r + r * 0.1 + 48 * s + n * 42 * s));
    return;
  }
  // A huge figure with a glow, the label under it.
  ctx.font = `600 ${38 * s}px ${f.sans}`;
  const label = wrap(ctx, st.label, b.w * 0.92).slice(0, 3);
  const labelH = label.length * 48 * s;
  const px = oneLine(ctx, st.value, anton, b.w * 0.94, Math.min(380 * s, (b.h - labelH - 30 * s) * 0.95), 60);
  const top = b.y + Math.max(0, (b.h - px - labelH - 30 * s) / 2);
  ctx.font = anton(px);
  ctx.shadowColor = rgba(pop(p, 0), 0.55);
  ctx.shadowBlur = 60;
  ctx.fillStyle = pop(p, 0);
  ctx.fillText(st.value, b.x + b.w / 2, top + px * 0.92);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.font = `600 ${38 * s}px ${f.sans}`;
  ctx.fillStyle = p.ink;
  label.forEach((l, n) => ctx.fillText(l, b.x + b.w / 2, top + px + 40 * s + n * 48 * s));
}

function drawBars(ctx: CanvasRenderingContext2D, f: Fonts, i: Infographic, p: InfoPalette, b: Box, s: number) {
  const rows = i.series;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const rowH = b.h / rows.length;
  const barH = Math.min(rowH * 0.46, 70 * s);
  const labelPx = Math.min(30 * s, rowH * 0.26);
  ctx.textBaseline = "alphabetic";
  rows.forEach((r, n) => {
    const y = b.y + n * rowH + (rowH - barH - labelPx - 12 * s) / 2;
    ctx.font = `700 ${labelPx}px ${f.sans}`;
    ctx.textAlign = "left";
    ctx.fillStyle = p.ink;
    ctx.fillText(r.label, b.x, y + labelPx);
    const by = y + labelPx + 12 * s;
    ctx.fillStyle = rgba(p.ink, 0.14);
    rr(ctx, b.x, by, b.w, barH, barH / 2);
    ctx.fill();
    ctx.font = `800 ${barH * 0.56}px ${f.sans}`;
    const vw = ctx.measureText(r.display).width + 40 * s;
    const bw = Math.max(barH, (Math.abs(r.value) / max) * b.w);
    const c = pop(p, n);
    const g = ctx.createLinearGradient(b.x, 0, b.x + bw, 0);
    g.addColorStop(0, mix(c, p.bg[0], 0.2));
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    rr(ctx, b.x, by, bw, barH, barH / 2);
    ctx.fill();
    // The value sits inside the bar when there's room, else just after it.
    const inside = bw > vw + 20 * s;
    ctx.textAlign = inside ? "right" : "left";
    ctx.fillStyle = inside ? inkOn(c, "#0B1B33") : p.ink;
    ctx.fillText(r.display, inside ? b.x + bw - 22 * s : b.x + bw + 16 * s, by + barH * 0.7);
  });
}

function drawDonut(ctx: CanvasRenderingContext2D, f: Fonts, i: Infographic, p: InfoPalette, b: Box, s: number) {
  const parts = i.series;
  const total = parts.reduce((a, x) => a + Math.max(0, x.value), 0) || 1;
  const wide = b.w > b.h * 1.3;
  const r = wide ? Math.min(b.h / 2 - 6, b.w * 0.24) : Math.min(b.w * 0.3, (b.h * 0.58) / 2);
  const cx = wide ? b.x + r + 10 : b.x + b.w / 2;
  const cy = wide ? b.y + b.h / 2 : b.y + r + 4;
  const lw = r * 0.42;
  let a = -Math.PI / 2;
  ctx.lineCap = "butt";
  ctx.lineWidth = lw;
  parts.forEach((x, n) => {
    const sweep = (Math.PI * 2 * Math.max(0, x.value)) / total;
    ctx.strokeStyle = pop(p, n);
    ctx.beginPath();
    ctx.arc(cx, cy, r - lw / 2, a + 0.02, a + sweep - 0.02);
    ctx.stroke();
    a += sweep;
  });
  const top = parts.reduce((m, x) => (x.value > m.value ? x : m), parts[0]);
  ctx.textAlign = "center";
  ctx.fillStyle = p.ink;
  const px = oneLine(ctx, top.display, (n) => `${n}px ${f.anton}`, (r - lw) * 1.6, r * 0.5, 30);
  ctx.font = `${px}px ${f.anton}`;
  ctx.fillText(top.display, cx, cy + px * 0.36);
  // Legend.
  const lx = wide ? cx + r + 50 * s : b.x + 20 * s;
  const ly = wide ? b.y + (b.h - parts.length * 96 * s) / 2 : cy + r + 40 * s;
  const rowH = wide ? 96 * s : Math.min(86 * s, (b.y + b.h - ly) / parts.length);
  parts.forEach((x, n) => {
    const y = ly + n * rowH;
    ctx.fillStyle = pop(p, n);
    rr(ctx, lx, y + 6 * s, 30 * s, 30 * s, 8 * s);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = `800 ${40 * s}px ${f.sans}`;
    ctx.fillStyle = p.ink;
    ctx.fillText(x.display, lx + 48 * s, y + 34 * s);
    const dw = ctx.measureText(x.display).width;
    ctx.font = `500 ${30 * s}px ${f.sans}`;
    ctx.fillStyle = rgba(p.ink, 0.85);
    ctx.fillText(x.label, lx + 48 * s + dw + 16 * s, y + 33 * s);
  });
}

function drawCompare(ctx: CanvasRenderingContext2D, f: Fonts, i: Infographic, p: InfoPalette, b: Box, s: number) {
  const c = i.compare!;
  const gap = 36 * s;
  const cw = (b.w - gap) / 2;
  // Cards follow the text colour: dark glass under white text, white glass under dark text.
  const light = isLight(p.ink) === false;
  const pad = 32 * s;
  // Each card is as tall as its content (the taller of the two), centred in the space.
  const measure = (side: typeof c.left) => {
    ctx.font = `500 ${30 * s}px ${f.sans}`;
    const pts = side.points.reduce((h, pt) => h + wrap(ctx, pt, cw - pad * 2 - 40 * s).slice(0, 2).length * 38 * s + 18 * s, 0);
    return 46 * s + 2 * 44 * s + 20 * s + Math.min(110 * s, b.h * 0.2) + 26 * s + pts + 30 * s;
  };
  const ch = Math.min(b.h, Math.max(measure(c.left), measure(c.right)));
  const cy0 = b.y + (b.h - ch) / 2;
  [c.left, c.right].forEach((side, n) => {
    const x = b.x + n * (cw + gap);
    const by0 = cy0;
    ctx.fillStyle = light ? rgba("#FFFFFF", 0.78) : rgba("#000000", 0.2);
    rr(ctx, x, by0, cw, ch, 34 * s);
    ctx.fill();
    const col = pop(p, n === 0 ? 0 : 2);
    ctx.fillStyle = col;
    rr(ctx, x, by0, cw, 14 * s, 7 * s);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = p.ink;
    const t = fit(ctx, side.title, (px) => `800 ${px}px ${f.sans}`, cw - pad * 2, 90 * s, 40 * s, 26 * s, 1.1, 2);
    ctx.font = `800 ${t.px}px ${f.sans}`;
    t.lines.forEach((l, k) => ctx.fillText(l, x + pad, by0 + 46 * s + t.px + k * t.lh));
    let y = by0 + 46 * s + t.lines.length * t.lh + 20 * s;
    const vpx = oneLine(ctx, side.value, (px) => `${px}px ${f.anton}`, cw - pad * 2, Math.min(110 * s, b.h * 0.2), 34);
    ctx.font = `${vpx}px ${f.anton}`;
    ctx.fillStyle = light ? mix(col, "#000000", 0.15) : col;
    ctx.fillText(side.value, x + pad, y + vpx * 0.9);
    y += vpx + 26 * s;
    ctx.font = `500 ${30 * s}px ${f.sans}`;
    for (const pt of side.points) {
      const lines = wrap(ctx, pt, cw - pad * 2 - 40 * s).slice(0, 2);
      if (y + lines.length * 38 * s > by0 + ch - 16 * s) break;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + pad + 10 * s, y + 18 * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.ink;
      lines.forEach((l, k) => ctx.fillText(l, x + pad + 34 * s, y + 28 * s + k * 38 * s));
      y += lines.length * 38 * s + 18 * s;
    }
  });
  // The "vs" badge between them.
  const bx = b.x + cw + gap / 2;
  const by = cy0 + ch / 2;
  ctx.fillStyle = pop(p, 1);
  ctx.beginPath();
  ctx.arc(bx, by, 44 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `${40 * s}px ${f.anton}`;
  ctx.textAlign = "center";
  ctx.fillStyle = inkOn(pop(p, 1), "#0B1B33");
  ctx.fillText("VS", bx, by + 14 * s);
}

function drawLine(ctx: CanvasRenderingContext2D, f: Fonts, i: Infographic, p: InfoPalette, b: Box, s: number) {
  const pts = i.series;
  const vals = pts.map((x) => x.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || Math.abs(hi) || 1;
  const min = lo >= 0 ? Math.max(0, lo - span * 0.35) : lo - span * 0.1;
  const max = hi + span * 0.12;
  const plot = { x: b.x + 20 * s, y: b.y + 90 * s, w: b.w - 40 * s, h: b.h - 150 * s };
  const X = (n: number) => plot.x + (pts.length === 1 ? plot.w / 2 : (n * plot.w) / (pts.length - 1));
  const Y = (v: number) => plot.y + plot.h - ((v - min) / (max - min || 1)) * plot.h;
  // Guide lines.
  ctx.strokeStyle = rgba(p.ink, 0.14);
  ctx.lineWidth = 2;
  for (let k = 0; k <= 3; k++) {
    const y = plot.y + (plot.h * k) / 3;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
  }
  const c = pop(p, 0);
  // The area under the line.
  const g = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
  g.addColorStop(0, rgba(c, 0.55));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(X(0), plot.y + plot.h);
  pts.forEach((x, n) => ctx.lineTo(X(n), Y(x.value)));
  ctx.lineTo(X(pts.length - 1), plot.y + plot.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = c;
  ctx.lineWidth = 9 * s;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  pts.forEach((x, n) => (n ? ctx.lineTo(X(n), Y(x.value)) : ctx.moveTo(X(n), Y(x.value))));
  ctx.stroke();
  pts.forEach((x, n) => {
    const last = n === pts.length - 1;
    ctx.fillStyle = last ? c : p.bg[1];
    ctx.strokeStyle = last ? p.ink : c;
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.arc(X(n), Y(x.value), (last ? 16 : 10) * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  // X labels (thinned when crowded).
  ctx.font = `600 ${24 * s}px ${f.sans}`;
  ctx.fillStyle = rgba(p.ink, 0.85);
  const every = Math.ceil(pts.length / 6);
  pts.forEach((x, n) => {
    if (n % every && n !== pts.length - 1) return;
    ctx.textAlign = n === 0 ? "left" : n === pts.length - 1 ? "right" : "center";
    ctx.fillText(x.label, X(n), plot.y + plot.h + 44 * s);
  });
  // Callouts: where it starts and where it ends.
  const tag = (n: number, color: string, ink: string) => {
    const x = pts[n];
    ctx.font = `800 ${34 * s}px ${f.sans}`;
    const tw = ctx.measureText(x.display).width + 36 * s;
    const th = 58 * s;
    let tx = X(n) - tw / 2;
    tx = Math.max(b.x, Math.min(b.x + b.w - tw, tx));
    const ty = Math.max(b.y, Y(x.value) - th - 26 * s);
    ctx.fillStyle = color;
    rr(ctx, tx, ty, tw, th, th / 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.fillText(x.display, tx + tw / 2, ty + th * 0.68);
  };
  tag(0, rgba(p.ink, 0.18), p.ink);
  tag(pts.length - 1, c, inkOn(c, "#0B1B33"));
}

function drawSteps(ctx: CanvasRenderingContext2D, f: Fonts, i: Infographic, p: InfoPalette, b: Box, s: number) {
  const n = i.steps.length;
  const rowH = b.h / n;
  const d = Math.min(rowH * 0.7, 100 * s);
  i.steps.forEach((step, k) => {
    const cy = b.y + k * rowH + rowH / 2;
    const c = pop(p, k);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(b.x + d / 2, cy, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${d * 0.56}px ${f.anton}`;
    ctx.textAlign = "center";
    ctx.fillStyle = inkOn(c, "#0B1B33");
    ctx.fillText(String(k + 1), b.x + d / 2, cy + d * 0.2);
    if (k < n - 1) {
      ctx.strokeStyle = rgba(p.ink, 0.25);
      ctx.lineWidth = 4 * s;
      ctx.setLineDash([2, 12 * s]);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x + d / 2, cy + d / 2 + 8 * s);
      ctx.lineTo(b.x + d / 2, cy + rowH - d / 2 - 8 * s);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const tx = b.x + d + 34 * s;
    const t = fit(ctx, step, (px) => `700 ${px}px ${f.sans}`, b.w - d - 34 * s, rowH * 0.9, 44 * s, 26 * s, 1.15, 2);
    ctx.font = `700 ${t.px}px ${f.sans}`;
    ctx.textAlign = "left";
    ctx.fillStyle = p.ink;
    const top = cy - (t.lines.length * t.lh) / 2;
    t.lines.forEach((l, j) => ctx.fillText(l, tx, top + t.px * 0.9 + j * t.lh));
  });
}

const LAYOUTS = { stat: drawStat, bars: drawBars, donut: drawDonut, compare: drawCompare, line: drawLine, steps: drawSteps };

/** Draws the infographic at posting size and sets the canvas's size to match. */
export async function drawInfographic(canvas: HTMLCanvasElement, input: InfographicInput) {
  const f = await loadFonts();
  const H = HEIGHTS[input.aspect];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can’t draw the graphic.");
  const { spec: i, palette: p } = input;
  const s = H < 800 ? 0.62 : H < 1200 ? 0.88 : 1;
  const pad = 72 * s;
  background(ctx, p, H);

  // Kicker pill.
  let y = pad;
  if (i.kicker) {
    ctx.font = `800 ${24 * s}px ${f.sans}`;
    const label = i.kicker.toUpperCase();
    const tw = ctx.measureText(label).width + 40 * s;
    ctx.fillStyle = pop(p, 0);
    rr(ctx, pad, y, tw, 50 * s, 25 * s);
    ctx.fill();
    ctx.fillStyle = inkOn(pop(p, 0), "#0B1B33");
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, pad + 20 * s, y + 34 * s);
    y += 50 * s + 26 * s;
  }
  // Headline.
  const h = fit(ctx, i.headline, (px) => `800 ${px}px ${f.sans}`, W - pad * 2, H * 0.2, 76 * s, 38 * s, 1.08, 3);
  ctx.font = `800 ${h.px}px ${f.sans}`;
  ctx.fillStyle = p.ink;
  ctx.textAlign = "left";
  h.lines.forEach((l, n) => ctx.fillText(l, pad, y + h.px * 0.88 + n * h.lh));
  y += h.lines.length * h.lh + 40 * s;

  // Footer: name, then the small print.
  const note = [i.hypothetical ? HYPOTHETICAL_NOTE : "", i.source ? `Source: ${i.source}` : ""].filter(Boolean).join(" ");
  ctx.font = `500 ${19 * s}px ${f.sans}`;
  const noteLines = note ? wrap(ctx, note, W - pad * 2).slice(0, 2) : [];
  const nameH = (input.name ? 40 * s : 0) + (input.sub ? 32 * s : 0);
  const footH = nameH + (noteLines.length ? noteLines.length * 26 * s + 14 * s : 0);
  const footY = H - pad * 0.8 - footH;
  // Takeaway above the footer.
  ctx.font = `600 ${34 * s}px ${f.sans}`;
  const take = i.takeaway ? wrap(ctx, i.takeaway, W - pad * 2 - 30 * s).slice(0, 2) : [];
  const takeH = take.length ? take.length * 44 * s + 30 * s : 0;
  const chart: Box = { x: pad, y, w: W - pad * 2, h: footY - takeH - 30 * s - y };
  if (chart.h > 80) LAYOUTS[i.layout](ctx, f, i, p, chart, s);
  if (take.length) {
    const ty = footY - takeH - 10 * s;
    ctx.fillStyle = pop(p, 0);
    rr(ctx, pad, ty + 4 * s, 8 * s, take.length * 44 * s - 4 * s, 4 * s);
    ctx.fill();
    ctx.font = `600 ${34 * s}px ${f.sans}`;
    ctx.fillStyle = p.ink;
    ctx.textAlign = "left";
    take.forEach((l, n) => ctx.fillText(l, pad + 30 * s, ty + 34 * s + n * 44 * s));
  }
  let fy = footY;
  if (nameH) {
    ctx.fillStyle = rgba(p.ink, 0.25);
    ctx.fillRect(pad, fy - 8 * s, W - pad * 2, 2);
    ctx.textAlign = "left";
    if (input.name) {
      ctx.font = `800 ${30 * s}px ${f.sans}`;
      ctx.fillStyle = p.ink;
      ctx.fillText(input.name, pad, fy + 32 * s);
      fy += 40 * s;
    }
    if (input.sub) {
      ctx.font = `500 ${24 * s}px ${f.sans}`;
      ctx.fillStyle = rgba(p.ink, 0.8);
      ctx.fillText(input.sub, pad, fy + 26 * s);
      fy += 32 * s;
    }
  }
  if (noteLines.length) {
    ctx.font = `500 ${19 * s}px ${f.sans}`;
    ctx.fillStyle = rgba(p.ink, 0.72);
    ctx.textAlign = "left";
    noteLines.forEach((l, n) => ctx.fillText(l, pad, fy + 14 * s + 20 * s + n * 26 * s));
  }
}
