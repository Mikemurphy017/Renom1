"use client";

import type { Still } from "./frames";
import {
  ANTON,
  MONT,
  crop,
  darken,
  fillRound,
  fit,
  hitsOf,
  inkOn,
  label,
  mix,
  norm,
  photo,
  rgba,
  rrect,
  scaleOf,
  personEdge,
  shotOf,
  scratch,
  setTracking,
  star,
  type CoverInput,
  type CoverTemplate,
  type Fonts,
  type Palette,
  type PhotoOpts,
  type Shot,
  type TextStyle,
} from "./kit";

/**
 * Creator-style covers (the YouTube look): the advisor cut out of their photo
 * with a sticker outline, on a loud background, with huge outlined words and a
 * drawn illustration that hints at the topic. Built for a feed, not an intranet.
 * Layer order, back to front: ground, words, the person, then illustrations
 * and arrows (placed beside the face). Words never cover the person.
 */

const INK = "#0A0A0A";

// ── the person ────────────────────────────────────────────────────────────────

/** Punchier color for a cutout: more contrast and saturation than a normal grade. */
function pop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return;
  }
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    for (let c = 0; c < 3; c++) {
      const v = l + (d[i + c] - l) * 1.18;
      d[i + c] = ((v - 128) * 1.12 + 128) * 1.04;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export interface StickerOpts extends PhotoOpts {
  /** Outline width in px (0: none). */
  ring?: number;
  ringColor?: string;
  /** A colored glow around the outline. */
  glow?: string;
  /** Background for the framed fallback (no cutout). */
  frameColor?: string;
  /** Tilt of the framed fallback, radians. */
  tilt?: number;
}

/**
 * The advisor cut out with a thick outline, as a sticker, in a box (the head
 * kept in the box's safe area like `photo`). The bottom runs off the box's
 * bottom edge. Without a cutout: the photo in a tilted white-bordered frame.
 */
export function sticker(ctx: CanvasRenderingContext2D, s: Still, x: number, y: number, w: number, h: number, o: StickerOpts = {}): Shot {
  if (!s.cut) {
    // Fallback: a framed photo, a little tilted, with a heavy border and shadow.
    const m = Math.min(w, h) * 0.06;
    const fx = x + m;
    const fy = y + m;
    const fw = w - m * 2;
    const fh = h - m * 2;
    const b = Math.max(8, Math.min(fw, fh) * 0.035);
    ctx.save();
    ctx.translate(fx + fw / 2, fy + fh / 2);
    ctx.rotate(o.tilt ?? 0.035);
    ctx.translate(-(fx + fw / 2), -(fy + fh / 2));
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = b * 3;
    ctx.shadowOffsetY = b;
    ctx.fillStyle = o.frameColor ?? "#FFFFFF";
    fillRound(ctx, fx - b, fy - b, fw + b * 2, fh + b * 2, b * 1.6);
    ctx.shadowColor = "transparent";
    const shot = photo(ctx, s, fx, fy, fw, fh, { ...o, clip: (() => { const p = new Path2D(); rrect(p, fx, fy, fw, fh, b); return p; })() });
    ctx.restore();
    return shot;
  }
  const p = crop(s, w, h, o);
  const sc = scaleOf(ctx);
  const ring = (o.ring ?? 0) * sc;
  const pad = Math.ceil(ring + (o.glow ? 30 * sc : 2));
  const W = Math.round(w * sc);
  const H = Math.round(h * sc);
  // The person, at the box's on-screen size.
  const body = scratch(W, H);
  const b = body.getContext("2d", { willReadFrequently: true })!;
  b.imageSmoothingQuality = "high";
  b.drawImage(s.cut, p.sx, p.sy, p.sw, p.sh, 0, Math.round(p.lift * sc), W, H);
  pop(b, W, H);
  // The outline: the silhouette in one color, stamped in a circle around itself.
  const out = scratch(W + pad * 2, H + pad * 2);
  const octx = out.getContext("2d")!;
  if (ring > 0) {
    const sil = scratch(W, H);
    const sctx = sil.getContext("2d")!;
    sctx.drawImage(body, 0, 0);
    sctx.globalCompositeOperation = "source-in";
    sctx.fillStyle = o.ringColor ?? "#FFFFFF";
    sctx.fillRect(0, 0, W, H);
    const n = 24;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      octx.drawImage(sil, pad + Math.cos(a) * ring, pad + Math.sin(a) * ring);
    }
    octx.drawImage(sil, pad, pad);
  }
  octx.drawImage(body, pad, pad);
  ctx.save();
  // Nothing below the box's bottom edge (the person is cut off there).
  ctx.beginPath();
  ctx.rect(x - pad / sc - 4, y - pad / sc - 4, w + (pad * 2) / sc + 8, h + pad / sc + 4);
  ctx.clip();
  ctx.shadowColor = o.glow ?? "rgba(0,0,0,.45)";
  ctx.shadowBlur = (o.glow ? 60 : 36) * 1;
  ctx.shadowOffsetY = o.glow ? 0 : 12;
  ctx.drawImage(out, x - pad / sc, y - pad / sc, (W + pad * 2) / sc, (H + pad * 2) / sc);
  ctx.restore();
  const shift = (bx: { x: number; y: number; w: number; h: number }) => ({ ...bx, x: bx.x + x, y: bx.y + y + p.lift });
  return { face: shift(p.face), head: shift(p.head) };
}

// ── backgrounds ───────────────────────────────────────────────────────────────

/** A loud ground: the color, a light burst behind the person, rays and a dark vignette. */
export function burstGround(ctx: CanvasRenderingContext2D, W: number, H: number, base: string, cx: number, cy: number, o: { rays?: boolean; dots?: boolean; glow?: string } = {}) {
  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const far = Math.hypot(W, H);
  if (o.rays !== false) {
    ctx.fillStyle = rgba(mix(base, "#FFFFFF", 0.5), 0.16);
    const n = 28;
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
  }
  if (o.dots) {
    const u = Math.min(W, H) / 40;
    ctx.fillStyle = rgba(darken(base, 0.5), 0.18);
    for (let yy = u / 2; yy < H; yy += u) for (let xx = (yy / u) % 2 ? u / 2 : 0; xx < W; xx += u) {
      ctx.beginPath();
      ctx.arc(xx, yy, u * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.5);
  glow.addColorStop(0, rgba(o.glow ?? mix(base, "#FFFFFF", 0.55), 0.75));
  glow.addColorStop(1, rgba(o.glow ?? base, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, far * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── words ─────────────────────────────────────────────────────────────────────

export interface PunchOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  lines?: number;
  max: number;
  align?: "left" | "center";
  anchor?: "top" | "middle" | "bottom";
  /** Line colors, in turn (accent words use `accent`). */
  fills: string[];
  accent: string;
  hits: Set<string>;
  stroke?: string;
  /** Stroke width as a share of the type size. */
  strokeW?: number;
  /** Each line on its own tilted block instead of outlined. */
  blocks?: { bg: string[]; fg: string };
  tilt?: number;
  /** Measure only. */
  dry?: boolean;
}

/**
 * Thumbnail words: each line set as wide as the column (short lines get
 * huge), a thick dark outline and a hard shadow, alternating colors. Returns
 * the block's extent.
 */
export function punch(ctx: CanvasRenderingContext2D, text: string, st: TextStyle, o: PunchOpts) {
  const lines = fit(ctx, text, st, { w: o.w, h: o.h, lines: o.lines ?? 3, max: o.max, min: 24 }, o.hits).lines;
  const lh = (st.lineHeight ?? 1) * (o.blocks ? 1.18 : 1.02);
  const widthAt = (line: string[], size: number) => {
    ctx.font = st.font(size);
    setTracking(ctx, (st.tracking ?? 0) * size);
    return ctx.measureText(line.map((w) => (st.upper ? w.toUpperCase() : w)).join(" ")).width;
  };
  const room = o.w * (o.blocks ? 0.88 : 1);
  let sizes = lines.map((l) => Math.min(o.max, (room * 100) / Math.max(1, widthAt(l, 100))));
  const big = Math.max(...sizes);
  // Little words ("THE", "IN") stay smaller than the line they belong to.
  sizes = sizes.map((z, i) => (lines.length > 1 && lines[i].join("").length <= 3 ? Math.min(z, big * 0.55) : z));
  const total = sizes.reduce((a, z) => a + z * lh, 0);
  const k = total > o.h ? o.h / total : 1;
  sizes = sizes.map((z) => z * k);
  const blockH = total * k;
  const top = o.anchor === "bottom" ? o.y - blockH : o.anchor === "middle" ? o.y - blockH / 2 : o.y;
  const widest = Math.max(...lines.map((l, i) => widthAt(l, sizes[i])));
  if (o.dry) return { top, bottom: top + blockH, width: widest, size: Math.max(...sizes) };
  const cx = o.align === "center" ? o.x : o.x + widest / 2;
  ctx.save();
  if (o.tilt) {
    ctx.translate(cx, top + blockH / 2);
    ctx.rotate(o.tilt);
    ctx.translate(-cx, -(top + blockH / 2));
  }
  let yy = top;
  lines.forEach((line, n) => {
    const size = sizes[n];
    const words = line.map((w) => (st.upper ? w.toUpperCase() : w));
    ctx.font = st.font(size);
    setTracking(ctx, (st.tracking ?? 0) * size);
    const space = ctx.measureText(" ").width;
    const widths = words.map((w) => ctx.measureText(w).width);
    const lineW = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    const capH = ctx.measureText("H").actualBoundingBoxAscent || size * 0.72;
    const base = yy + (size * lh + capH) / 2;
    let xx = o.align === "center" ? o.x - lineW / 2 : o.x;
    if (o.blocks) {
      const px = size * 0.18;
      const py = size * 0.14;
      ctx.save();
      const bx = xx - px;
      const by = base - capH - py;
      const tw = lineW + px * 2;
      const th = capH + py * 2;
      ctx.translate(bx + tw / 2, by + th / 2);
      ctx.rotate(n % 2 ? 0.018 : -0.022);
      ctx.translate(-(bx + tw / 2), -(by + th / 2));
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(bx + size * 0.06, by + size * 0.07, tw, th);
      ctx.fillStyle = o.blocks.bg[n % o.blocks.bg.length];
      ctx.fillRect(bx, by, tw, th);
      ctx.restore();
    }
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.lineJoin = "round";
    words.forEach((w, i) => {
      const hit = o.hits.has(norm(w));
      const fill = o.blocks ? (hit ? o.accent : o.blocks.fg) : hit ? o.accent : o.fills[n % o.fills.length];
      if (!o.blocks) {
        const sw = size * (o.strokeW ?? 0.09);
        // Hard shadow, then the outline, then the letters.
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.strokeStyle = "rgba(0,0,0,.6)";
        ctx.lineWidth = sw * 2;
        ctx.strokeText(w, xx + size * 0.045, base + size * 0.055);
        ctx.strokeStyle = o.stroke ?? INK;
        ctx.strokeText(w, xx, base);
      }
      ctx.fillStyle = fill;
      ctx.fillText(w, xx, base);
      xx += widths[i] + space;
    });
    yy += size * lh;
  });
  ctx.restore();
  return { top, bottom: top + blockH, width: widest, size: Math.max(...sizes) };
}

/** A small name tag, so the cover still says who it is. */
export function nameTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, f: Fonts, align: "left" | "center" | "right" = "left") {
  const t = text.trim();
  if (!t) return;
  ctx.save();
  ctx.font = `800 ${size}px ${f.mont}`;
  setTracking(ctx, 0.01 * size);
  const w = ctx.measureText(t).width + size * 1.1;
  const h = size * 1.75;
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = bg;
  fillRound(ctx, left, y, w, h, h / 2);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = inkOn(bg);
  ctx.textBaseline = "middle";
  ctx.fillText(t, left + size * 0.55, y + h / 2 + size * 0.04);
  ctx.restore();
}

// ── illustrations ─────────────────────────────────────────────────────────────

export type IconKind = "down" | "up" | "money" | "warning" | "house" | "clock" | "piggy" | "shield" | "percent" | "question" | "no" | "yes";

const KEYWORDS: [RegExp, IconKind][] = [
  [/\?\s*$/, "question"],
  [/\b(crash|drop|down|loss|lose|losing|lost|fall|bear|decline|cut|shrink)\w*/i, "down"],
  [/\b(mistake|wrong|avoid|never|stop|don'?t|skip|trap|myth)\w*/i, "no"],
  [/\b(risk|warning|danger|careful|penalt|audit|scam|fraud|irmaa)\w*/i, "warning"],
  [/\b(tax|irs|roth|ira|401|deduct|bracket|capital gains?)\w*/i, "percent"],
  [/\b(home|house|mortgage|real estate|rent|property)\w*/i, "house"],
  [/\b(retire|age|year|time|when|early|late|deadline|before|after|now|wait|window)\w*/i, "clock"],
  [/\b(save|saving|savings|emergency|budget|college|529)\w*/i, "piggy"],
  [/\b(insur|protect|estate|trust|will|annuit|safe)\w*/i, "shield"],
  [/\b(grow|growth|up|gain|rich|million|wealth|compound|invest|return|bull)\w*/i, "up"],
  [/[$€£]|\b(money|cash|income|salary|pay|cost|fee|price|dollar)\w*/i, "money"],
];

/** An illustration that fits the words (the stake, not decoration). */
export function iconFor(i: { headline: string; kicker?: string }): IconKind {
  const t = `${i.headline} ${i.kicker ?? ""}`;
  for (const [re, k] of KEYWORDS) if (re.test(t)) return k;
  return "money";
}

/** Draw a path as a sticker part: white halo, dark outline, then the fill. */
function part(ctx: CanvasRenderingContext2D, p: Path2D, fill: string, s: number, halo = true) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (halo) {
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = s * 0.16;
    ctx.stroke(p);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.07;
  ctx.stroke(p);
  ctx.fillStyle = fill;
  ctx.fill(p);
}

function glyph(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, color: string, f: Fonts) {
  ctx.save();
  ctx.font = `900 ${size}px ${f.mont}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = INK;
  ctx.strokeText(t, x, y);
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
  ctx.restore();
}

/** A trend arrow (zig-zag line with a head), up and green or down and red. */
function trendPath(s: number, up: boolean) {
  const pts: [number, number][] = up
    ? [[-0.5, 0.35], [-0.18, 0.02], [0.02, 0.18], [0.36, -0.22]]
    : [[-0.5, -0.35], [-0.18, -0.02], [0.02, -0.18], [0.36, 0.22]];
  const p = new Path2D();
  const w = s * 0.12;
  // A thick polyline as an outline path: stroke a centre line onto a scratch path.
  const line = new Path2D();
  line.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (const [x, y] of pts.slice(1)) line.lineTo(x * s, y * s);
  const [ex, ey] = pts[pts.length - 1];
  const [px, py] = pts[pts.length - 2];
  const a = Math.atan2(ey - py, ex - px);
  const head = new Path2D();
  const hx = ex * s + Math.cos(a) * s * 0.12;
  const hy = ey * s + Math.sin(a) * s * 0.12;
  head.moveTo(hx, hy);
  head.lineTo(hx - Math.cos(a - 0.6) * s * 0.3, hy - Math.sin(a - 0.6) * s * 0.3);
  head.lineTo(hx - Math.cos(a + 0.6) * s * 0.3, hy - Math.sin(a + 0.6) * s * 0.3);
  head.closePath();
  return { line, head, w, p };
}

/** One illustration, centred on (cx, cy), about `s` across. */
export function icon(ctx: CanvasRenderingContext2D, kind: IconKind, cx: number, cy: number, s: number, f: Fonts, turn = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = s * 0.12;
  ctx.shadowOffsetY = s * 0.04;
  const circleP = (r: number, x = 0, y = 0) => {
    const p = new Path2D();
    p.arc(x, y, r, 0, Math.PI * 2);
    return p;
  };
  switch (kind) {
    case "up":
    case "down": {
      const up = kind === "up";
      const { line, head } = trendPath(s, up);
      const color = up ? "#1FCB5A" : "#FF2B2B";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const [c, w] of [["#FFFFFF", 0.3], [INK, 0.22], [color, 0.13]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = s * w;
        ctx.stroke(line);
        if (c === color) ctx.shadowColor = "transparent";
      }
      part(ctx, head, color, s * 0.9);
      break;
    }
    case "money": {
      // A stack of coins and a bill.
      const bill = new Path2D();
      rrect(bill, -s * 0.5, -s * 0.3, s * 0.78, s * 0.42, s * 0.05);
      ctx.save();
      ctx.rotate(-0.25);
      part(ctx, bill, "#3CC46B", s);
      ctx.shadowColor = "transparent";
      glyph(ctx, "$", -s * 0.11, -s * 0.09, s * 0.3, "#E9FFE9", f);
      ctx.restore();
      for (let k = 0; k < 3; k++) {
        const c = new Path2D();
        c.ellipse(s * 0.18, s * (0.34 - k * 0.12), s * 0.3, s * 0.1, 0, 0, Math.PI * 2);
        part(ctx, c, k === 2 ? "#FFD23F" : "#F2B705", s * 0.8, k === 0);
      }
      glyph(ctx, "$", s * 0.18, s * 0.1, s * 0.16, "#7A5200", f);
      break;
    }
    case "warning": {
      const t = new Path2D();
      t.moveTo(0, -s * 0.48);
      t.lineTo(s * 0.5, s * 0.4);
      t.lineTo(-s * 0.5, s * 0.4);
      t.closePath();
      part(ctx, t, "#FFD023", s);
      ctx.shadowColor = "transparent";
      glyph(ctx, "!", 0, s * 0.08, s * 0.5, INK, f);
      break;
    }
    case "house": {
      const body = new Path2D();
      body.rect(-s * 0.34, -s * 0.02, s * 0.68, s * 0.46);
      part(ctx, body, "#FFFFFF", s);
      const roof = new Path2D();
      roof.moveTo(-s * 0.5, s * 0.02);
      roof.lineTo(0, -s * 0.45);
      roof.lineTo(s * 0.5, s * 0.02);
      roof.closePath();
      part(ctx, roof, "#FF3B3B", s);
      const door = new Path2D();
      door.rect(-s * 0.09, s * 0.16, s * 0.18, s * 0.28);
      part(ctx, door, "#3B6BFF", s * 0.6, false);
      break;
    }
    case "clock": {
      part(ctx, circleP(s * 0.46), "#FFFFFF", s);
      ctx.shadowColor = "transparent";
      const ring = circleP(s * 0.46);
      ctx.strokeStyle = "#FF3B3B";
      ctx.lineWidth = s * 0.07;
      ctx.stroke(ring);
      ctx.strokeStyle = INK;
      ctx.lineCap = "round";
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.28);
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.2, s * 0.1);
      ctx.stroke();
      break;
    }
    case "piggy": {
      const body = new Path2D();
      body.ellipse(0, s * 0.04, s * 0.46, s * 0.34, 0, 0, Math.PI * 2);
      part(ctx, body, "#FF8FB1", s);
      ctx.shadowColor = "transparent";
      part(ctx, circleP(s * 0.11, s * 0.42, s * 0.06), "#FF6F99", s * 0.6, false);
      const ear = new Path2D();
      ear.moveTo(-s * 0.06, -s * 0.24);
      ear.lineTo(s * 0.06, -s * 0.44);
      ear.lineTo(s * 0.16, -s * 0.22);
      ear.closePath();
      part(ctx, ear, "#FF8FB1", s * 0.6, false);
      ctx.fillStyle = INK;
      ctx.fill(circleP(s * 0.035, s * 0.22, -s * 0.06));
      const coin = new Path2D();
      coin.ellipse(-s * 0.05, -s * 0.5, s * 0.16, s * 0.16, 0, 0, Math.PI * 2);
      part(ctx, coin, "#FFD23F", s * 0.6);
      break;
    }
    case "shield": {
      const sh = new Path2D();
      sh.moveTo(0, -s * 0.48);
      sh.quadraticCurveTo(s * 0.26, -s * 0.36, s * 0.42, -s * 0.36);
      sh.quadraticCurveTo(s * 0.44, s * 0.22, 0, s * 0.5);
      sh.quadraticCurveTo(-s * 0.44, s * 0.22, -s * 0.42, -s * 0.36);
      sh.quadraticCurveTo(-s * 0.26, -s * 0.36, 0, -s * 0.48);
      part(ctx, sh, "#2F6BFF", s);
      ctx.shadowColor = "transparent";
      glyph(ctx, "✓", 0, s * 0.02, s * 0.46, "#FFFFFF", f);
      break;
    }
    case "percent":
    case "question":
    case "no":
    case "yes": {
      const bg = kind === "percent" ? "#FF3B3B" : kind === "question" ? "#FFD023" : kind === "no" ? "#FF2B2B" : "#1FCB5A";
      part(ctx, circleP(s * 0.46), bg, s);
      ctx.shadowColor = "transparent";
      if (kind === "no" || kind === "yes") {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = s * 0.12;
        ctx.beginPath();
        if (kind === "no") {
          ctx.moveTo(-s * 0.18, -s * 0.18);
          ctx.lineTo(s * 0.18, s * 0.18);
          ctx.moveTo(s * 0.18, -s * 0.18);
          ctx.lineTo(-s * 0.18, s * 0.18);
        } else {
          ctx.moveTo(-s * 0.2, 0);
          ctx.lineTo(-s * 0.05, s * 0.16);
          ctx.lineTo(s * 0.22, -s * 0.16);
        }
        ctx.stroke();
      } else glyph(ctx, kind === "percent" ? "%" : "?", 0, s * 0.03, s * 0.56, kind === "percent" ? "#FFFFFF" : INK, f);
      break;
    }
  }
  ctx.restore();
}

/** A thick hand-drawn arrow from (x0, y0) to (x1, y1), bending to one side. */
export function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width: number, bend = 0.25) {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  const a = Math.atan2(y1 - cy, x1 - cx);
  const hl = width * 3.2;
  const ex = x1 - Math.cos(a) * hl * 0.6;
  const ey = y1 - Math.sin(a) * hl * 0.6;
  const shaft = new Path2D();
  shaft.moveTo(x0, y0);
  shaft.quadraticCurveTo(cx, cy, ex, ey);
  const head = new Path2D();
  head.moveTo(x1, y1);
  head.lineTo(x1 - Math.cos(a - 0.5) * hl, y1 - Math.sin(a - 0.5) * hl);
  head.lineTo(x1 - Math.cos(a + 0.5) * hl, y1 - Math.sin(a + 0.5) * hl);
  head.closePath();
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = width;
  for (const [c, w] of [[INK, width * 1.9], [color, width]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.stroke(shaft);
    ctx.fillStyle = c;
    if (c === INK) {
      ctx.lineWidth = width * 0.9;
      ctx.stroke(head);
    }
    ctx.fill(head);
    ctx.shadowColor = "transparent";
  }
  ctx.restore();
}

/** A loose double circle, like it was drawn on with a marker. */
export function scribble(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0,0,0,.3)";
  ctx.shadowBlur = width;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, -0.12, 0.2, Math.PI * 2 + 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + width * 0.4, cy - width * 0.3, rx * 1.04, ry * 0.97, -0.05, -0.4, Math.PI * 1.3);
  ctx.stroke();
  ctx.restore();
}

/** A burst with a few words or a number on it. */
export function burst(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, bg: string, fg: string, f: Fonts, turn = -0.16) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  const p = star(0, 0, r * 0.8, r, 14);
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = r * 0.2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = r * 0.12;
  ctx.stroke(p);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.06;
  ctx.stroke(p);
  ctx.fillStyle = bg;
  ctx.fill(p);
  const st: TextStyle = { font: (z) => `900 ${z}px ${f.mont}`, upper: true, lineHeight: 0.95 };
  const fitted = fit(ctx, text, st, { w: r * 1.2, h: r * 0.95, lines: 2, max: r * 0.62, min: r * 0.18 });
  ctx.font = st.font(fitted.size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lh = fitted.size * 0.95;
  fitted.lines.forEach((line, n) => {
    const y = (n - (fitted.lines.length - 1) / 2) * lh + fitted.size * 0.05;
    ctx.fillStyle = fg;
    ctx.fillText(line.join(" ").toUpperCase(), 0, y);
  });
  ctx.restore();
}

/** Where a sticker of radius r can sit next to the head without covering it: the preferred side if there's room, else the other. */
function besideHead(shot: Shot, r: number, W: number, H: number, prefer: "left" | "right", minY = 0) {
  const h = shot.head;
  const right = h.x + h.w + r * 0.95;
  const left = h.x - r * 0.95;
  const fitsR = right + r * 0.8 <= W;
  const fitsL = left - r * 0.8 >= 0;
  const x = (prefer === "right" ? fitsR || !fitsL : !fitsL && fitsR) ? Math.min(right, W - r * 0.85) : Math.max(left, r * 0.85);
  const y = Math.min(H - r, Math.max(minY + r * 0.6, h.y + r * 0.4));
  return { x, y };
}

/**
 * How wide words starting at x (from y0 to y1) can be and still stop short of
 * the person, who is drawn in front of them: their actual outline when cut
 * out, else the head.
 */
function roomLeftOf(s: Still, box: [number, number, number, number], o: StickerOpts, x: number, y0: number, y1: number, W: number, max = 0.55) {
  const edge = personEdge(s, ...box, o, y0, y1, "left") ?? shotOf(s, ...box, o).head.x;
  return Math.max(W * 0.26, Math.min(W * max, edge - 28 - x));
}

/** What goes on a burst: a short shout that fits the words (never a repeat of them). */
function burstText(i: CoverInput) {
  const k = iconFor(i);
  return k === "question" ? "?!" : k === "no" || k === "warning" || k === "down" ? "STOP!" : k === "up" ? "WOW!" : k === "clock" ? "WAIT!" : "!";
}

/** The two loudest colors that read on this ground. */
const fillsOn = (p: Palette, base: string) => {
  const second = Math.abs(lumOf(p.accent) - lumOf(base)) > 0.25 ? p.accent : "#FFE14D";
  return ["#FFFFFF", second];
};
function lumOf(c: string) {
  const v = c.replace("#", "");
  const n = parseInt(v.length === 3 ? v.split("").map((x) => x + x).join("") : v, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
/** The accent word's color: red on light grounds, the palette's loud color otherwise. */
const accentOn = (p: Palette, base: string, fills: string[]) => (fills[1] === p.accent ? (lumOf(p.mark) < 0.3 || p.mark === INK ? "#FF2E2E" : p.mark) : p.accent);

// ── layouts ───────────────────────────────────────────────────────────────────

const CREATOR_PALETTES = ["pop", "hot", "electric", "night", "grape", "money", "signal"];

export const CREATOR_LONG: CoverTemplate[] = [
  {
    id: "c-react",
    label: "Reaction",
    shape: "long",
    look: "Creator",
    palettes: ["electric", "hot", "grape", "pop", "money"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      burstGround(ctx, W, H, p.bg, W * 0.72, H * 0.42);
      const fills = fillsOn(p, p.bg);
      const so: StickerOpts = { bias: { x: 0.55, y: 0.36 }, face: 0.4, ring: 10, safe: { top: 24, left: 40, right: 20 } };
      const t = punch(ctx, i.headline, ANTON(f), { x: 44, y: 44, w: roomLeftOf(i.still, [W * 0.42, 24, W * 0.58, H - 24], so, 44, 44, 44 + H * 0.6, W), h: H * 0.6, lines: 3, max: 250, fills, accent: accentOn(p, p.bg, fills), hits });
      const shot = sticker(ctx, i.still, W * 0.42, 24, W * 0.58, H - 24, so);
      const kind = iconFor(i);
      const ix = 44 + 75;
      const iy = Math.min(H - 85, t.bottom + 95);
      icon(ctx, kind, ix, iy, 140, f, -0.12);
      // At the face, or at the shoulder when the face is up beside the words.
      const tx = shot.face.x - shot.face.w * 0.85;
      const ty = Math.max(shot.face.y + shot.face.h * 0.3, t.bottom + 40);
      if (tx > ix + 160) arrow(ctx, ix + 90, iy + 10, tx, ty, "#FF2E2E", 12, 0.22);
    },
  },
  {
    id: "c-blocks",
    label: "Blocks",
    shape: "long",
    look: "Creator",
    palettes: ["pop", "electric", "hot", "money", "grape"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      burstGround(ctx, W, H, p.bg, W * 0.74, H * 0.5, { rays: false, dots: true });
      const so: StickerOpts = { bias: { x: 0.5, y: 0.36 }, face: 0.4, ring: 12, safe: { top: 30, left: 20, right: 20 } };
      punch(ctx, i.headline, MONT(f), { x: 56, y: H * 0.5, w: roomLeftOf(i.still, [W * 0.44, 20, W * 0.56, H - 20], so, 56, 70, H - 70, W, 0.5), h: H - 140, lines: 3, max: 150, anchor: "middle", fills: [], accent: "#FF2E2E", hits, blocks: { bg: ["#FFFFFF", "#FFE14D"], fg: INK } });
      const shot = sticker(ctx, i.still, W * 0.44, 20, W * 0.56, H - 20, so);
      const kind = iconFor(i);
      const ix = Math.min(W - 115, shot.face.x + shot.face.w * 1.25);
      const iy = Math.max(115, shot.face.y - shot.face.h * 0.55);
      icon(ctx, kind, ix, iy, 120, f, 0.14);
      scribble(ctx, ix, iy, 92, 86, "#FF2E2E", 9);
    },
  },
  {
    id: "c-glow",
    label: "Glow",
    shape: "long",
    look: "Creator",
    palettes: ["night", "grape", "electric", "signal"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      const base = mix(p.bg, "#000000", 0.55);
      burstGround(ctx, W, H, base, W * 0.7, H * 0.5, { rays: false, glow: p.accent });
      const so: StickerOpts = { bias: { x: 0.55, y: 0.36 }, face: 0.4, ring: 8, ringColor: p.accent, glow: p.accent, safe: { top: 24, left: 40 } };
      const t = punch(ctx, i.headline, ANTON(f), { x: 48, y: H * 0.5, w: roomLeftOf(i.still, [W * 0.4, 24, W * 0.6, H - 24], so, 48, 80, H - 80, W), h: H - 160, lines: 3, max: 250, anchor: "middle", fills: ["#FFFFFF"], accent: p.accent, hits, strokeW: 0.07 });
      sticker(ctx, i.still, W * 0.4, 24, W * 0.6, H - 24, so);
      ctx.fillStyle = p.accent;
      ctx.shadowColor = p.accent;
      ctx.shadowBlur = 24;
      fillRound(ctx, 48, t.bottom + 18, Math.min(t.width, 260), 12, 6);
      ctx.shadowColor = "transparent";
      if (i.byline.trim()) label(ctx, i.byline, 48, t.bottom + 64, { size: 22, font: (z) => `800 ${z}px ${f.mont}`, color: rgba("#FFFFFF", 0.85), tracking: 0.04, upper: true, maxW: W * 0.45 });
    },
  },
  {
    id: "c-shock",
    label: "Shock",
    shape: "long",
    look: "Creator",
    palettes: ["hot", "pop", "electric", "money"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      burstGround(ctx, W, H, p.bg, W * 0.28, H * 0.45);
      const fills = fillsOn(p, p.bg);
      const so: StickerOpts = { bias: { x: 0.45, y: 0.36 }, face: 0.42, ring: 10, safe: { top: 24, left: 20, right: 40 } };
      const head = shotOf(i.still, 0, 24, W * 0.56, H - 24, so).head;
      const edge = personEdge(i.still, 0, 24, W * 0.56, H - 24, so, 115, H - 115, "right") ?? head.x + head.w;
      const tx = Math.min(W * 0.66, Math.max(W * 0.5, edge + 30));
      punch(ctx, i.headline, ANTON(f), { x: tx, y: H * 0.56, w: W - 44 - tx, h: H - 230, lines: 3, max: 230, anchor: "middle", fills, accent: accentOn(p, p.bg, fills), hits, tilt: -0.04 });
      const shot = sticker(ctx, i.still, 0, 24, W * 0.56, H - 24, so);
      const b = besideHead(shot, 88, W, H, "right");
      burst(ctx, burstText(i), b.x, b.y, 88, "#FFE14D", INK, f);
    },
  },
  {
    id: "c-split",
    label: "Big icon",
    shape: "long",
    look: "Creator",
    palettes: ["money", "electric", "hot", "grape", "pop"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      // Two-tone diagonal ground.
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = darken(p.bg, 0.35);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 0.5, 0);
      ctx.lineTo(W * 0.38, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      const g = ctx.createRadialGradient(W * 0.2, H * 0.62, 0, W * 0.2, H * 0.62, W * 0.35);
      g.addColorStop(0, rgba(mix(p.bg, "#FFFFFF", 0.45), 0.7));
      g.addColorStop(1, rgba(p.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const fills = fillsOn(p, p.bg);
      const t = punch(ctx, i.headline, ANTON(f), { x: W / 2, y: 22, w: W - 90, h: 210, lines: 2, max: 170, align: "center", fills, accent: accentOn(p, p.bg, fills), hits });
      const top = t.bottom + 10;
      const shot = sticker(ctx, i.still, W * 0.42, top, W * 0.58, H - top, { bias: { x: 0.5, y: 0.35 }, face: 0.46, ring: 10, safe: { top: 10 } });
      const kind = iconFor(i);
      const iy = Math.max(top + 130, H * 0.62);
      icon(ctx, kind, W * 0.2, iy, 240, f, -0.08);
      arrow(ctx, W * 0.32, iy - 40, shot.face.x - shot.face.w * 0.7, shot.face.y + shot.face.h * 0.3, "#FFFFFF", 12, -0.25);
    },
  },
];

export const CREATOR_SHORT: CoverTemplate[] = [
  {
    id: "c-react",
    label: "Reaction",
    shape: "short",
    look: "Creator",
    palettes: ["electric", "hot", "grape", "pop", "money"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      burstGround(ctx, W, H, p.bg, W / 2, H * 0.68);
      const fills = fillsOn(p, p.bg);
      const t = punch(ctx, i.headline, ANTON(f), { x: W / 2, y: 150, w: W - 120, h: H * 0.34, lines: 4, max: 330, align: "center", fills, accent: accentOn(p, p.bg, fills), hits });
      const top = Math.max(t.bottom + 30, H * 0.4);
      const shot = sticker(ctx, i.still, 0, top, W, H - top, { bias: { x: 0.5, y: 0.32 }, face: 0.3, ring: 16, safe: { top: 30, left: 60, right: 60 } });
      const kind = iconFor(i);
      const ix = W * 0.17;
      const iy = Math.min(H - 300, shot.face.y + shot.face.h * 0.2);
      icon(ctx, kind, ix, iy, 200, f, -0.14);
      if (shot.face.x - shot.face.w * 0.8 > ix + 170) arrow(ctx, ix + 115, iy - 30, shot.face.x - shot.face.w * 0.8, shot.face.y - shot.face.h * 0.1, "#FF2E2E", 18, -0.3);
      nameTag(ctx, i.byline, W / 2, 60, 30, "#FFFFFF", f, "center");
    },
  },
  {
    id: "c-blocks",
    label: "Blocks",
    shape: "short",
    look: "Creator",
    palettes: ["pop", "electric", "hot", "money", "grape"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      burstGround(ctx, W, H, p.bg, W / 2, H * 0.72, { rays: false, dots: true });
      const t = punch(ctx, i.headline, MONT(f), { x: W / 2, y: 190, w: W - 140, h: H * 0.32, lines: 4, max: 170, align: "center", fills: [], accent: "#FF2E2E", hits, blocks: { bg: ["#FFFFFF", "#FFE14D"], fg: INK } });
      const top = Math.max(t.bottom + 60, H * 0.42);
      const shot = sticker(ctx, i.still, 0, top, W, H - top, { bias: { x: 0.5, y: 0.3 }, face: 0.3, ring: 18, safe: { top: 40, left: 60, right: 60 } });
      const kind = iconFor(i);
      const ix = Math.min(W - 150, shot.face.x + shot.face.w * 1.3);
      const iy = Math.max(top + 90, shot.face.y - shot.face.h * 0.4);
      icon(ctx, kind, ix, iy, 180, f, 0.14);
      scribble(ctx, ix, iy, 135, 128, "#FF2E2E", 13);
      nameTag(ctx, i.byline, W / 2, 60, 30, INK, f, "center");
    },
  },
  {
    id: "c-glow",
    label: "Glow",
    shape: "short",
    look: "Creator",
    palettes: ["night", "grape", "electric", "signal"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      const base = mix(p.bg, "#000000", 0.55);
      burstGround(ctx, W, H, base, W / 2, H * 0.66, { rays: false, glow: p.accent });
      const t = punch(ctx, i.headline, ANTON(f), { x: W / 2, y: 160, w: W - 120, h: H * 0.33, lines: 4, max: 320, align: "center", fills: ["#FFFFFF"], accent: p.accent, hits, strokeW: 0.07 });
      const top = Math.max(t.bottom + 50, H * 0.4);
      sticker(ctx, i.still, 0, top, W, H - top, { bias: { x: 0.5, y: 0.32 }, face: 0.3, ring: 12, ringColor: p.accent, glow: p.accent, safe: { top: 30 } });
      nameTag(ctx, i.byline, W / 2, 60, 30, p.accent, f, "center");
    },
  },
  {
    id: "c-shock",
    label: "Shock",
    shape: "short",
    look: "Creator",
    palettes: ["hot", "pop", "electric", "money"],
    draw(ctx, W, H, i, f, p) {
      const hits = hitsOf(i);
      burstGround(ctx, W, H, p.bg, W / 2, H * 0.62);
      const fills = fillsOn(p, p.bg);
      const t = punch(ctx, i.headline, ANTON(f), { x: W / 2, y: 170, w: W - 130, h: H * 0.3, lines: 4, max: 320, align: "center", fills, accent: accentOn(p, p.bg, fills), hits, tilt: -0.045 });
      const top = Math.max(t.bottom + 70, H * 0.42);
      const shot = sticker(ctx, i.still, 0, top, W, H - top, { bias: { x: 0.5, y: 0.3 }, face: 0.32, ring: 16, safe: { top: 40, left: 60, right: 60 } });
      const b = besideHead(shot, 150, W, H, "right", top);
      burst(ctx, burstText(i), b.x, b.y, 150, "#FFE14D", INK, f);
      nameTag(ctx, i.byline, W / 2, 60, 30, "#FFFFFF", f, "center");
    },
  },
];

/** The loud palettes the creator layouts are made for. */
export const isCreatorPalette = (id?: string) => !!id && CREATOR_PALETTES.includes(id);
