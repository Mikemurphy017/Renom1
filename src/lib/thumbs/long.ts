"use client";

import {
  ANTON,
  BEBAS,
  CLEAN,
  HEAVY,
  MONT,
  MONT_ITALIC,
  PLAYFAIR,
  SERIF,
  arch,
  badge,
  bigLines,
  bigPill,
  blockHeight,
  byline,
  checkbox,
  circle,
  darken,
  drawLines,
  faceSide,
  fillRound,
  fit,
  ground,
  heroOf,
  hitsOf,
  inkOn,
  kicker,
  label,
  linear,
  mix,
  monogram,
  orbit,
  photo,
  pill,
  pillSplit,
  poly,
  readable,
  rgba,
  rounded,
  setTracking,
  shortPoint,
  splitByline,
  stack,
  star,
  tape,
  type CoverInput,
  type CoverTemplate,
  type PhotoOpts,
  type Shot,
  type TextStyle,
} from "./kit";

/** Width of the "Watch" label on the offset frame's tab. */
function watchW(ctx: CanvasRenderingContext2D, f: { mont: string }, size: number) {
  ctx.save();
  ctx.font = `900 ${size}px ${f.mont}`;
  setTracking(ctx, 0.08 * size);
  const w = ctx.measureText("WATCH").width;
  ctx.restore();
  return w;
}

/** Outer margin shared by every long layout. */
const M = 64;

/**
 * Full-bleed photo with the words down one side: the face goes right (or left,
 * when the speaker sits far left in the frame) and the words get the column
 * beside it, never over the head.
 */
function sided(ctx: CanvasRenderingContext2D, i: CoverInput, W: number, H: number, o: PhotoOpts & { bias: { x: number; y: number } }, prefer: "left" | "right" = "right") {
  const faceRight = faceSide(i.still, W, H, o, prefer) === "right";
  const bx = Math.max(o.bias.x, 1 - o.bias.x);
  const shot = photo(ctx, i.still, 0, 0, W, H, { ...o, bias: { x: faceRight ? bx : 1 - bx, y: o.bias.y } });
  return { faceRight, shot, ...column(W, shot, faceRight) };
}

/** The words' column beside a face: from the margin to just short of the head. */
function column(W: number, shot: Shot, faceRight: boolean, gap = 40, max = 0.56, min = 0.4) {
  const room = faceRight ? shot.head.x - gap - M : W - M - (shot.head.x + shot.head.w) - gap;
  const colW = Math.round(Math.max(W * min, Math.min(W * max, room)));
  return { colW, x: faceRight ? M : W - M - colW };
}

/** A dark wash from the words' side toward the face. */
function scrim(ctx: CanvasRenderingContext2D, W: number, H: number, faceRight: boolean, stops: [number, string][], reach = 0.8) {
  ctx.fillStyle = faceRight ? linear(ctx, 0, 0, W * reach, 0, stops) : linear(ctx, W, 0, W * (1 - reach), 0, stops);
  ctx.fillRect(0, 0, W, H);
}

/** 1280×720: YouTube and LinkedIn. Read small, next to a face, in a grid of other thumbnails. */
export const LONG: CoverTemplate[] = [
  // ── Framed: the frame once, with graphics around it ──
  {
    id: "arch",
    label: "Arch",
    shape: "long",
    look: "Framed",
    palettes: ["classic", "forest", "plum", "coral"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      const aw = 400;
      const ax = W - M - aw - 20;
      const ay = 70;
      ground(ctx, W, H, p, "plain", { base: p.paper, cx: ax + aw / 2, cy: H * 0.55 });
      ctx.fillStyle = p.accent;
      ctx.fill(circle(ax + aw - 6, ay + 64, 108));
      ctx.strokeStyle = rgba(p.ink, 0.85);
      ctx.lineWidth = 3.5;
      ctx.stroke(arch(ax - 22, ay - 22, aw + 44, H));
      photo(ctx, i.still, ax, ay, aw, H - ay, { bias: { x: 0.5, y: 0.42 }, face: 0.36, safe: { top: aw * 0.2, left: 36, right: 36 }, clip: arch(ax, ay, aw, H - ay) });
      ctx.fillStyle = mark;
      ctx.fill(star(ax - 46, ay + 230, 6, 26, 4));
      ctx.fill(star(ax - 20, ay + 300, 4, 15, 4));
      stack(ctx, i, f, { st: SERIF(f), x: 72, w: ax - 72 - 90, top: 56, bottom: H - 56, lines: 4, max: 100, min: 40, color: p.ink, accent: mark, kick: mark, by: rgba(p.ink, 0.7), kSize: 18, bSize: 21 });
    },
  },
  {
    id: "orbit",
    label: "Orbit",
    shape: "long",
    look: "Framed",
    palettes: ["classic", "teal", "cobalt", "plum"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      const r = H * 0.36;
      const cx = W * 0.74;
      const cy = H * 0.5;
      ground(ctx, W, H, p, "rings", { cx, cy });
      ctx.fillStyle = p.accent;
      ctx.fill(circle(cx + 26, cy + 22, r));
      photo(ctx, i.still, cx - r, cy - r, r * 2, r * 2, { bias: { x: 0.5, y: 0.5 }, face: 0.46, safe: { left: r * 0.3, right: r * 0.3, top: r * 0.22, bottom: r * 0.22 }, clip: circle(cx, cy, r) });
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 8;
      ctx.stroke(circle(cx, cy, r));
      orbit(ctx, cx, cy, r + 46, acc, 4, [-0.8, 2.4]);
      stack(ctx, i, f, { st: HEAVY(f), x: M, w: cx - r - 70 - M, top: 56, bottom: H - 56, lines: 3, max: 112, min: 46, color: "#FFFFFF", accent: acc, accentMode: "box", boxText: inkOn(acc, p.ink), kick: acc, by: rgba(p.paper, 0.8), kSize: 20, bSize: 22 });
    },
  },
  {
    id: "offset",
    label: "Offset frame",
    shape: "long",
    look: "Framed",
    palettes: ["coral", "signal", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      const ink = p.ink;
      const px = W * 0.56;
      const py = 96;
      const pw = W - px - 86;
      const ph = H - py - 92;
      ground(ctx, W, H, p, "dots", { base: p.paper, cx: px + pw / 2, cy: py + ph / 2 });
      ctx.fillStyle = p.accent;
      ctx.fillRect(px + 22, py + 22, pw, ph);
      photo(ctx, i.still, px, py, pw, ph, { bias: { x: 0.5, y: 0.42 }, face: 0.4, safe: { top: 20, left: 20, right: 20, bottom: 20 } });
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5;
      ctx.strokeRect(px, py, pw, ph);
      const th = 46;
      ctx.fillStyle = ink;
      ctx.fillRect(px - 2.5, py - th, watchW(ctx, f, 21) + 58 + 18, th);
      ctx.fillStyle = p.accent;
      ctx.fill(poly([[px + 20, py - th + 12], [px + 20, py - 12], [px + 44, py - th / 2]]));
      label(ctx, "Watch", px + 58, py - th / 2 + 1, { size: 21, font: (s) => `900 ${s}px ${f.mont}`, color: p.paper, baseline: "middle", upper: true, tracking: 0.08 });
      stack(ctx, i, f, { st: MONT(f), x: M, w: px - M - 70, top: 56, bottom: H - 56, lines: 4, max: 100, min: 40, color: ink, accent: p.accent, accentMode: "box", boxText: inkOn(p.accent, ink), kick: rgba(ink, 0.72), by: rgba(ink, 0.72), kSize: 18, bSize: 21 });
    },
  },
  {
    id: "burst",
    label: "Starburst",
    shape: "long",
    look: "Framed",
    palettes: ["signal", "coral", "cobalt", "plum"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      const r = H * 0.33;
      const cx = W * 0.74;
      const cy = H * 0.53;
      ground(ctx, W, H, p, "rays", { cx, cy, strength: 1.3 });
      ctx.fillStyle = p.accent;
      ctx.fill(star(cx, cy, r + 28, r + 76, 24, 0.05));
      ctx.fillStyle = p.paper;
      ctx.fill(circle(cx, cy, r + 10));
      photo(ctx, i.still, cx - r, cy - r, r * 2, r * 2, { bias: { x: 0.5, y: 0.5 }, face: 0.46, safe: { left: r * 0.3, right: r * 0.3, top: r * 0.22, bottom: r * 0.22 }, clip: circle(cx, cy, r) });
      badge(ctx, i.kicker, cx - r * 0.86, cy - r * 0.78, 74, p.paper, p.ink, f);
      stack(ctx, i, f, { st: ANTON(f), x: M, w: cx - r - 130 - M, top: 48, bottom: H - 48, lines: 3, max: 150, min: 56, color: "#FFFFFF", accent: acc, outline: { width: 0.04, color: "#000000" }, shadow: "hard", by: "rgba(255,255,255,.88)", kSize: 20, bSize: 22 });
    },
  },
  {
    id: "polaroid",
    label: "Snapshot",
    shape: "long",
    look: "Framed",
    palettes: ["classic", "forest", "coral", "plum"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      const cw = 400;
      const pad = 22;
      const ph = 380;
      const ch = ph + pad + 86;
      const cx = W * 0.75;
      const cy = H * 0.52;
      ground(ctx, W, H, p, "ruled", { base: p.paper, cx, cy });
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.04);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.28)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.restore();
      photo(ctx, i.still, -cw / 2 + pad, -ch / 2 + pad, cw - pad * 2, ph, { bias: { x: 0.5, y: 0.42 }, face: 0.4, safe: { top: 14, left: 14, right: 14, bottom: 14 } });
      const name = splitByline(i.byline).name;
      label(ctx, name || i.kicker, 0, ch / 2 - 34, { size: 30, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: p.ink, align: "center", maxW: cw - 60 });
      ctx.restore();
      tape(ctx, cx - cw / 2 + 26, cy - ch / 2 + 6, 120, 34, -0.62, rgba(p.accent, 0.72));
      tape(ctx, cx + cw / 2 - 14, cy - ch / 2 + 22, 120, 34, 0.58, rgba(p.accent, 0.72));
      stack(ctx, i, f, { st: MONT_ITALIC(f), x: M, w: cx - cw / 2 - 70 - M, top: 56, bottom: H - 56, lines: 4, max: 104, min: 40, color: p.ink, accent: p.accent, accentMode: "box", boxText: inkOn(p.accent, p.ink), kick: name ? mark : undefined, kSize: 18, bSize: 21 });
    },
  },
  // ── Big words over the photo (made for AI scenes, fine on frames) ──
  {
    id: "stack",
    label: "Stack",
    shape: "long",
    look: "Bold",
    palettes: ["signal", "coral", "classic", "cobalt"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, "#000000", 7);
      const { faceRight, colW, x } = sided(ctx, i, W, H, { bias: { x: 0.7, y: 0.48 }, zoom: 1.2, face: 0.36, safe: { top: 28 } }, "left");
      scrim(ctx, W, H, faceRight, [[0, "rgba(0,0,0,.55)"], [0.55, "rgba(0,0,0,.25)"], [1, "rgba(0,0,0,0)"]], 0.75);
      const st: TextStyle = { font: (s) => `900 ${s}px ${f.sans}`, upper: true, lineHeight: 0.98, tracking: -0.03 };
      const b = bigLines(ctx, i.headline, st, { x, y: H / 2 - 6, anchor: "middle", w: colW, h: H * 0.78, max: 190, color: "#FFFFFF", accent: acc, hits: hitsOf(i), outline: "rgba(0,0,0,.35)" });
      kicker(ctx, i.kicker, x, Math.max(24, b.top - 34), 17, "rgba(255,255,255,.9)", f, "left", colW);
      byline(ctx, i.byline, x, Math.min(H - 26, b.bottom + 38), 20, "rgba(255,255,255,.88)", f);
    },
  },
  {
    id: "pill",
    label: "Pill",
    shape: "long",
    look: "Bold",
    palettes: ["signal", "coral", "teal", "cobalt"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, "#000000", 7);
      const { faceRight, colW, x } = sided(ctx, i, W, H, { bias: { x: 0.7, y: 0.48 }, zoom: 1.2, face: 0.36, safe: { top: 28 } }, "left");
      scrim(ctx, W, H, faceRight, [[0, "rgba(0,0,0,.5)"], [0.55, "rgba(0,0,0,.2)"], [1, "rgba(0,0,0,0)"]], 0.75);
      const { lead, pill: word } = pillSplit(i.headline, hitsOf(i));
      const st: TextStyle = { ...BEBAS(f), lineHeight: 0.9, tracking: 0.01 };
      const pillH = 112;
      const b = lead ? bigLines(ctx, lead, st, { x, y: H / 2 - pillH / 2 - 10, anchor: "middle", w: colW, h: H * 0.56, lines: 2, max: 210, color: "#FFFFFF", accent: "#FFFFFF", hits: new Set() }) : { top: H / 2 - pillH / 2, bottom: H / 2 - pillH / 2, size: 120 };
      const pb = bigPill(ctx, word, x - 4, b.bottom + 10, Math.min(92, Math.max(56, b.size * 0.62)), colW, acc, inkOn(acc), f);
      kicker(ctx, i.kicker, x, Math.max(24, b.top - 34), 17, "rgba(255,255,255,.9)", f, "left", colW);
      byline(ctx, i.byline, x, Math.min(H - 26, pb.y + pb.h + 40), 20, "rgba(255,255,255,.88)", f);
    },
  },
  // ── the rest ──
  {
    id: "spotlight",
    label: "Spotlight",
    shape: "long",
    look: "Bold",
    palettes: ["classic", "forest", "plum", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      const px = W * 0.4;
      photo(ctx, i.still, px, 0, W - px, H, { bias: { x: 0.6, y: 0.42 }, face: 0.38, safe: { left: 170, right: 16, top: 12 } });
      ctx.fillStyle = linear(ctx, px, 0, W * 0.66, 0, [[0, p.bg], [0.35, rgba(p.bg, 0.75)], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(px, 0, W * 0.27, H);
      ctx.fillStyle = linear(ctx, 0, H * 0.7, 0, H, [[0, rgba(p.bg, 0)], [1, rgba(p.bg, 0.6)]]);
      ctx.fillRect(0, H * 0.7, W, H * 0.3);
      const st = HEAVY(f);
      const w = W * 0.5;
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.56, lines: 3, max: 124, min: 52 }, hitsOf(i));
      const top = Math.max(H * 0.22, (H - blockHeight(fitted, st)) / 2);
      kicker(ctx, i.kicker, M, top - 46, 24, acc, f, "left", w);
      const b = drawLines(ctx, fitted, st, { x: M, y: top, color: p.paper, accent: acc, hits: hitsOf(i) });
      ctx.fillStyle = acc;
      ctx.fillRect(M, b.bottom + 24, 88, 6);
      byline(ctx, i.byline, M, H - 44, 24, rgba(p.paper, 0.82), f);
    },
  },
  {
    id: "punch",
    label: "Punch",
    shape: "long",
    look: "Bold",
    palettes: ["signal", "coral", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      // YouTube-style: a few huge outlined words, the face large beside them.
      const acc = readable(p.accent, "#000000", 6);
      const { faceRight, colW, x } = sided(ctx, i, W, H, { bias: { x: 0.74, y: 0.45 }, zoom: 1.5, face: 0.42, safe: { top: 16, bottom: 8 } });
      scrim(ctx, W, H, faceRight, [[0, "rgba(0,0,0,.82)"], [0.5, "rgba(0,0,0,.5)"], [1, "rgba(0,0,0,0)"]]);
      const st = ANTON(f);
      const fitted = fit(ctx, i.headline, st, { w: colW, h: H * 0.64, lines: 3, max: 196, min: 60 }, hitsOf(i));
      const bh = blockHeight(fitted, st);
      const tagH = i.kicker.trim() ? 56 : 0;
      const top = (H - bh - tagH) / 2 + tagH;
      if (tagH) {
        const font = (s: number) => `italic 900 ${s}px ${f.mont}`;
        ctx.save();
        ctx.font = font(24);
        const tw = Math.min(colW, ctx.measureText(i.kicker.trim().toUpperCase()).width + 36);
        ctx.restore();
        ctx.fillStyle = acc;
        fillRound(ctx, x - 2, top - tagH, tw, 40, 6);
        label(ctx, i.kicker, x + 16, top - tagH + 21, { size: 24, font, color: inkOn(acc), upper: true, baseline: "middle", maxW: tw - 32 });
      }
      drawLines(ctx, fitted, st, { x, y: top, color: "#FFFFFF", accent: acc, hits: hitsOf(i), outline: { width: 0.045, color: "#000000" }, shadow: "hard" });
      byline(ctx, i.byline, x, H - 38, 22, "rgba(255,255,255,.9)", f);
    },
  },
  {
    id: "marker",
    label: "Marker",
    shape: "long",
    look: "Bold",
    palettes: ["classic", "coral", "teal", "plum"],
    draw(ctx, W, H, i, f, p) {
      const shade = darken(p.bg, 0.5);
      const { faceRight, colW, x } = sided(ctx, i, W, H, { bias: { x: 0.7, y: 0.45 }, zoom: 1.45, face: 0.4, safe: { top: 16, bottom: 40 } });
      scrim(ctx, W, H, faceRight, [[0, rgba(shade, 0.92)], [0.55, rgba(shade, 0.62)], [1, rgba(shade, 0)]], 0.75);
      pill(ctx, i.kicker, x, 56, 20, p.paper, p.ink, f, "left", colW);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, { w: colW, h: H * 0.58, lines: 3, max: 132, min: 54 }, hitsOf(i));
      drawLines(ctx, fitted, st, { x, y: H - 92, anchor: "bottom", color: "#FFFFFF", accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink), shadow: "soft" });
      byline(ctx, i.byline, x, H - 40, 22, "rgba(255,255,255,.88)", f);
    },
  },
  {
    id: "split",
    label: "Colour block",
    shape: "long",
    look: "Minimal",
    palettes: ["coral", "signal", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      // Bright, flat block of color beside a hard-edged photo.
      const block = p.accent;
      const ink = inkOn(block, p.ink);
      ctx.fillStyle = block;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, 0, 0, W * 0.52, H, { bias: { x: 0.46, y: 0.42 }, face: 0.38, safe: { right: W * 0.08 + 20, top: 12 }, clip: poly([[0, 0], [W * 0.52, 0], [W * 0.44, H], [0, H]]) });
      const x = W * 0.52 + 40;
      const w = W - x - M;
      const st = MONT(f);
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.58, lines: 4, max: 100, min: 40 }, hitsOf(i));
      const bh = blockHeight(fitted, st);
      const top = (H - bh) / 2 + 6;
      kicker(ctx, i.kicker, x, top - 48, 20, rgba(ink, 0.78), f, "left", w);
      const box = ink === "#FFFFFF" ? p.paper : p.bg;
      drawLines(ctx, fitted, st, { x, y: top, color: ink, accent: box, hits: hitsOf(i), accentMode: "box", boxText: inkOn(box, p.ink) });
      byline(ctx, i.byline, x, H - 44, 22, rgba(ink, 0.8), f, "left", false);
    },
  },
  {
    id: "number",
    label: "Big number",
    shape: "long",
    look: "Number",
    palettes: ["classic", "signal", "cobalt", "forest", "coral"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      const { hero, before, after } = heroOf(i);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      const px = W * 0.58;
      photo(ctx, i.still, px, 0, W - px, H, { bias: { x: 0.5, y: 0.42 }, face: 0.36, safe: { left: 16, right: 16, top: 12 } });
      ctx.fillStyle = acc;
      ctx.fillRect(px - 4, 0, 8, H);
      const hs = ANTON(f);
      const rs: TextStyle = { font: (s) => `800 ${s}px ${f.mont}`, upper: true, lineHeight: 1.08, tracking: 0.01 };
      const w = px - M - 56;
      const hf = fit(ctx, hero, hs, { w, h: H * 0.48, lines: 1, max: 320, min: 90 });
      const bf = fit(ctx, before, rs, { w, h: H * 0.16, lines: 2, max: 52, min: 24 }, hitsOf(i));
      const af = fit(ctx, after, rs, { w, h: H * 0.24, lines: 3, max: 56, min: 24 }, hitsOf(i));
      // One size for the words around the figure.
      const size = Math.min(before ? bf.size : 99, after ? af.size : 99);
      const bF = before ? fit(ctx, before, rs, { w, lines: 2, max: size, min: Math.min(size, 24) }, hitsOf(i)) : null;
      const aF = after ? fit(ctx, after, rs, { w, lines: 3, max: size, min: Math.min(size, 24) }, hitsOf(i)) : null;
      const gap = 16;
      const total = (bF ? blockHeight(bF, rs) + gap : 0) + blockHeight(hf, hs) + (aF ? gap + blockHeight(aF, rs) : 0);
      let y = Math.max(96, (H - total) / 2 + 8);
      kicker(ctx, i.kicker, M, y - 44, 22, rgba(p.paper, 0.75), f, "left", w);
      if (bF) y = drawLines(ctx, bF, rs, { x: M, y, color: p.paper, accent: acc, hits: hitsOf(i) }).bottom + gap;
      y = drawLines(ctx, hf, hs, { x: M - 4, y, color: acc, accent: acc, hits: new Set() }).bottom + gap;
      if (aF) drawLines(ctx, aF, rs, { x: M, y, color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, M, H - 40, 22, rgba(p.paper, 0.75), f, "left", false);
    },
  },
  {
    id: "checklist",
    label: "Checklist",
    shape: "long",
    look: "Number",
    palettes: ["forest", "classic", "cobalt", "plum"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      const px = W * 0.6;
      photo(ctx, i.still, px, 0, W - px, H, { bias: { x: 0.56, y: 0.42 }, face: 0.36, safe: { left: 120, right: 16, top: 12 } });
      ctx.fillStyle = linear(ctx, px, 0, W * 0.72, 0, [[0, p.bg], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(px, 0, W * 0.12, H);
      const x = M;
      const w = W * 0.55 - x;
      kicker(ctx, i.kicker, x, 56, 20, acc, f, "left", w);
      const st = MONT(f, false);
      const hf = fit(ctx, i.headline, st, { w, h: H * 0.3, lines: 3, max: 70, min: 34 }, hitsOf(i));
      const b = drawLines(ctx, hf, st, { x, y: 92, color: p.paper, accent: acc, hits: hitsOf(i) });
      const points = (i.points ?? []).map((s) => shortPoint(s, 30)).filter(Boolean).slice(0, 3);
      const rowH = Math.min(76, (H - 76 - b.bottom - 40) / 3);
      const box = Math.round(rowH * 0.5);
      for (let k = 0; k < 3; k++) {
        const y = b.bottom + 40 + k * rowH;
        checkbox(ctx, x, y, box, acc, k === 0, inkOn(acc));
        if (points[k]) label(ctx, points[k], x + box + 22, y + box / 2 + 1, { size: Math.round(box * 0.78), font: (s) => `600 ${s}px ${f.mont}`, color: rgba(p.paper, 0.92), baseline: "middle", maxW: w - box - 22 });
        else {
          ctx.fillStyle = rgba(p.paper, 0.22);
          fillRound(ctx, x + box + 22, y + box * 0.32, (w - box - 22) * [0.82, 0.64, 0.74][k], box * 0.36, box * 0.18);
        }
      }
      byline(ctx, i.byline, x, H - 40, 20, rgba(p.paper, 0.7), f, "left", false);
    },
  },
  {
    id: "question",
    label: "Question",
    shape: "long",
    look: "Bold",
    palettes: ["cobalt", "coral", "teal", "plum"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, W * 0.52, 0, W * 0.48, H, { bias: { x: 0.58, y: 0.42 }, face: 0.36, safe: { left: W * 0.08 + 24, right: 16, top: 12 }, clip: poly([[W * 0.6, 0], [W, 0], [W, H], [W * 0.52, H]]) });
      ctx.fillStyle = p.accent;
      ctx.fill(poly([[W * 0.6 - 10, 0], [W * 0.6, 0], [W * 0.52, H], [W * 0.52 - 10, H]]));
      // The question mark is the picture.
      label(ctx, "?", W * 0.03, H * 0.98, { size: H * 1.15, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: rgba(p.accent, 0.16) });
      const x = M;
      const w = W * 0.47 - x;
      const st = MONT(f, false);
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.58, lines: 4, max: 90, min: 38 }, hitsOf(i));
      const top = (H - blockHeight(fitted, st)) / 2 + 8;
      kicker(ctx, i.kicker, x, top - 46, 20, mark, f, "left", w);
      drawLines(ctx, fitted, st, { x, y: top, color: p.ink, accent: mark, hits: hitsOf(i) });
      byline(ctx, i.byline, x, H - 40, 22, rgba(p.ink, 0.7), f, "left", false);
    },
  },
  {
    id: "sticker",
    label: "Sticker",
    shape: "long",
    look: "Bold",
    palettes: ["signal", "coral", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      // The face on one side, a tilted card of words on the other.
      const { faceRight, shot } = sided(ctx, i, W, H, { bias: { x: 0.28, y: 0.45 }, zoom: 1.5, face: 0.42, safe: { top: 16 } }, "left");
      scrim(ctx, W, H, !faceRight, [[0, "rgba(0,0,0,.35)"], [1, "rgba(0,0,0,0)"]], 0.7);
      const st = MONT_ITALIC(f);
      const room = faceRight ? shot.head.x - 70 : W - (shot.head.x + shot.head.w) - 70;
      const sw = Math.max(W * 0.38, Math.min(W * 0.46, room));
      const pad = 34;
      const fitted = fit(ctx, i.headline, st, { w: sw - pad * 2, h: H * 0.56, lines: 4, max: 92, min: 38 }, hitsOf(i));
      const sh = blockHeight(fitted, st) + pad * 2;
      const cx = faceRight ? 44 + sw / 2 : W - 44 - sw / 2;
      ctx.save();
      ctx.translate(cx, H * 0.52);
      ctx.rotate(-0.05);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = p.paper;
      fillRound(ctx, -sw / 2, -sh / 2, sw, sh, 24);
      ctx.restore();
      drawLines(ctx, fitted, st, { x: 0, y: 0, anchor: "middle", align: "center", color: p.ink, accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink) });
      if (i.kicker.trim()) {
        // Round badge pinned to the card's top-left corner, kept inside the canvas.
        const r = 62;
        ctx.translate(-sw / 2 + Math.max(10, r + 20 - (cx - sw / 2)), -sh / 2 + Math.max(4, r + 16 - (H * 0.52 - sh / 2)));
        ctx.rotate(-0.12);
        ctx.fillStyle = p.bg;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.paper;
        ctx.lineWidth = 5;
        ctx.stroke();
        const ks: TextStyle = { font: (s) => `900 ${s}px ${f.mont}`, upper: true, lineHeight: 1.0 };
        const kf = fit(ctx, i.kicker, ks, { w: r * 1.45, h: r * 1.15, lines: 3, max: 24, min: 15 });
        drawLines(ctx, kf, ks, { x: 0, y: 0, anchor: "middle", align: "center", color: readable(p.accent, p.bg, 4), accent: p.accent, hits: new Set() });
      }
      ctx.restore();
      byline(ctx, i.byline, faceRight ? M : W - M, H - 40, 22, "#FFFFFF", f, faceRight ? "left" : "right");
    },
  },
  {
    id: "band",
    label: "Banner",
    shape: "long",
    look: "Bold",
    palettes: ["classic", "teal", "forest", "coral"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg);
      const bandH = Math.round(H * 0.36);
      // The photo only fills what the band leaves, so a low face rises above it.
      photo(ctx, i.still, 0, 0, W, H - bandH + 8, { bias: { x: 0.5, y: 0.44 }, face: 0.5, safe: { top: 8, bottom: 40 } });
      ctx.fillStyle = linear(ctx, 0, H - bandH - 80, 0, H - bandH, [[0, rgba(p.bg, 0)], [1, rgba(p.bg, 0.5)]]);
      ctx.fillRect(0, H - bandH - 80, W, 80);
      ctx.fillStyle = rgba(p.bg, 0.97);
      ctx.fillRect(0, H - bandH, W, bandH);
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, H - bandH, W, 6);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2, h: bandH - 64, lines: 2, max: 108, min: 42 }, hitsOf(i));
      drawLines(ctx, fitted, st, { x: W / 2, y: H - bandH / 2 + 8, anchor: "middle", align: "center", color: p.paper, accent: acc, hits: hitsOf(i) });
      pill(ctx, i.kicker, W / 2, H - bandH - 18, 18, p.accent, inkOn(p.accent, p.ink), f, "center", W * 0.6);
    },
  },
  {
    id: "ivory",
    label: "Private bank",
    shape: "long",
    look: "Editorial",
    palettes: ["classic", "forest", "plum", "cobalt"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      const rule = readable(p.accent, p.paper, 1.8);
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, H);
      const px = W * 0.53;
      photo(ctx, i.still, px, 0, W - px, H, { bias: { x: 0.5, y: 0.42 }, face: 0.36, safe: { left: 16, right: 16, top: 12 } });
      ctx.fillStyle = rule;
      ctx.fillRect(px - 4, 0, 8, H);
      ctx.strokeStyle = rgba(p.ink, 0.18);
      ctx.lineWidth = 2;
      ctx.strokeRect(28, 28, px - 56, H - 56);
      const st = SERIF(f);
      const x = 72;
      const w = px - x - 64;
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.58, lines: 4, max: 112, min: 42 }, hitsOf(i));
      const top = (H - blockHeight(fitted, st)) / 2 + 8;
      kicker(ctx, i.kicker, x, top - 44, 20, mark, f, "left", w);
      drawLines(ctx, fitted, st, { x, y: top, color: p.ink, accent: mark, hits: hitsOf(i) });
      byline(ctx, i.byline, x, H - 62, 22, rgba(p.ink, 0.7), f, "left", false);
    },
  },
  {
    id: "frontpage",
    label: "Front page",
    shape: "long",
    look: "Editorial",
    palettes: ["classic", "coral", "cobalt", "signal"],
    draw(ctx, W, H, i, f, p) {
      // Newsprint: masthead, rules, a black-and-white photo and one color.
      const paper = mix(p.paper, "#EFE8D8", 0.55);
      const ink = "#141414";
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);
      const { name, creds } = splitByline(i.byline);
      label(ctx, name || "The Brief", W / 2, 82, { size: 54, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: ink, align: "center", maxW: W * 0.5 });
      kicker(ctx, i.kicker || "Planning notes", 48, 46, 16, readable(p.mark, paper, 4.5), f, "left", W * 0.22);
      label(ctx, creds, W - 48, 46, { size: 16, font: (s) => `700 ${s}px ${f.sans}`, color: rgba(ink, 0.7), align: "right", baseline: "top", tracking: 0.12, upper: true, maxW: W * 0.22 });
      ctx.fillStyle = ink;
      ctx.fillRect(40, 104, W - 80, 4);
      ctx.fillRect(40, 113, W - 80, 1.5);
      const py = 140;
      const pw = W * 0.4;
      photo(ctx, i.still, 40, py, pw, H - py - 40, { bias: { x: 0.5, y: 0.42 }, face: 0.38, safe: { left: 10, right: 10, top: 10 }, tone: "mono" });
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(40, py, pw, H - py - 40);
      const x = 40 + pw + 40;
      ctx.fillStyle = rgba(ink, 0.3);
      ctx.fillRect(x - 20, py, 1.5, H - py - 40);
      const st = PLAYFAIR(f);
      const fitted = fit(ctx, i.headline, st, { w: W - x - 48, h: H - py - 80, lines: 4, max: 116, min: 38 }, hitsOf(i));
      const top = py + (H - py - 40 - blockHeight(fitted, st)) / 2 - 6;
      drawLines(ctx, fitted, st, { x, y: top, color: ink, accent: p.accent === "#101010" ? "#FFD23F" : p.accent, hits: hitsOf(i), accentMode: "marker" });
    },
  },
  {
    id: "quote",
    label: "Quote",
    shape: "long",
    look: "Quote",
    palettes: ["classic", "forest", "plum", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      const r = H * 0.34;
      const cx = W * 0.79;
      const cy = H * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, W * 0.5);
      g.addColorStop(0, rgba(mix(p.bg, "#FFFFFF", 0.14), 1));
      g.addColorStop(1, rgba(p.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, cx - r, cy - r, r * 2, r * 2, { bias: { x: 0.5, y: 0.5 }, face: 0.46, safe: { left: r * 0.3, right: r * 0.3, top: r * 0.22, bottom: r * 0.22 }, clip: circle(cx, cy, r) });
      ctx.strokeStyle = acc;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
      ctx.stroke();
      const st = PLAYFAIR(f);
      const x = 72;
      const w = W * 0.56 - x;
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.46, lines: 4, max: 96, min: 36 }, hitsOf(i));
      const bh = blockHeight(fitted, st);
      const top = Math.max(196, (H - bh) / 2 + 24);
      label(ctx, "“", x - 8, top - 26, { size: 220, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: acc });
      const b = drawLines(ctx, fitted, st, { x, y: top, color: p.paper, accent: acc, hits: hitsOf(i) });
      if (i.byline.trim()) label(ctx, `— ${i.byline}`, x, Math.min(H - 44, b.bottom + 52), { size: 22, font: (s) => `600 ${s}px ${f.mont}`, color: acc, tracking: 0.02, maxW: w });
      kicker(ctx, i.kicker, W - 48, 40, 16, rgba(p.paper, 0.6), f, "right", W * 0.3);
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    shape: "long",
    look: "Minimal",
    palettes: ["classic", "forest", "cobalt", "signal"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, H);
      const px = W * 0.6;
      const pad = 48;
      photo(ctx, i.still, px, pad, W - px - pad, H - pad * 2, { bias: { x: 0.5, y: 0.42 }, face: 0.36, safe: { left: 14, right: 14, top: 14 }, clip: rounded(px, pad, W - px - pad, H - pad * 2, 20) });
      const x = 72;
      const w = px - x - 64;
      const st = CLEAN(f);
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.5, lines: 4, max: 92, min: 34 }, hitsOf(i));
      const top = (H - blockHeight(fitted, st)) / 2 - 14;
      kicker(ctx, i.kicker, x, top - 42, 17, mark, f, "left", w);
      drawLines(ctx, fitted, st, { x, y: top, color: p.ink, accent: mark, hits: hitsOf(i) });
      monogram(ctx, i.byline, x, H - pad - 24, 22, p.ink, p.paper, rgba(p.ink, 0.8), f);
    },
  },
  {
    id: "duotone",
    label: "Duotone",
    shape: "long",
    look: "Editorial",
    palettes: ["classic", "plum", "forest", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4.5);
      const { faceRight, colW, x } = sided(ctx, i, W, H, { bias: { x: 0.72, y: 0.45 }, zoom: 1.45, face: 0.42, safe: { top: 16 }, tone: { dark: darken(p.bg, 0.35), light: mix(p.accent, "#FFFFFF", 0.45) } });
      scrim(ctx, W, H, faceRight, [[0, rgba(p.bg, 0.9)], [0.6, rgba(p.bg, 0.55)], [1, rgba(p.bg, 0)]], 0.72);
      const st = BEBAS(f);
      const fitted = fit(ctx, i.headline, st, { w: colW, h: H * 0.6, lines: 3, max: 184, min: 60 }, hitsOf(i));
      const b = drawLines(ctx, fitted, st, { x, y: H - 92, anchor: "bottom", color: "#FFFFFF", accent: acc, hits: hitsOf(i) });
      if (i.kicker.trim()) {
        const ky = Math.max(52, b.top - 46);
        ctx.fillStyle = acc;
        ctx.fillRect(x, ky + 7, 32, 4);
        kicker(ctx, i.kicker, x + 46, ky, 18, "rgba(255,255,255,.88)", f, "left", colW - 46);
      }
      byline(ctx, i.byline, x, H - 44, 22, "rgba(255,255,255,.82)", f);
    },
  },
  {
    id: "cinema",
    label: "Cinematic",
    shape: "long",
    look: "Editorial",
    palettes: ["classic", "teal", "signal", "plum"],
    draw(ctx, W, H, i, f, p) {
      // Letterboxed still, a title card in the lower third beside the face.
      const bar = Math.round(H * 0.11);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);
      const ph = H - bar * 2;
      const o: PhotoOpts & { bias: { x: number; y: number } } = { bias: { x: 0.68, y: 0.42 }, zoom: 1.4, face: 0.42, safe: { top: 12 } };
      const faceRight = faceSide(i.still, W, ph, o) === "right";
      const shot = photo(ctx, i.still, 0, bar, W, ph, { ...o, bias: { x: faceRight ? 0.68 : 0.32, y: 0.42 } });
      // A gentle grade toward the palette, then shadow under the words.
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = rgba(p.bg, 0.55);
      ctx.fillRect(0, bar, W, ph);
      ctx.restore();
      ctx.fillStyle = linear(ctx, 0, bar + ph * 0.35, 0, H - bar, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.8)"]]);
      ctx.fillRect(0, bar + ph * 0.35, W, ph * 0.65);
      scrim(ctx, W, H, faceRight, [[0, "rgba(0,0,0,.55)"], [1, "rgba(0,0,0,0)"]], 0.6);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, bar);
      ctx.fillRect(0, H - bar, W, bar);
      const { colW, x } = column(W, shot, faceRight, 40, 0.54, 0.4);
      const acc = readable(p.accent, "#000000", 6);
      const st: TextStyle = { ...BEBAS(f), tracking: 0.03, lineHeight: 0.92 };
      const fitted = fit(ctx, i.headline, st, { w: colW, h: ph * 0.56, lines: 3, max: 132, min: 48 }, hitsOf(i));
      const b = drawLines(ctx, fitted, st, { x, y: H - bar - 34, anchor: "bottom", color: "#FFFFFF", accent: acc, hits: hitsOf(i) });
      if (i.kicker.trim()) {
        ctx.fillStyle = acc;
        ctx.fillRect(x, b.top - 30, 32, 4);
        label(ctx, i.kicker, x + 46, b.top - 28, { size: 26, font: (s) => `400 ${s}px ${f.bebas}`, color: acc, baseline: "middle", tracking: 0.2, upper: true, maxW: colW - 46 });
      }
      label(ctx, i.byline, W / 2, H - bar / 2 + 1, { size: 17, font: (s) => `600 ${s}px ${f.sans}`, color: "rgba(255,255,255,.72)", align: "center", baseline: "middle", tracking: 0.2, upper: true, maxW: W * 0.7 });
    },
  },
];
