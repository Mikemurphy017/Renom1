import { assColor, esc, ts } from "./ass";

/**
 * Motion graphics for the edit: animated charts, count-up numbers, checklists,
 * comparisons, timelines, full-screen title and quote cutaways, and icon
 * callouts. Drawn by libass as animated vector shapes and type (no extra
 * software): wipes and slides in, bars that grow, numbers that count, ticks that
 * pop, shapes that keep drifting while the graphic is up, so they move with the
 * video and add color.
 */

export { GRAPHIC_KINDS, GRAPHIC_LABELS, FULL_SCREEN, type GraphicKind } from "../graphic-kinds";
import { FULL_SCREEN, type GraphicKind } from "../graphic-kinds";

export const ICONS = ["up", "down", "warning", "check", "calendar", "dollar", "clock", "house", "shield", "idea"] as const;
export type IconName = (typeof ICONS)[number];

export interface Graphic {
  kind: GraphicKind;
  /** Seconds into the edited video. */
  at: number;
  dur: number;
  title?: string;
  /** Small label above the title. */
  kicker?: string;
  /** list: the points; compare: not used. */
  items?: string[];
  /** chart: bars (2–5). */
  bars?: { label: string; value: number; display?: string }[];
  /** chart: heights show a relationship, not figures from the video. */
  illustrative?: boolean;
  /** compare: the two sides. */
  left?: { label: string; items: string[] };
  right?: { label: string; items: string[] };
  /** timeline: 2–5 points in order. */
  points?: { label: string; note?: string }[];
  /** stat: the figure. */
  number?: { value: number; prefix?: string; suffix?: string; decimals?: number; label: string };
  /** quote: the line and who said it. */
  quote?: string;
  by?: string;
  /** callout: which icon, and its label. */
  icon?: IconName;
  label?: string;
}

/** Bold, saturated grounds, one per graphic in turn so the video keeps changing color. */
const PALETTES = [
  { bg: "#0B1F3A", band: "#16345E", ink: "#FFFFFF", alt: "#FFD166" },
  { bg: "#2347E6", band: "#3A5CF0", ink: "#FFFFFF", alt: "#FFD166" },
  { bg: "#0F5C4D", band: "#14725F", ink: "#FFFFFF", alt: "#F5C542" },
  { bg: "#3B1F5C", band: "#4B2A73", ink: "#FFFFFF", alt: "#FF8FAB" },
  { bg: "#B4232C", band: "#C8343D", ink: "#FFFFFF", alt: "#FFD166" },
  { bg: "#111111", band: "#222222", ink: "#FFFFFF", alt: "#3CF2B4" },
];

/** ASS styles the graphics use (appended to the file's styles). */
export function graphicStyles() {
  return [
    "Style: GDraw,Liberation Sans,10,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1",
    "Style: GText,Montserrat ExtraBold,56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
    "Style: GSemi,Montserrat SemiBold,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
    "Style: GBig,Anton,180,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
    "Style: GQuote,Playfair Display,150,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,-1,0,0,100,100,0,0,1,0,0,5,0,0,0,1",
  ];
}

// ── shapes (ASS drawing commands, origin at the top-left) ──

const n = (v: number) => Math.round(v);
const rect = (w: number, h: number) => `m 0 0 l ${n(w)} 0 ${n(w)} ${n(h)} 0 ${n(h)}`;
function rrect(w: number, h: number, r: number) {
  const k = r * 0.45;
  return `m ${n(r)} 0 l ${n(w - r)} 0 b ${n(w - k)} 0 ${n(w)} ${n(k)} ${n(w)} ${n(r)} l ${n(w)} ${n(h - r)} b ${n(w)} ${n(h - k)} ${n(w - k)} ${n(h)} ${n(w - r)} ${n(h)} l ${n(r)} ${n(h)} b ${n(k)} ${n(h)} 0 ${n(h - k)} 0 ${n(h - r)} l 0 ${n(r)} b 0 ${n(k)} ${n(k)} 0 ${n(r)} 0`;
}
function circle(r: number) {
  const k = r * 0.5523;
  return `m ${n(r)} 0 b ${n(r + k)} 0 ${n(2 * r)} ${n(r - k)} ${n(2 * r)} ${n(r)} b ${n(2 * r)} ${n(r + k)} ${n(r + k)} ${n(2 * r)} ${n(r)} ${n(2 * r)} b ${n(r - k)} ${n(2 * r)} 0 ${n(r + k)} 0 ${n(r)} b 0 ${n(r - k)} ${n(r - k)} 0 ${n(r)} 0`;
}
/** A tick inside a box of size s. */
const tick = (s: number) => `m ${n(s * 0.16)} ${n(s * 0.52)} l ${n(s * 0.3)} ${n(s * 0.38)} ${n(s * 0.44)} ${n(s * 0.54)} ${n(s * 0.74)} ${n(s * 0.22)} ${n(s * 0.88)} ${n(s * 0.36)} ${n(s * 0.44)} ${n(s * 0.8)}`;

/** Simple glyphs for callouts, inside a box of size s. */
function iconPath(icon: IconName, s: number): string {
  const p = (pts: [number, number][]) => `m ${pts.map(([x, y]) => `${n(x * s)} ${n(y * s)}`).join(" l ")}`;
  switch (icon) {
    case "up": return p([[0.5, 0.12], [0.86, 0.5], [0.64, 0.5], [0.64, 0.88], [0.36, 0.88], [0.36, 0.5], [0.14, 0.5]]);
    case "down": return p([[0.5, 0.88], [0.86, 0.5], [0.64, 0.5], [0.64, 0.12], [0.36, 0.12], [0.36, 0.5], [0.14, 0.5]]);
    case "warning": return p([[0.5, 0.1], [0.92, 0.86], [0.08, 0.86]]);
    case "check": return tick(s);
    case "calendar": return `${p([[0.12, 0.2], [0.88, 0.2], [0.88, 0.88], [0.12, 0.88]])} ${p([[0.12, 0.2], [0.88, 0.2], [0.88, 0.36], [0.12, 0.36]])} ${p([[0.28, 0.08], [0.36, 0.08], [0.36, 0.26], [0.28, 0.26]])} ${p([[0.64, 0.08], [0.72, 0.08], [0.72, 0.26], [0.64, 0.26]])}`;
    case "dollar": return `${p([[0.44, 0.06], [0.56, 0.06], [0.56, 0.94], [0.44, 0.94]])} ${p([[0.26, 0.22], [0.74, 0.22], [0.74, 0.34], [0.38, 0.34], [0.38, 0.44], [0.74, 0.44], [0.74, 0.78], [0.26, 0.78], [0.26, 0.66], [0.62, 0.66], [0.62, 0.56], [0.26, 0.56]])}`;
    case "clock": return `m ${n(s * 0.47)} ${n(s * 0.2)} l ${n(s * 0.55)} ${n(s * 0.2)} ${n(s * 0.55)} ${n(s * 0.5)} ${n(s * 0.75)} ${n(s * 0.62)} ${n(s * 0.71)} ${n(s * 0.69)} ${n(s * 0.47)} ${n(s * 0.55)}`;
    case "house": return p([[0.5, 0.1], [0.92, 0.48], [0.8, 0.48], [0.8, 0.9], [0.6, 0.9], [0.6, 0.64], [0.4, 0.64], [0.4, 0.9], [0.2, 0.9], [0.2, 0.48], [0.08, 0.48]]);
    case "shield": return `m ${n(s * 0.5)} ${n(s * 0.08)} l ${n(s * 0.86)} ${n(s * 0.22)} b ${n(s * 0.86)} ${n(s * 0.6)} ${n(s * 0.72)} ${n(s * 0.8)} ${n(s * 0.5)} ${n(s * 0.94)} b ${n(s * 0.28)} ${n(s * 0.8)} ${n(s * 0.14)} ${n(s * 0.6)} ${n(s * 0.14)} ${n(s * 0.22)}`;
    case "idea": return `${circle(s * 0.3).replace(/(-?\d+) (-?\d+)/g, (_, x, y) => `${n(+x + s * 0.2)} ${n(+y + s * 0.06)}`)} ${p([[0.38, 0.7], [0.62, 0.7], [0.62, 0.9], [0.38, 0.9]])}`;
  }
}

// ── layout ──

interface Frame {
  W: number;
  H: number;
  vertical: boolean;
  /** The advisor's highlight color. */
  accent: string;
}

type Line = string;
const dlg = (layer: number, a: number, b: number, style: string, text: string, ml = 0, mr = 0) => `Dialogue: ${layer},${ts(a)},${ts(b)},${style},,${ml},${mr},0,,${text}`;
const draw = (layer: number, a: number, b: number, x: number, y: number, color: string, path: string, extra = "") =>
  dlg(layer, a, b, "GDraw", `{\\an7\\pos(${n(x)},${n(y)})\\c${assColor(color)}${extra}\\p1}${path}{\\p0}`);
const text = (layer: number, a: number, b: number, style: string, x: number, y: number, body: string, extra = "", wrapW?: number, W?: number) => {
  const margin = wrapW && W ? Math.max(0, n((W - wrapW) / 2)) : 0;
  return dlg(layer, a, b, style, `{\\pos(${n(x)},${n(y)})${extra}}${body}`, margin, margin);
};
/** Type is set larger than a slide would be: these are read on a phone, in a second or two. */
let SCALE = 1;
/** Font size so `s` fits `w` pixels (rough, for bold sans). */
const fitSize = (s: string, w: number, max: number, perChar = 0.56) => n(Math.max(28, Math.min(max * SCALE, w / Math.max(1, s.length * perChar))));
const fmtNum = (v: number, decimals = 0) => v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * A full-screen colored ground that wipes in, drifts while it's up (shapes keep
 * moving), and wipes out. Content runs from `a + 0.2` to `b - 0.2`.
 */
function ground(f: Frame, a: number, b: number, pal: (typeof PALETTES)[number], i: number): Line[] {
  const { W, H } = f;
  const d = Math.round((b - a) * 1000);
  const dir = i % 2 === 0;
  const wipeIn = dir ? `\\clip(0,0,0,${H})\\t(0,260,\\clip(0,0,${W},${H}))` : `\\clip(${W},0,${W},${H})\\t(0,260,\\clip(0,0,${W},${H}))`;
  const wipeOut = dir ? `\\t(${d - 240},${d},\\clip(${W},0,${W},${H}))` : `\\t(${d - 240},${d},\\clip(0,0,0,${H}))`;
  const big = Math.max(W, H);
  return [
    draw(10, a, b, 0, 0, pal.bg, rect(W, H), `${wipeIn}${wipeOut}`),
    // A diagonal band and two soft circles that keep moving while the card is up.
    dlg(11, a, b, "GDraw", `{\\an7\\move(${n(-W * 0.3)},${n(H * 0.55)},${n(-W * 0.18)},${n(H * 0.5)})\\frz${dir ? 18 : -18}\\c${assColor(pal.band)}${wipeIn}${wipeOut}\\p1}${rect(big * 1.6, H * 0.16)}{\\p0}`),
    dlg(11, a, b, "GDraw", `{\\an7\\move(${n(W * 0.68)},${n(-H * 0.06)},${n(W * 0.62)},${n(H * 0.01)})\\c${assColor(f.accent)}\\1a&HC8&${wipeIn}${wipeOut}\\p1}${circle(big * 0.18)}{\\p0}`),
    dlg(11, a, b, "GDraw", `{\\an7\\move(${n(-W * 0.12)},${n(H * 0.78)},${n(-W * 0.06)},${n(H * 0.74)})\\c${assColor(pal.alt)}\\1a&HD2&${wipeIn}${wipeOut}\\p1}${circle(big * 0.14)}{\\p0}`),
  ];
}

/** Content timing: in after the wipe, out before it. */
const inner = (a: number, b: number) => ({ s: a + 0.22, e: b - 0.18 });
const pop = (ms: number, from = 40) => `\\fscx${from}\\fscy${from}\\t(${ms},${ms + 160},\\fscx108\\fscy108)\\t(${ms + 160},${ms + 260},\\fscx100\\fscy100)`;

function heading(f: Frame, g: Graphic, s: number, e: number, pal: (typeof PALETTES)[number], y: number): Line[] {
  const out: Line[] = [];
  const w = f.W * 0.84;
  if (g.kicker) out.push(text(13, s, e, "GSemi", f.W / 2, y - (f.vertical ? 74 : 62), esc(g.kicker.toUpperCase()), `\\fs${f.vertical ? 34 : 30}\\c${assColor(pal.alt)}\\fsp4\\fad(200,150)`, w, f.W));
  if (g.title) {
    const t = esc(g.title);
    out.push(text(13, s, e, "GText", f.W / 2, y, t, `\\fs${fitSize(g.title, w, f.vertical ? 76 : 70, 0.52)}\\fad(150,150)\\move(${n(f.W / 2)},${n(y + 30)},${n(f.W / 2)},${n(y)},0,260)`, w, f.W));
  }
  return out;
}

// ── the graphics ──

function titleCard(f: Frame, g: Graphic, pal: (typeof PALETTES)[number]): Line[] {
  const { s, e } = inner(g.at, g.at + g.dur);
  const t = (g.title ?? "").toUpperCase();
  const w = f.W * 0.86;
  const size = fitSize(t, w * (f.vertical ? 2.2 : 1.6), f.vertical ? 190 : 170, 0.42);
  const y = f.H * (f.vertical ? 0.46 : 0.48);
  const out: Line[] = [];
  if (g.kicker) out.push(text(13, s, e, "GSemi", f.W / 2, y - size * (f.vertical ? 1.25 : 0.95), esc(g.kicker.toUpperCase()), `\\fs${f.vertical ? 38 : 34}\\c${assColor(pal.alt)}\\fsp6\\fad(200,150)`, w, f.W));
  out.push(text(13, s, e, "GBig", f.W / 2, y, esc(t), `\\fs${size}\\fad(120,150)${pop(0, 70)}`, w, f.W));
  // An accent bar that draws itself under the title.
  const barW = Math.min(w * 0.5, 420);
  out.push(draw(13, s + 0.15, e, (f.W - barW) / 2, y + size * (f.vertical ? 0.95 : 0.62), f.accent, rrect(barW, 14, 7), `\\org(${n((f.W - barW) / 2)},0)\\fscx0\\t(0,380,\\fscx100)\\fad(0,150)`));
  return out;
}

function quoteCard(f: Frame, g: Graphic, pal: (typeof PALETTES)[number]): Line[] {
  const { s, e } = inner(g.at, g.at + g.dur);
  const q = g.quote ?? g.title ?? "";
  const w = f.W * 0.8;
  const y = f.H * (f.vertical ? 0.47 : 0.5);
  const size = fitSize(q, w * (f.vertical ? 4.2 : 2.6), f.vertical ? 84 : 72, 0.5);
  return [
    text(13, s, e, "GQuote", f.W / 2, y - size * (f.vertical ? 2.6 : 1.9), "“", `\\fs${f.vertical ? 260 : 220}\\c${assColor(f.accent)}\\fad(150,150)${pop(0, 50)}`),
    text(13, s + 0.1, e, "GText", f.W / 2, y, esc(q), `\\fs${size}\\fad(220,150)\\move(${n(f.W / 2)},${n(y + 24)},${n(f.W / 2)},${n(y)},0,320)`, w, f.W),
    ...(g.by ? [text(13, s + 0.35, e, "GSemi", f.W / 2, y + size * (f.vertical ? 2.6 : 1.8), `— ${esc(g.by)}`, `\\fs${f.vertical ? 38 : 34}\\c${assColor(pal.alt)}\\fad(200,150)`, w, f.W)] : []),
  ];
}

function listCard(f: Frame, g: Graphic, pal: (typeof PALETTES)[number]): Line[] {
  const { s, e } = inner(g.at, g.at + g.dur);
  const items = (g.items ?? []).slice(0, 5);
  const out = heading(f, { ...g, title: g.title }, s, e, pal, f.H * (f.vertical ? 0.27 : 0.18));
  const rowH = f.vertical ? 210 : 140;
  const top = f.H * (f.vertical ? 0.37 : 0.33);
  const box = f.vertical ? 100 : 76;
  const x0 = f.W * (f.vertical ? 0.1 : 0.2);
  const step = Math.min(0.5, (e - s - 0.6) / Math.max(1, items.length));
  items.forEach((it, i) => {
    const at = s + 0.25 + i * step;
    const y = top + i * rowH;
    const ms = 0;
    out.push(draw(13, at, e, x0, y, f.accent, rrect(box, box, box * 0.28), `\\org(${n(x0 + box / 2)},${n(y + box / 2)})${pop(ms)}\\fad(0,150)`));
    out.push(draw(14, at + 0.15, e, x0, y, pal.bg, tick(box), `\\org(${n(x0 + box / 2)},${n(y + box / 2)})${pop(0, 20)}\\fad(0,150)`));
    const tx = x0 + box + 36;
    const size = fitSize(it, f.W - tx - f.W * 0.06, f.vertical ? 56 : 50, 0.55);
    out.push(dlg(13, at + 0.05, e, "GText", `{\\an4\\move(${n(tx + 60)},${n(y + box / 2)},${n(tx)},${n(y + box / 2)},0,240)\\fs${size}\\fad(180,150)}${esc(it)}`, 0, 0));
  });
  return out;
}

function compareCard(f: Frame, g: Graphic, pal: (typeof PALETTES)[number]): Line[] {
  const { s, e } = inner(g.at, g.at + g.dur);
  const out = heading(f, g, s, e, pal, f.H * (f.vertical ? 0.24 : 0.14));
  const L = g.left ?? { label: "Before", items: [] };
  const R = g.right ?? { label: "After", items: [] };
  const colW = f.W * (f.vertical ? 0.4 : 0.36);
  const gap = f.W * (f.vertical ? 0.06 : 0.1);
  const xL = (f.W - colW * 2 - gap) / 2;
  const xR = xL + colW + gap;
  const top = f.H * (f.vertical ? 0.33 : 0.27);
  const headH = f.vertical ? 124 : 96;
  const rows = Math.max(L.items.length, R.items.length, 1);
  const rowGap = f.vertical ? 190 : 120;
  const colH = Math.min(f.H * (f.vertical ? 0.5 : 0.6), headH + 110 + rows * rowGap);
  [[L, xL, "#FFFFFF", pal.bg, -1], [R, xR, f.accent, pal.bg, 1]].forEach(([side, x, fill, ink, from], k) => {
    const sd = side as { label: string; items: string[] };
    const xx = x as number;
    const at = s + 0.1 + k * 0.25;
    // Column panel slides up, header chip pops.
    out.push(dlg(12, at, e, "GDraw", `{\\an7\\move(${n(xx)},${n(top + 80)},${n(xx)},${n(top)},0,280)\\c${assColor("#FFFFFF")}\\1a&HE6&\\fad(150,150)\\p1}${rrect(colW, colH, 36)}{\\p0}`));
    out.push(draw(13, at + 0.1, e, xx, top, fill as string, rrect(colW, headH, 30), `\\org(${n(xx + colW / 2)},${n(top + headH / 2)})${pop(0, 60)}\\fad(0,150)`));
    out.push(text(14, at + 0.18, e, "GText", xx + colW / 2, top + headH / 2, esc(sd.label.toUpperCase()), `\\fs${fitSize(sd.label, colW * 0.85, f.vertical ? 46 : 42, 0.6)}\\c${assColor(ink as string)}\\fad(150,150)`));
    sd.items.slice(0, 4).forEach((it, i) => {
      const iy = top + headH + 90 + i * rowGap;
      const size = fitSize(it, colW * 1.7, f.vertical ? 44 : 38, 0.55);
      out.push(text(13, at + 0.45 + i * 0.32, e, "GSemi", xx + colW / 2, iy, esc(it), `\\fs${size}\\fad(200,150)\\move(${n(xx + colW / 2 + (from as number) * 40)},${n(iy)},${n(xx + colW / 2)},${n(iy)},0,240)`, colW * 0.92, f.W));
    });
  });
  // The "VS" badge pops between the columns.
  const r = f.vertical ? 62 : 54;
  const cx = f.W / 2;
  const cy = top + headH / 2;
  out.push(draw(15, s + 0.5, e, cx - r, cy - r, pal.alt, circle(r), `\\org(${n(cx)},${n(cy)})${pop(0, 30)}\\fad(0,150)`));
  out.push(text(16, s + 0.55, e, "GText", cx, cy, "VS", `\\fs${f.vertical ? 46 : 40}\\c${assColor(pal.bg)}\\fad(150,150)`));
  return out;
}

function chartCard(f: Frame, g: Graphic, pal: (typeof PALETTES)[number]): Line[] {
  const { s, e } = inner(g.at, g.at + g.dur);
  const bars = (g.bars ?? []).filter((b) => Number.isFinite(b.value) && b.value >= 0).slice(0, 5);
  const out = heading(f, g, s, e, pal, f.H * (f.vertical ? 0.23 : 0.14));
  if (!bars.length) return out;
  const max = Math.max(...bars.map((b) => b.value), 1);
  const areaW = f.W * (f.vertical ? 0.84 : 0.7);
  const x0 = (f.W - areaW) / 2;
  const base = f.H * (f.vertical ? 0.74 : 0.78);
  const maxH = f.H * (f.vertical ? 0.36 : 0.46);
  const slot = areaW / bars.length;
  const bw = Math.min(slot * 0.62, f.vertical ? 200 : 220);
  // Baseline draws itself.
  out.push(draw(12, s, e, x0, base, "#FFFFFF", rect(areaW, 4), `\\1a&H60&\\org(${n(x0)},${n(base)})\\fscx0\\t(0,300,\\fscx100)\\fad(0,150)`));
  const top = bars.reduce((iMax, b, i) => (b.value > bars[iMax].value ? i : iMax), 0);
  bars.forEach((b, i) => {
    const h = Math.max(18, (b.value / max) * maxH);
    const x = x0 + slot * i + (slot - bw) / 2;
    const at = s + 0.2 + i * 0.22;
    const color = i === top ? f.accent : "#FFFFFF";
    out.push(draw(13, at, e, x, base - h, color, rrect(bw, h, Math.min(18, bw * 0.12)), `${i === top ? "" : "\\1a&H30&"}\\org(${n(x)},${n(base)})\\fscy0\\t(0,520,0.6,\\fscy100)\\fad(0,150)`));
    const valueText = g.illustrative ? "" : b.display ?? fmtNum(b.value);
    if (valueText) out.push(text(14, at + 0.4, e, "GText", x + bw / 2, base - h - (f.vertical ? 44 : 38), esc(valueText), `\\fs${fitSize(valueText, slot * 0.95, f.vertical ? 50 : 44, 0.6)}\\fad(200,150)${pop(0, 60)}`));
    out.push(text(14, at + 0.1, e, "GSemi", x + bw / 2, base + (f.vertical ? 48 : 40), esc(b.label), `\\fs${fitSize(b.label, slot * 0.95, f.vertical ? 36 : 32, 0.55)}\\c${assColor(pal.alt)}\\fad(200,150)`));
  });
  if (g.illustrative) out.push(text(14, s + 0.6, e, "GSemi", f.W / 2, base + (f.vertical ? 120 : 96), "Illustrative", `\\fs${f.vertical ? 28 : 24}\\1a&H60&\\fad(200,150)`));
  return out;
}

function timelineCard(f: Frame, g: Graphic, pal: (typeof PALETTES)[number]): Line[] {
  const { s, e } = inner(g.at, g.at + g.dur);
  const pts = (g.points ?? []).slice(0, 5);
  const out = heading(f, g, s, e, pal, f.H * (f.vertical ? 0.32 : 0.2));
  if (!pts.length) return out;
  const x0 = f.W * 0.1;
  const len = f.W * 0.8;
  const y = f.H * (f.vertical ? 0.55 : 0.56);
  out.push(draw(12, s, e, x0, y - 4, "#FFFFFF", rrect(len, 8, 4), `\\1a&H50&\\org(${n(x0)},${n(y)})\\fscx0\\t(0,${Math.round(380 + pts.length * 120)},\\fscx100)\\fad(0,150)`));
  const r = f.vertical ? 26 : 22;
  pts.forEach((p, i) => {
    const x = pts.length === 1 ? f.W / 2 : x0 + (len * i) / (pts.length - 1);
    const at = s + 0.2 + i * 0.32;
    const last = i === pts.length - 1;
    out.push(draw(13, at, e, x - r, y - r, last ? f.accent : "#FFFFFF", circle(r), `\\org(${n(x)},${n(y)})${pop(0, 20)}\\fad(0,150)`));
    // A ring that pulses out from each point as it lands.
    out.push(dlg(13, at, at + 0.6, "GDraw", `{\\an7\\pos(${n(x - r * 2)},${n(y - r * 2)})\\org(${n(x)},${n(y)})\\c${assColor(last ? f.accent : "#FFFFFF")}\\1a&HFF&\\3c${assColor(last ? f.accent : "#FFFFFF")}\\bord4\\t(0,600,\\fscx160\\fscy160\\3a&HFF&)\\p1}${circle(r * 2)}{\\p0}`));
    const above = f.vertical ? i % 2 === 0 : true;
    const ly = above ? y - (f.vertical ? 110 : 96) : y + (f.vertical ? 110 : 96);
    const slot = pts.length > 1 ? len / (pts.length - 1) : len;
    out.push(text(14, at + 0.08, e, "GText", x, ly, esc(p.label), `\\fs${fitSize(p.label, Math.min(slot * (f.vertical ? 1.8 : 0.95), f.W * 0.4), f.vertical ? 64 : 56, 0.55)}${last ? `\\c${assColor(f.accent)}` : ""}\\fad(180,150)`));
    if (p.note) {
      const ny = above ? y + (f.vertical ? 90 : 76) : y - (f.vertical ? 90 : 76);
      out.push(text(14, at + 0.18, e, "GSemi", x, ny, esc(p.note), `\\fs${fitSize(p.note, Math.min(slot * (f.vertical ? 1.8 : 0.95), f.W * 0.4), f.vertical ? 34 : 30, 0.55)}\\c${assColor(pal.alt)}\\fad(180,150)`));
    }
  });
  return out;
}

/** A panel over the video (not a cutaway): the figure counts up, the label slides in. */
function statPanel(f: Frame, g: Graphic, pal: (typeof PALETTES)[number], i: number): Line[] {
  const num = g.number;
  if (!num) return [];
  const a = g.at;
  const b = g.at + g.dur;
  const pw = f.vertical ? f.W * 0.82 : f.W * 0.4;
  const ph = f.vertical ? 330 : 300;
  const px = f.vertical ? (f.W - pw) / 2 : i % 2 === 0 ? f.W * 0.56 : f.W * 0.04;
  const py = f.vertical ? f.H * 0.1 : f.H * 0.12;
  const from = f.vertical ? -pw - 40 : i % 2 === 0 ? f.W + 40 : -pw - 40;
  const d = Math.round((b - a) * 1000);
  const slide = (x: number, y: number) => `\\move(${n(f.vertical ? x : from + (x - px))},${n(f.vertical ? y - 220 : y)},${n(x)},${n(y)},0,300)`;
  const out: Line[] = [
    dlg(20, a, b, "GDraw", `{\\an7${slide(px, py)}\\c${assColor(pal.bg)}\\1a&H18&\\fad(0,200)\\p1}${rrect(pw, ph, 40)}{\\p0}`),
    dlg(21, a, b, "GDraw", `{\\an7${slide(px, py)}\\c${assColor(f.accent)}\\fad(0,200)\\p1}${rrect(18, ph, 9)}{\\p0}`),
  ];
  const cx = px + pw / 2 + 9;
  const ny = py + ph * 0.42;
  const fmt = (v: number) => `${num.prefix ?? ""}${fmtNum(v, num.decimals ?? 0)}${num.suffix ?? ""}`;
  const finalText = fmt(num.value);
  const size = fitSize(finalText, pw * 0.85, f.vertical ? 150 : 130, 0.5);
  // Count up over ~0.8 s, then hold.
  const steps = 14;
  const t0 = a + 0.25;
  for (let k = 0; k < steps; k++) {
    const v = (num.value * (1 - Math.pow(1 - (k + 1) / steps, 3)));
    const s0 = t0 + (k * 0.8) / steps;
    const s1 = k === steps - 1 ? b : t0 + ((k + 1) * 0.8) / steps;
    out.push(text(22, s0, s1, "GBig", cx, ny, esc(k === steps - 1 ? finalText : fmt(num.decimals ? v : Math.round(v))), `\\fs${size}\\c${assColor(f.accent)}${k === steps - 1 ? `\\fad(0,200)${pop(0, 92)}` : ""}`));
  }
  out.push(text(22, a + 0.4, b, "GSemi", cx, py + ph * 0.8, esc(num.label), `\\fs${fitSize(num.label, pw * 0.85, f.vertical ? 42 : 36, 0.55)}\\fad(200,200)\\move(${n(cx + 40)},${n(py + ph * 0.8)},${n(cx)},${n(py + ph * 0.8)},0,260)`, pw * 0.9, f.W));
  void d;
  return out;
}

/** An icon badge that pops beside the point, with a pulse, and a label chip that slides out. */
function callout(f: Frame, g: Graphic, pal: (typeof PALETTES)[number], i: number): Line[] {
  const a = g.at;
  const b = g.at + g.dur;
  const R = f.vertical ? 86 : 72;
  const left = i % 2 === 1;
  const cx = left ? f.W * 0.14 + R : f.W * 0.86 - R;
  const cy = f.vertical ? f.H * 0.2 : f.H * 0.2;
  const out: Line[] = [
    dlg(20, a, a + 0.8, "GDraw", `{\\an7\\pos(${n(cx - R)},${n(cy - R)})\\org(${n(cx)},${n(cy)})\\c${assColor(f.accent)}\\1a&HFF&\\3c${assColor(f.accent)}\\bord6\\t(0,800,\\fscx190\\fscy190\\3a&HFF&)\\p1}${circle(R)}{\\p0}`),
    draw(21, a, b, cx - R, cy - R, f.accent, circle(R), `\\org(${n(cx)},${n(cy)})${pop(0, 10)}\\fad(0,200)`),
    draw(22, a + 0.08, b, cx - R * 0.6, cy - R * 0.6, pal.bg, iconPath(g.icon ?? "idea", R * 1.2), `\\org(${n(cx)},${n(cy)})${pop(0, 10)}\\fad(0,200)`),
  ];
  // The warning sign's mark, in the badge color on top of the triangle.
  if (g.icon === "warning") {
    const s = R * 1.2;
    const m = (pts: [number, number][]) => `m ${pts.map(([x, y]) => `${n(x * s)} ${n(y * s)}`).join(" l ")}`;
    out.push(draw(23, a + 0.1, b, cx - R * 0.6, cy - R * 0.6, f.accent, `${m([[0.46, 0.36], [0.54, 0.36], [0.53, 0.64], [0.47, 0.64]])} ${m([[0.46, 0.7], [0.54, 0.7], [0.54, 0.78], [0.46, 0.78]])}`, `\\org(${n(cx)},${n(cy)})${pop(0, 10)}\\fad(0,200)`));
  }
  if (g.label) {
    const size = f.vertical ? 46 : 40;
    const w = Math.min(f.W * 0.6, g.label.length * size * 0.6 + 60);
    const lx = left ? cx + R + 20 : cx - R - 20 - w;
    const h = size + 40;
    out.push(dlg(20, a + 0.2, b, "GDraw", `{\\an7\\pos(${n(lx)},${n(cy - h / 2)})\\org(${n(left ? lx : lx + w)},${n(cy)})\\c${assColor(pal.bg)}\\fscx0\\t(0,260,\\fscx100)\\fad(0,200)\\p1}${rrect(w, h, h / 2)}{\\p0}`));
    out.push(text(21, a + 0.35, b, "GText", lx + w / 2, cy, esc(g.label.toUpperCase()), `\\fs${size}\\fad(150,200)`));
  }
  return out;
}

/** All the graphics' events, in the order they play. */
export function graphicsEvents(graphics: Graphic[], f: Frame): Line[] {
  SCALE = f.vertical ? 1.35 : 1.25;
  const out: Line[] = [];
  graphics.forEach((g, i) => {
    const pal = PALETTES[i % PALETTES.length];
    const full = FULL_SCREEN.includes(g.kind);
    if (full) out.push(...ground(f, g.at, g.at + g.dur, pal, i));
    switch (g.kind) {
      case "title": out.push(...titleCard(f, g, pal)); break;
      case "quote": out.push(...quoteCard(f, g, pal)); break;
      case "list": out.push(...listCard(f, g, pal)); break;
      case "compare": out.push(...compareCard(f, g, pal)); break;
      case "chart": out.push(...chartCard(f, g, pal)); break;
      case "timeline": out.push(...timelineCard(f, g, pal)); break;
      case "stat": out.push(...statPanel(f, g, pal, i)); break;
      case "callout": out.push(...callout(f, g, pal, i)); break;
    }
  });
  return out;
}

/** How long each kind stays up (seconds); lists and charts get longer with more to show. */
export function durationFor(g: Pick<Graphic, "kind" | "items" | "bars" | "points" | "left" | "right">) {
  switch (g.kind) {
    case "title": return 2.2;
    case "quote": return 3.2;
    case "list": return 2.4 + 0.5 * Math.min(5, g.items?.length ?? 3);
    case "compare": return 3.6 + 0.3 * Math.min(4, Math.max(g.left?.items.length ?? 0, g.right?.items.length ?? 0));
    case "chart": return 3.4 + 0.2 * Math.min(5, g.bars?.length ?? 3);
    case "timeline": return 3.2 + 0.35 * Math.min(5, g.points?.length ?? 3);
    case "stat": return 2.6;
    case "callout": return 1.8;
  }
}
