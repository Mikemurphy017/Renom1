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
  fit,
  headline,
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
  type CoverTemplate,
  type TextStyle,
} from "./kit";

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
      bleed(ctx, i.still, W, H, H * 0.34);
      ctx.fillStyle = linear(ctx, 0, 0, 0, H * 0.6, [[0, rgba(shade, 0.92)], [0.62, rgba(shade, 0.55)], [1, rgba(shade, 0)]]);
      ctx.fillRect(0, 0, W, H * 0.6);
      kicker(ctx, i.kicker, W / 2, 250, 40, readable(p.accent, shade), f, "center", W - 180);
      const b = headline(ctx, i.headline, HEAVY(f), { w: W - 160, h: 600, lines: 4, max: 180, min: 72 }, { x: W / 2, y: 330, align: "center", color: "#FFFFFF", accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink), shadow: "soft" });
      byline(ctx, i.byline, W / 2, b.bottom + 84, 34, "rgba(255,255,255,.92)", f, "center");
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
      bleed(ctx, i.still, W, H, H * 0.36);
      ctx.fillStyle = linear(ctx, 0, 0, 0, H * 0.58, [[0, "rgba(0,0,0,.8)"], [0.65, "rgba(0,0,0,.45)"], [1, "rgba(0,0,0,0)"]]);
      ctx.fillRect(0, 0, W, H * 0.58);
      if (i.kicker.trim()) {
        ctx.save();
        ctx.font = `italic 900 40px ${f.mont}`;
        const tw = Math.min(W - 200, ctx.measureText(i.kicker.toUpperCase()).width + 56);
        ctx.fillStyle = acc;
        ctx.beginPath();
        ctx.roundRect(W / 2 - tw / 2, 200, tw, 66, 10);
        ctx.fill();
        ctx.restore();
        label(ctx, i.kicker, W / 2, 234, { size: 40, font: (s) => `italic 900 ${s}px ${f.mont}`, color: inkOn(acc), align: "center", baseline: "middle", upper: true, maxW: W - 256 });
      }
      const b = headline(ctx, i.headline, ANTON(f), { w: W - 150, h: 620, lines: 4, max: 250, min: 84 }, { x: W / 2, y: 310, align: "center", color: "#FFFFFF", accent: acc, hits: hitsOf(i), outline: { width: 0.045, color: "#000000" }, shadow: "hard" });
      byline(ctx, i.byline, W / 2, b.bottom + 84, 34, "rgba(255,255,255,.92)", f, "center");
    },
  },
  {
    id: "captions",
    label: "Captions",
    shape: "short",
    look: "Bold",
    palettes: ["classic", "coral", "signal", "teal"],
    draw(ctx, W, H, i, f, p) {
      bleed(ctx, i.still, W, H, H * 0.3);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(0, 0, W, H);
      // Stacked caption blocks, one per line, like burned-in captions.
      const st: TextStyle = { font: (s) => `900 ${s}px ${f.sans}`, upper: true, lineHeight: 1.32, tracking: -0.01 };
      const fitted = fit(ctx, i.headline, st, { w: W - 260, h: 700, lines: 4, max: 124, min: 60 });
      ctx.font = st.font(fitted.size);
      setTracking(ctx, -0.01 * fitted.size);
      const space = ctx.measureText(" ").width;
      const lh = fitted.size * 1.32;
      const top = 470 - (lh * fitted.lines.length) / 2 + 120;
      let y = Math.max(330, top);
      const set = hitsOf(i);
      const word = readable(p.mark, "#FFFFFF", 4.5);
      pill(ctx, i.kicker, W / 2, y - 120, 34, p.accent, inkOn(p.accent, p.ink), f, "center");
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
          ctx.fillStyle = set.has(norm(w)) ? word : "#111111";
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = "left";
          ctx.fillText(w, x, y + fitted.size * 0.92);
          x += widths[k] + space;
        });
        y += lh;
      }
      byline(ctx, i.byline, W / 2, y + 40, 34, "rgba(255,255,255,.92)", f, "center");
    },
  },
  {
    id: "sticker",
    label: "Sticker",
    shape: "short",
    look: "Bold",
    palettes: ["signal", "coral", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      bleed(ctx, i.still, W, H, H * 0.3);
      ctx.fillStyle = linear(ctx, 0, 0, 0, H * 0.5, [[0, "rgba(0,0,0,.35)"], [1, "rgba(0,0,0,0)"]]);
      ctx.fillRect(0, 0, W, H * 0.5);
      const st = MONT_ITALIC(f);
      const sw = W - 220;
      const pad = 54;
      const fitted = fit(ctx, i.headline, st, { w: sw - pad * 2, h: 560, lines: 5, max: 150, min: 60 }, hitsOf(i));
      const sh = blockHeight(fitted, st) + pad * 2;
      ctx.save();
      ctx.translate(W / 2, 300 + sh / 2);
      ctx.rotate(-0.05);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 20;
      ctx.fillStyle = p.paper;
      ctx.beginPath();
      ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 36);
      ctx.fill();
      ctx.restore();
      drawLines(ctx, fitted, st, { x: 0, y: 0, anchor: "middle", align: "center", color: p.ink, accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink) });
      if (i.kicker.trim()) {
        const r = 104;
        ctx.translate(-sw / 2 + 20, -sh / 2 - 6);
        ctx.rotate(-0.14);
        ctx.fillStyle = p.bg;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.paper;
        ctx.lineWidth = 8;
        ctx.stroke();
        const ks: TextStyle = { font: (s) => `900 ${s}px ${f.mont}`, upper: true, lineHeight: 1.0 };
        const kf = fit(ctx, i.kicker, ks, { w: r * 1.5, h: r * 1.2, lines: 3, max: 42, min: 18 });
        drawLines(ctx, kf, ks, { x: 0, y: 0, anchor: "middle", align: "center", color: readable(p.accent, p.bg, 4), accent: p.accent, hits: new Set() });
      }
      ctx.restore();
      byline(ctx, i.byline, W / 2, 300 + sh + 120, 34, "#FFFFFF", f, "center");
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
      photo(ctx, i.still, 0, edge - 120, W, H - edge + 120, { bias: { x: 0.5, y: 0.36 } });
      ctx.fillStyle = block;
      ctx.fill(poly([[0, 0], [W, 0], [W, edge - 90], [0, edge + 30]]));
      const box = ink === "#FFFFFF" ? p.paper : p.bg;
      const st = MONT(f);
      const fitted = fit(ctx, i.headline, st, { w: W - 180, h: edge - 480, lines: 4, max: 150, min: 64 }, hitsOf(i));
      const top = Math.max(300, (edge - 120 - blockHeight(fitted, st)) / 2 + 90);
      kicker(ctx, i.kicker, W / 2, top - 74, 36, rgba(ink, 0.75), f, "center", W - 180);
      const b = drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: ink, accent: box, hits: hitsOf(i), accentMode: "box", boxText: inkOn(box, p.ink) });
      byline(ctx, i.byline, W / 2, b.bottom + 76, 32, rgba(ink, 0.8), f, "center", false);
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
      const { hero, rest } = heroOf(i);
      const edge = H * 0.52;
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, 0, edge - 60, W, H - edge + 60, { bias: { x: 0.5, y: 0.36 } });
      ctx.fillStyle = linear(ctx, 0, edge - 60, 0, edge + 200, [[0, p.bg], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(0, edge - 60, W, 260);
      const hs = ANTON(f);
      const rs: TextStyle = { font: (s) => `800 ${s}px ${f.mont}`, upper: true, lineHeight: 1.08, tracking: 0.01 };
      const hf = fit(ctx, hero, hs, { w: W - 160, h: 520, lines: 1, max: 520, min: 120 });
      const rf = fit(ctx, rest, rs, { w: W - 180, h: 260, lines: 3, max: 88, min: 44 }, hitsOf(i));
      const gap = rest ? 24 : 0;
      const total = blockHeight(hf, hs) + gap + blockHeight(rf, rs);
      const top = Math.max(250, (edge - total) / 2 + 40);
      kicker(ctx, i.kicker, W / 2, top - 70, 36, rgba(p.paper, 0.75), f, "center", W - 180);
      const b = drawLines(ctx, hf, hs, { x: W / 2, y: top, align: "center", color: acc, accent: acc, hits: new Set() });
      const r = drawLines(ctx, rf, rs, { x: W / 2, y: b.bottom + gap, align: "center", color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, r.bottom + 70, 32, rgba(p.paper, 0.75), f, "center", false);
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
      const x = 96;
      const w = W - x * 2;
      kicker(ctx, i.kicker, x, 200, 34, acc, f, "left", w);
      const b = headline(ctx, i.headline, MONT(f, false), { w, h: 420, lines: 4, max: 120, min: 56 }, { x, y: 256, color: p.paper, accent: acc, hits: hitsOf(i) });
      const points = (i.points ?? []).map((s) => shortPoint(s, 28)).filter(Boolean).slice(0, 3);
      const box = 64;
      const rowH = 112;
      const rows = b.bottom + 56;
      for (let k = 0; k < 3; k++) {
        const y = rows + k * rowH;
        checkbox(ctx, x, y, box, acc, k === 0, inkOn(acc));
        if (points[k]) label(ctx, points[k], x + box + 32, y + box / 2, { size: 46, font: (s) => `600 ${s}px ${f.mont}`, color: rgba(p.paper, 0.92), baseline: "middle", maxW: w - box - 32 });
        else {
          ctx.fillStyle = rgba(p.paper, 0.22);
          ctx.beginPath();
          ctx.roundRect(x + box + 32, y + box * 0.32, (w - box - 32) * [0.82, 0.62, 0.74][k], box * 0.36, box * 0.18);
          ctx.fill();
        }
      }
      byline(ctx, i.byline, x, rows + rowH * 3 + 30, 30, rgba(p.paper, 0.7), f, "left", false);
      const py = Math.max(rows + rowH * 3 + 70, H * 0.56);
      photo(ctx, i.still, 0, py, W, H - py, { bias: { x: 0.5, y: 0.36 } });
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
      label(ctx, "?", W * 0.5, edge + 40, { size: 1100, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: rgba(p.accent, 0.16), align: "center" });
      photo(ctx, i.still, 0, edge - 80, W, H - edge + 80, { bias: { x: 0.5, y: 0.36 }, clip: poly([[0, edge], [W, edge - 80], [W, H], [0, H]]) });
      ctx.fillStyle = p.accent;
      ctx.fill(poly([[0, edge - 12], [W, edge - 92], [W, edge - 80], [0, edge]]));
      const st = MONT(f, false);
      const fitted = fit(ctx, i.headline, st, { w: W - 180, h: edge - 500, lines: 5, max: 150, min: 60 }, hitsOf(i));
      const top = Math.max(300, (edge - 140 - blockHeight(fitted, st)) / 2 + 60);
      kicker(ctx, i.kicker, W / 2, top - 74, 36, mark, f, "center", W - 180);
      const b = drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: p.ink, accent: mark, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, b.bottom + 76, 32, rgba(p.ink, 0.7), f, "center", false);
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
      photo(ctx, i.still, 0, cardH - 40, W, H - cardH + 40, { bias: { x: 0.5, y: 0.36 } });
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, W, cardH);
      ctx.fillStyle = readable(p.accent, p.paper, 1.8);
      ctx.fillRect(0, cardH, W, 10);
      const st = SERIF(f);
      const fitted = fit(ctx, i.headline, st, { w: W - 180, h: cardH - 420, lines: 4, max: 170, min: 64 }, hitsOf(i));
      const top = Math.max(300, (cardH + 60 - blockHeight(fitted, st)) / 2 + 40);
      kicker(ctx, i.kicker, W / 2, top - 76, 34, mark, f, "center", W - 180);
      const b = drawLines(ctx, fitted, st, { x: W / 2, y: top, align: "center", color: p.ink, accent: mark, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, Math.min(cardH - 40, b.bottom + 70), 30, rgba(p.ink, 0.7), f, "center", false);
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
      bleed(ctx, i.still, W, H, H * 0.3);
      ctx.fillStyle = linear(ctx, 0, 0, 0, H * 0.58, [[0, rgba(darken(p.bg, 0.5), 0.88)], [0.7, rgba(darken(p.bg, 0.5), 0.5)], [1, "rgba(0,0,0,0)"]]);
      ctx.fillRect(0, 0, W, H * 0.58);
      const { name, creds } = splitByline(i.byline);
      const ms: TextStyle = { font: (s) => `italic 900 ${s}px ${f.playfair}`, lineHeight: 1.0, tracking: -0.02 };
      const mf = fit(ctx, name || "The Brief", ms, { w: W - 140, lines: 1, max: 200, min: 70 });
      drawLines(ctx, mf, ms, { x: W / 2, y: 110, align: "center", color: "#FFFFFF", accent: acc, hits: new Set() });
      const ry = 110 + blockHeight(mf, ms) + 22;
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.fillRect(70, ry, W - 140, 2);
      kicker(ctx, i.kicker || "Planning notes", 70, ry + 20, 26, acc, f, "left", W * 0.5);
      label(ctx, creds, W - 70, ry + 20, { size: 26, font: (s) => `700 ${s}px ${f.sans}`, color: "rgba(255,255,255,.8)", align: "right", baseline: "top", tracking: 0.14, upper: true, maxW: W * 0.36 });
      const st: TextStyle = { font: (s) => `800 ${s}px ${f.mont}`, upper: true, lineHeight: 1.04, tracking: -0.005 };
      headline(ctx, i.headline, st, { w: W - 160, h: 860 - ry - 90, lines: 4, max: 130, min: 54 }, { x: 80, y: ry + 100, color: "#FFFFFF", accent: acc, hits: hitsOf(i), shadow: "soft" });
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
      bleed(ctx, i.still, W, H, H * 0.34, { tone: { dark: darken(p.bg, 0.35), light: mix(p.accent, "#FFFFFF", 0.45) } });
      ctx.fillStyle = linear(ctx, 0, 0, 0, H * 0.62, [[0, rgba(p.bg, 0.92)], [0.6, rgba(p.bg, 0.6)], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(0, 0, W, H * 0.62);
      if (i.kicker.trim()) {
        ctx.fillStyle = acc;
        ctx.fillRect(W / 2 - 30, 210, 60, 5);
        kicker(ctx, i.kicker, W / 2, 240, 34, "rgba(255,255,255,.88)", f, "center", W - 180);
      }
      const b = headline(ctx, i.headline, BEBAS(f), { w: W - 160, h: 600, lines: 4, max: 270, min: 90 }, { x: W / 2, y: 310, align: "center", color: "#FFFFFF", accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, b.bottom + 80, 34, "rgba(255,255,255,.9)", f, "center");
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
      const r = 250;
      const cx = W / 2;
      const cy = 1140;
      const g = ctx.createRadialGradient(cx, cy, 60, cx, cy, 760);
      g.addColorStop(0, rgba(mix(p.bg, "#FFFFFF", 0.14), 1));
      g.addColorStop(1, rgba(p.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      label(ctx, "“", 90, 470, { size: 420, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: acc });
      const st = PLAYFAIR(f);
      const fitted = fit(ctx, i.headline, st, { w: W - 200, h: 440, lines: 5, max: 140, min: 52 }, hitsOf(i));
      const top = Math.max(400, 830 - blockHeight(fitted, st));
      drawLines(ctx, fitted, st, { x: 100, y: top, color: p.paper, accent: acc, hits: hitsOf(i) });
      kicker(ctx, i.kicker, W - 96, 180, 28, rgba(p.paper, 0.6), f, "right", W * 0.5);
      photo(ctx, i.still, cx - r, cy - r, r * 2, r * 2, { bias: { x: 0.5, y: 0.45 }, clip: circle(cx, cy, r) });
      ctx.strokeStyle = acc;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 20, 0, Math.PI * 2);
      ctx.stroke();
      if (i.byline.trim()) label(ctx, `— ${i.byline}`, W / 2, cy + r + 100, { size: 38, font: (s) => `600 ${s}px ${f.mont}`, color: acc, align: "center", tracking: 0.02, maxW: W - 200 });
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
      const x = 96;
      const w = W - x * 2;
      monogram(ctx, i.byline, x, 190, 38, p.ink, p.paper, rgba(p.ink, 0.8), f);
      kicker(ctx, i.kicker, x, 330, 30, mark, f, "left", w);
      const st = CLEAN(f);
      const b = headline(ctx, i.headline, st, { w, h: 480, lines: 5, max: 150, min: 60 }, { x, y: 380, color: p.ink, accent: mark, hits: hitsOf(i) });
      const py = Math.max(b.bottom + 70, 940);
      photo(ctx, i.still, x, py, w, H - py - 150, { bias: { x: 0.5, y: 0.38 }, clip: rounded(x, py, w, H - py - 150, 28) });
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
      photo(ctx, i.still, px, py, W - px * 2, H * 0.5, { bias: { x: 0.5, y: 0.4 } });
      ctx.strokeStyle = acc;
      ctx.lineWidth = 6;
      ctx.strokeRect(px - 16, py - 16, W - px * 2 + 32, H * 0.5 + 32);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, { w: W - 150, h: py - 90 - 240, lines: 4, max: 168, min: 64 }, hitsOf(i));
      const bh = blockHeight(fitted, st);
      kicker(ctx, i.kicker, W / 2, Math.max(150, py - 90 - bh - 70), 36, acc, f, "center", W - 180);
      drawLines(ctx, fitted, st, { x: W / 2, y: py - 90, anchor: "bottom", align: "center", color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, py + H * 0.5 + 100, 34, rgba(p.paper, 0.8), f, "center", false);
    },
  },
];
