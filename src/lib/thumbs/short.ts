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
  bleed,
  blockHeight,
  byline,
  checkbox,
  circle,
  darken,
  drawLines,
  fillRound,
  fit,
  headroom,
  heroOf,
  hitsOf,
  inkOn,
  kicker,
  label,
  linear,
  mix,
  monogram,
  norm,
  photo,
  pill,
  poly,
  readable,
  rgba,
  rounded,
  setTracking,
  shortPoint,
  splitByline,
  type CoverInput,
  type TextStyle,
  type CoverTemplate,
} from "./kit";

/** Outer margin shared by every short layout (the right edge also carries the app's buttons). */
const M = 90;
/** Where the sharp photo starts on full-bleed layouts, before it slides down for the words. */
const BLEED_TOP = 0.32;

/**
 * Full-bleed tall covers: how tall the words may be, so they end above the head
 * (the photo slides down a little first). `below` is what goes under the
 * headline (byline and gaps).
 */
function wordRoom(i: CoverInput, W: number, H: number, top: number, below: number, max: number, min = 240) {
  const room = headroom(i.still, W, H, H * BLEED_TOP) - 48;
  return Math.max(min, Math.min(max, room - top - below));
}

/** A dark wash from the top down to a little past the words. */
function topScrim(ctx: CanvasRenderingContext2D, W: number, end: number, color: string, a0: number, aMid: number) {
  const to = Math.min(end + 260, 1500);
  ctx.fillStyle = linear(ctx, 0, 0, 0, to, [[0, rgba(color, a0)], [Math.min(0.9, end / to), rgba(color, aMid)], [1, rgba(color, 0)]]);
  ctx.fillRect(0, 0, W, to);
}

/**
 * 1080×1920: Reels, TikTok, Shorts. Platform UI covers the bottom ~25% and the
 * right edge, so words sit in the upper half and the face below them.
 */
export const SHORT: CoverTemplate[] = [
  {
    id: "hook",
    label: "Hook",
    shape: "short",
    look: "Bold",
    palettes: ["classic", "coral", "teal", "plum"],
    draw(ctx, W, H, i, f, p) {
      const shade = darken(p.bg, 0.55);
      const top = 330;
      const st = HEAVY(f);
      const by = i.byline.trim() ? 96 : 0;
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2, h: wordRoom(i, W, H, top, by, 600), lines: 4, max: 176, min: 64 }, hitsOf(i));
      const bottom = top + blockHeight(fitted, st);
      const end = bottom + by;
      bleed(ctx, i.still, W, H, H * BLEED_TOP, { clear: end + 48 });
      topScrim(ctx, W, end, shade, 0.92, 0.6);
      kicker(ctx, i.kicker, W / 2, 250, 36, readable(p.accent, shade), f, "center", W - M * 2);
      drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: "#FFFFFF", accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink), shadow: "soft" });
      byline(ctx, i.byline, W / 2, bottom + 80, 32, "rgba(255,255,255,.92)", f, "center");
    },
  },
  {
    id: "punch",
    label: "Punch",
    shape: "short",
    look: "Bold",
    palettes: ["signal", "coral", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, "#000000", 6);
      const top = 310;
      const st = ANTON(f);
      const by = i.byline.trim() ? 96 : 0;
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2 + 30, h: wordRoom(i, W, H, top, by, 620), lines: 4, max: 240, min: 80 }, hitsOf(i));
      const bottom = top + blockHeight(fitted, st);
      bleed(ctx, i.still, W, H, H * BLEED_TOP, { clear: bottom + by + 48 });
      topScrim(ctx, W, bottom + by, "#000000", 0.8, 0.5);
      if (i.kicker.trim()) {
        const font = (s: number) => `italic 900 ${s}px ${f.mont}`;
        ctx.save();
        ctx.font = font(38);
        const tw = Math.min(W - M * 2, ctx.measureText(i.kicker.trim().toUpperCase()).width + 56);
        ctx.restore();
        ctx.fillStyle = acc;
        fillRound(ctx, W / 2 - tw / 2, 200, tw, 64, 10);
        label(ctx, i.kicker, W / 2, 233, { size: 38, font, color: inkOn(acc), align: "center", baseline: "middle", upper: true, maxW: tw - 48 });
      }
      drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: "#FFFFFF", accent: acc, hits: hitsOf(i), outline: { width: 0.045, color: "#000000" }, shadow: "hard" });
      byline(ctx, i.byline, W / 2, bottom + 80, 32, "rgba(255,255,255,.92)", f, "center");
    },
  },
  {
    id: "captions",
    label: "Captions",
    shape: "short",
    look: "Bold",
    palettes: ["classic", "coral", "signal", "teal"],
    draw(ctx, W, H, i, f, p) {
      // Stacked caption blocks, one per line, like burned-in captions.
      const st: TextStyle = { font: (s) => `900 ${s}px ${f.sans}`, upper: true, lineHeight: 1.32, tracking: -0.01 };
      const top = i.kicker.trim() ? 340 : 300;
      const by = i.byline.trim() ? 90 : 0;
      const fitted = fit(ctx, i.headline, st, { w: W - 260, h: wordRoom(i, W, H, top, by, 700), lines: 4, max: 120, min: 56 });
      const lh = fitted.size * 1.32;
      const bottom = top + lh * fitted.lines.length - (lh - fitted.size * 1.18);
      bleed(ctx, i.still, W, H, H * BLEED_TOP, { clear: bottom + by + 48 });
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(0, 0, W, H);
      const set = hitsOf(i);
      const word = readable(p.mark, "#FFFFFF", 4.5);
      pill(ctx, i.kicker, W / 2, top - 112, 32, p.accent, inkOn(p.accent, p.ink), f, "center", W - M * 2);
      ctx.font = st.font(fitted.size);
      setTracking(ctx, -0.01 * fitted.size);
      const space = ctx.measureText(" ").width;
      let y = top;
      for (const line of fitted.lines) {
        const widths = line.map((w) => ctx.measureText(w).width);
        const lw = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
        const padX = fitted.size * 0.32;
        ctx.save();
        ctx.fillStyle = "#FFFFFF";
        ctx.shadowColor = "rgba(0,0,0,.3)";
        ctx.shadowBlur = 30;
        fillRound(ctx, W / 2 - lw / 2 - padX, y, lw + padX * 2, fitted.size * 1.18, fitted.size * 0.22);
        ctx.restore();
        let x = W / 2 - lw / 2;
        line.forEach((w, k) => {
          ctx.fillStyle = set.has(norm(w)) ? word : "#111111";
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = "left";
          ctx.fillText(w, x, y + fitted.size * 0.92);
          x += widths[k] + space;
        });
        y += lh;
      }
      byline(ctx, i.byline, W / 2, bottom + 74, 32, "rgba(255,255,255,.92)", f, "center");
    },
  },
  {
    id: "sticker",
    label: "Sticker",
    shape: "short",
    look: "Bold",
    palettes: ["signal", "coral", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      const st = MONT_ITALIC(f);
      const sw = W - 220;
      const pad = 54;
      const top = 300;
      const by = i.byline.trim() ? 110 : 30;
      const fitted = fit(ctx, i.headline, st, { w: sw - pad * 2, h: wordRoom(i, W, H, top, by + pad * 2 + 30, 560, 200), lines: 5, max: 146, min: 56 }, hitsOf(i));
      const sh = blockHeight(fitted, st) + pad * 2;
      // The card is tilted: its low corner sits ~30px below its box.
      bleed(ctx, i.still, W, H, H * BLEED_TOP, { clear: top + sh + 30 + by + 40 });
      topScrim(ctx, W, top + sh, "#000000", 0.35, 0.2);
      ctx.save();
      ctx.translate(W / 2, top + sh / 2);
      ctx.rotate(-0.05);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 20;
      ctx.fillStyle = p.paper;
      fillRound(ctx, -sw / 2, -sh / 2, sw, sh, 36);
      ctx.restore();
      drawLines(ctx, fitted, st, { x: 0, y: 0, anchor: "middle", align: "center", color: p.ink, accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink) });
      if (i.kicker.trim()) {
        const r = 100;
        ctx.translate(-sw / 2 + 20, -sh / 2 - 6);
        ctx.rotate(-0.12);
        ctx.fillStyle = p.bg;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.paper;
        ctx.lineWidth = 8;
        ctx.stroke();
        const ks: TextStyle = { font: (s) => `900 ${s}px ${f.mont}`, upper: true, lineHeight: 1.0 };
        const kf = fit(ctx, i.kicker, ks, { w: r * 1.45, h: r * 1.15, lines: 3, max: 40, min: 24 });
        drawLines(ctx, kf, ks, { x: 0, y: 0, anchor: "middle", align: "center", color: readable(p.accent, p.bg, 4), accent: p.accent, hits: new Set() });
      }
      ctx.restore();
      byline(ctx, i.byline, W / 2, top + sh + 30 + 76, 32, "#FFFFFF", f, "center");
    },
  },
  {
    id: "split",
    label: "Colour block",
    shape: "short",
    look: "Minimal",
    palettes: ["coral", "signal", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      const block = p.accent;
      const ink = inkOn(block, p.ink);
      const edge = H * 0.5;
      photo(ctx, i.still, 0, edge - 120, W, H - edge + 120, { bias: { x: 0.5, y: 0.38 }, face: 0.3, safe: { top: 170, left: 24, right: 24, bottom: 360 } });
      ctx.fillStyle = block;
      ctx.fill(poly([[0, 0], [W, 0], [W, edge - 90], [0, edge + 30]]));
      const box = ink === "#FFFFFF" ? p.paper : p.bg;
      const st = MONT(f);
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2, h: edge - 480, lines: 4, max: 146, min: 60 }, hitsOf(i));
      const top = Math.max(300, (edge - 120 - blockHeight(fitted, st)) / 2 + 90);
      kicker(ctx, i.kicker, W / 2, top - 72, 32, rgba(ink, 0.78), f, "center", W - M * 2);
      const b = drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: ink, accent: box, hits: hitsOf(i), accentMode: "box", boxText: inkOn(box, p.ink) });
      byline(ctx, i.byline, W / 2, b.bottom + 76, 30, rgba(ink, 0.8), f, "center", false);
    },
  },
  {
    id: "number",
    label: "Big number",
    shape: "short",
    look: "Number",
    palettes: ["classic", "signal", "cobalt", "forest", "coral"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      const { hero, before, after } = heroOf(i);
      const edge = H * 0.52;
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, 0, edge - 60, W, H - edge + 60, { bias: { x: 0.5, y: 0.4 }, face: 0.3, safe: { top: 230, left: 24, right: 24, bottom: 360 } });
      ctx.fillStyle = linear(ctx, 0, edge - 60, 0, edge + 200, [[0, p.bg], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(0, edge - 60, W, 260);
      const hs = ANTON(f);
      const rs: TextStyle = { font: (s) => `800 ${s}px ${f.mont}`, upper: true, lineHeight: 1.08, tracking: 0.01 };
      const w = W - M * 2;
      const hf = fit(ctx, hero, hs, { w, h: 480, lines: 1, max: 500, min: 120 });
      const size = Math.min(before ? fit(ctx, before, rs, { w, h: 200, lines: 2, max: 84, min: 40 }, hitsOf(i)).size : 99, after ? fit(ctx, after, rs, { w, h: 260, lines: 3, max: 84, min: 40 }, hitsOf(i)).size : 99);
      const bF = before ? fit(ctx, before, rs, { w, lines: 2, max: size, min: Math.min(size, 40) }, hitsOf(i)) : null;
      const aF = after ? fit(ctx, after, rs, { w, lines: 3, max: size, min: Math.min(size, 40) }, hitsOf(i)) : null;
      const gap = 24;
      const total = (bF ? blockHeight(bF, rs) + gap : 0) + blockHeight(hf, hs) + (aF ? gap + blockHeight(aF, rs) : 0);
      let y = Math.max(260, (edge - total) / 2 + 30);
      kicker(ctx, i.kicker, W / 2, y - 68, 32, rgba(p.paper, 0.75), f, "center", w);
      if (bF) y = drawLines(ctx, bF, rs, { x: W / 2, y, align: "center", color: p.paper, accent: acc, hits: hitsOf(i) }).bottom + gap;
      y = drawLines(ctx, hf, hs, { x: W / 2, y, align: "center", color: acc, accent: acc, hits: new Set() }).bottom;
      if (aF) y = drawLines(ctx, aF, rs, { x: W / 2, y: y + gap, align: "center", color: p.paper, accent: acc, hits: hitsOf(i) }).bottom;
      byline(ctx, i.byline, W / 2, y + 70, 30, rgba(p.paper, 0.75), f, "center", false);
    },
  },
  {
    id: "checklist",
    label: "Checklist",
    shape: "short",
    look: "Number",
    palettes: ["forest", "classic", "cobalt", "plum"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      const x = M + 6;
      const w = W - x * 2;
      kicker(ctx, i.kicker, x, 200, 30, acc, f, "left", w);
      const b = drawLines(ctx, fit(ctx, i.headline, MONT(f, false), { w, h: 400, lines: 4, max: 116, min: 54 }, hitsOf(i)), MONT(f, false), { x, y: 256, color: p.paper, accent: acc, hits: hitsOf(i) });
      const points = (i.points ?? []).map((s) => shortPoint(s, 28)).filter(Boolean).slice(0, 3);
      const box = 62;
      const rowH = 108;
      const rows = b.bottom + 60;
      for (let k = 0; k < 3; k++) {
        const y = rows + k * rowH;
        checkbox(ctx, x, y, box, acc, k === 0, inkOn(acc));
        if (points[k]) label(ctx, points[k], x + box + 32, y + box / 2 + 2, { size: 44, font: (s) => `600 ${s}px ${f.mont}`, color: rgba(p.paper, 0.92), baseline: "middle", maxW: w - box - 32 });
        else {
          ctx.fillStyle = rgba(p.paper, 0.22);
          fillRound(ctx, x + box + 32, y + box * 0.32, (w - box - 32) * [0.82, 0.62, 0.74][k], box * 0.36, box * 0.18);
        }
      }
      byline(ctx, i.byline, x, rows + rowH * 3 + 34, 28, rgba(p.paper, 0.7), f, "left", false);
      const py = Math.max(rows + rowH * 3 + 80, H * 0.56);
      photo(ctx, i.still, 0, py, W, H - py, { bias: { x: 0.5, y: 0.38 }, face: 0.34, safe: { top: 150, left: 24, right: 24, bottom: Math.max(60, 340 - (py - H * 0.56)) } });
      ctx.fillStyle = linear(ctx, 0, py, 0, py + 220, [[0, p.bg], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(0, py, W, 220);
    },
  },
  {
    id: "question",
    label: "Question",
    shape: "short",
    look: "Bold",
    palettes: ["cobalt", "coral", "teal", "plum"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      const edge = H * 0.52;
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, H);
      label(ctx, "?", W * 0.5, edge + 40, { size: 1100, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: rgba(p.accent, 0.14), align: "center" });
      photo(ctx, i.still, 0, edge - 80, W, H - edge + 80, { bias: { x: 0.5, y: 0.38 }, face: 0.3, safe: { top: 120, left: 24, right: 24, bottom: 360 }, clip: poly([[0, edge], [W, edge - 80], [W, H], [0, H]]) });
      ctx.fillStyle = p.accent;
      ctx.fill(poly([[0, edge - 12], [W, edge - 92], [W, edge - 80], [0, edge]]));
      const st = MONT(f, false);
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2, h: edge - 500, lines: 5, max: 146, min: 56 }, hitsOf(i));
      const top = Math.max(300, (edge - 140 - blockHeight(fitted, st)) / 2 + 60);
      kicker(ctx, i.kicker, W / 2, top - 72, 32, mark, f, "center", W - M * 2);
      const b = drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: p.ink, accent: mark, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, b.bottom + 76, 30, rgba(p.ink, 0.7), f, "center", false);
    },
  },
  {
    id: "card",
    label: "Private bank",
    shape: "short",
    look: "Editorial",
    palettes: ["classic", "forest", "plum", "cobalt"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      const cardH = H * 0.42;
      photo(ctx, i.still, 0, cardH - 40, W, H - cardH + 40, { bias: { x: 0.5, y: 0.36 }, face: 0.3, safe: { top: 80, left: 24, right: 24, bottom: 360 } });
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, cardH);
      ctx.fillStyle = readable(p.accent, p.paper, 1.8);
      ctx.fillRect(0, cardH, W, 10);
      const st = SERIF(f);
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2, h: cardH - 420, lines: 4, max: 164, min: 60 }, hitsOf(i));
      const top = Math.max(300, (cardH + 60 - blockHeight(fitted, st)) / 2 + 30);
      kicker(ctx, i.kicker, W / 2, top - 74, 30, mark, f, "center", W - M * 2);
      const b = drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: p.ink, accent: mark, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, Math.min(cardH - 48, b.bottom + 70), 28, rgba(p.ink, 0.7), f, "center", false);
    },
  },
  {
    id: "magazine",
    label: "Magazine",
    shape: "short",
    look: "Editorial",
    palettes: ["classic", "plum", "forest", "coral"],
    draw(ctx, W, H, i, f, p) {
      // A magazine cover with the advisor's name as the masthead.
      const acc = readable(p.accent, "#000000", 6);
      const { name, creds } = splitByline(i.byline);
      const ms: TextStyle = { font: (s) => `italic 900 ${s}px ${f.playfair}`, lineHeight: 1.0, tracking: -0.02 };
      const mf = fit(ctx, name || "The Brief", ms, { w: W - 140, lines: 1, max: 200, min: 70 });
      const ry = 110 + blockHeight(mf, ms) + 22;
      const st: TextStyle = { font: (s) => `800 ${s}px ${f.mont}`, upper: true, lineHeight: 1.04, tracking: -0.005 };
      const top = ry + 96;
      const fitted = fit(ctx, i.headline, st, { w: W - 160, h: wordRoom(i, W, H, top, 0, 860 - top, 220), lines: 4, max: 126, min: 52 }, hitsOf(i));
      const bottom = top + blockHeight(fitted, st);
      bleed(ctx, i.still, W, H, H * BLEED_TOP, { clear: bottom + 48 });
      topScrim(ctx, W, bottom, darken(p.bg, 0.5), 0.9, 0.55);
      drawLines(ctx, mf, ms, { x: W / 2, y: 110, align: "center", color: "#FFFFFF", accent: acc, hits: new Set() });
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.fillRect(70, ry, W - 140, 2);
      kicker(ctx, i.kicker || "Planning notes", 70, ry + 20, 24, acc, f, "left", W * 0.5);
      label(ctx, creds, W - 70, ry + 20, { size: 24, font: (s) => `700 ${s}px ${f.sans}`, color: "rgba(255,255,255,.8)", align: "right", baseline: "top", tracking: 0.14, upper: true, maxW: W * 0.34 });
      drawLines(ctx, fitted, st, { x: 80, y: top, color: "#FFFFFF", accent: acc, hits: hitsOf(i), shadow: "soft" });
    },
  },
  {
    id: "duotone",
    label: "Duotone",
    shape: "short",
    look: "Editorial",
    palettes: ["classic", "plum", "forest", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4.5);
      const top = 310;
      const st = BEBAS(f);
      const by = i.byline.trim() ? 92 : 0;
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2, h: wordRoom(i, W, H, top, by, 600), lines: 4, max: 260, min: 88 }, hitsOf(i));
      const bottom = top + blockHeight(fitted, st);
      bleed(ctx, i.still, W, H, H * BLEED_TOP, { clear: bottom + by + 48, tone: { dark: darken(p.bg, 0.35), light: mix(p.accent, "#FFFFFF", 0.45) } });
      topScrim(ctx, W, bottom + by, p.bg, 0.92, 0.62);
      if (i.kicker.trim()) {
        ctx.fillStyle = acc;
        ctx.fillRect(W / 2 - 30, 210, 60, 5);
        kicker(ctx, i.kicker, W / 2, 240, 30, "rgba(255,255,255,.88)", f, "center", W - M * 2);
      }
      drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: "#FFFFFF", accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, bottom + 78, 32, "rgba(255,255,255,.9)", f, "center");
    },
  },
  {
    id: "quote",
    label: "Quote",
    shape: "short",
    look: "Quote",
    palettes: ["classic", "forest", "plum", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      const r = 280;
      const cx = W / 2;
      const cy = 1170;
      const g = ctx.createRadialGradient(cx, cy, 60, cx, cy, 760);
      g.addColorStop(0, rgba(mix(p.bg, "#FFFFFF", 0.14), 1));
      g.addColorStop(1, rgba(p.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const st = PLAYFAIR(f);
      const fitted = fit(ctx, i.headline, st, { w: W - M * 2 - 20, h: 480, lines: 5, max: 176, min: 52 }, hitsOf(i));
      const top = Math.max(400, 830 - blockHeight(fitted, st));
      label(ctx, "“", M - 10, top - 30, { size: 340, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: acc });
      drawLines(ctx, fitted, st, { x: M + 10, y: top, color: p.paper, accent: acc, hits: hitsOf(i) });
      kicker(ctx, i.kicker, W - M, 180, 26, rgba(p.paper, 0.6), f, "right", W * 0.5);
      photo(ctx, i.still, cx - r, cy - r, r * 2, r * 2, { bias: { x: 0.5, y: 0.5 }, face: 0.46, safe: { left: r * 0.3, right: r * 0.3, top: r * 0.22, bottom: r * 0.22 }, clip: circle(cx, cy, r) });
      ctx.strokeStyle = acc;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 20, 0, Math.PI * 2);
      ctx.stroke();
      if (i.byline.trim()) label(ctx, `— ${i.byline}`, W / 2, cy + r + 100, { size: 36, font: (s) => `600 ${s}px ${f.mont}`, color: acc, align: "center", tracking: 0.02, maxW: W - M * 2 });
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    shape: "short",
    look: "Minimal",
    palettes: ["classic", "forest", "cobalt", "signal"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, H);
      const x = M + 6;
      const w = W - x * 2;
      monogram(ctx, i.byline, x, 196, 36, p.ink, p.paper, rgba(p.ink, 0.8), f);
      kicker(ctx, i.kicker, x, 320, 28, mark, f, "left", w);
      const st = CLEAN(f);
      const b = drawLines(ctx, fit(ctx, i.headline, st, { w, h: 480, lines: 5, max: 146, min: 58 }, hitsOf(i)), st, { x, y: 372, color: p.ink, accent: mark, hits: hitsOf(i) });
      const py = Math.max(b.bottom + 70, 940);
      photo(ctx, i.still, x, py, w, H - py - 150, { bias: { x: 0.5, y: 0.4 }, face: 0.34, safe: { left: 16, right: 16, top: 16 }, clip: rounded(x, py, w, H - py - 150, 28) });
    },
  },
  {
    id: "frame",
    label: "Framed",
    shape: "short",
    look: "Minimal",
    palettes: ["classic", "forest", "plum", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      const px = 70;
      const py = H * 0.4;
      photo(ctx, i.still, px, py, W - px * 2, H * 0.5, { bias: { x: 0.5, y: 0.4 }, face: 0.32, safe: { left: 16, right: 16, top: 16, bottom: 120 } });
      ctx.strokeStyle = acc;
      ctx.lineWidth = 6;
      ctx.strokeRect(px - 16, py - 16, W - px * 2 + 32, H * 0.5 + 32);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, { w: W - 150, h: py - 90 - 240, lines: 4, max: 164, min: 62 }, hitsOf(i));
      const bh = blockHeight(fitted, st);
      kicker(ctx, i.kicker, W / 2, Math.max(150, py - 90 - bh - 70), 32, acc, f, "center", W - M * 2);
      drawLines(ctx, fitted, st, { x: W / 2, y: py - 90, anchor: "bottom", align: "center", color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, py + H * 0.5 + 96, 32, rgba(p.paper, 0.8), f, "center", false);
    },
  },
];
