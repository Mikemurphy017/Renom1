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
  photo,
  pill,
  poly,
  readable,
  rgba,
  rounded,
  shortPoint,
  splitByline,
  type CoverTemplate,
  type TextStyle,
} from "./kit";

/** 1280×720: YouTube and LinkedIn. Read small, next to a face, in a grid of other thumbnails. */
export const LONG: CoverTemplate[] = [
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
      photo(ctx, i.still, W * 0.4, 0, W * 0.6, H, { bias: { x: 0.5, y: 0.4 } });
      ctx.fillStyle = linear(ctx, W * 0.4, 0, W * 0.66, 0, [[0, p.bg], [0.35, rgba(p.bg, 0.75)], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(W * 0.4, 0, W * 0.27, H);
      ctx.fillStyle = linear(ctx, 0, H * 0.7, 0, H, [[0, rgba(p.bg, 0)], [1, rgba(p.bg, 0.6)]]);
      ctx.fillRect(0, H * 0.7, W, H * 0.3);
      const st = HEAVY(f);
      const fitted = fit(ctx, i.headline, st, { w: W * 0.5, h: H * 0.58, lines: 3, max: 128, min: 54 }, hitsOf(i));
      const top = Math.max(H * 0.2, (H - blockHeight(fitted, st)) / 2 + 10);
      kicker(ctx, i.kicker, 64, top - 48, 26, acc, f, "left", W * 0.5);
      const b = drawLines(ctx, fitted, st, { x: 64, y: top, color: p.paper, accent: acc, hits: hitsOf(i) });
      ctx.fillStyle = acc;
      ctx.fillRect(64, b.bottom + 22, 96, 7);
      byline(ctx, i.byline, 64, H - 44, 24, rgba(p.paper, 0.8), f);
    },
  },
  {
    id: "punch",
    label: "Punch",
    shape: "long",
    look: "Bold",
    palettes: ["signal", "coral", "cobalt", "teal"],
    draw(ctx, W, H, i, f, p) {
      // YouTube-style: a few huge outlined words, face large on the right.
      const acc = readable(p.accent, "#000000", 6);
      photo(ctx, i.still, 0, 0, W, H, { bias: { x: 0.74, y: 0.45 }, zoom: 1.5 });
      ctx.fillStyle = linear(ctx, 0, 0, W * 0.8, 0, [[0, "rgba(0,0,0,.82)"], [0.5, "rgba(0,0,0,.5)"], [1, "rgba(0,0,0,0)"]]);
      ctx.fillRect(0, 0, W, H);
      const st = ANTON(f);
      const fitted = fit(ctx, i.headline, st, { w: W * 0.55, h: H * 0.68, lines: 3, max: 200, min: 64 }, hitsOf(i));
      const bh = blockHeight(fitted, st);
      const tagH = i.kicker.trim() ? 52 : 0;
      const top = (H - bh - tagH) / 2 + tagH;
      if (tagH) {
        ctx.save();
        ctx.font = `italic 900 26px ${f.mont}`;
        const tw = Math.min(W * 0.5, ctx.measureText(i.kicker.toUpperCase()).width + 36);
        ctx.fillStyle = acc;
        ctx.beginPath();
        ctx.roundRect(56, top - tagH - 4, tw, 42, 6);
        ctx.fill();
        ctx.restore();
        label(ctx, i.kicker, 74, top - tagH + 17, { size: 26, font: (s) => `italic 900 ${s}px ${f.mont}`, color: inkOn(acc), upper: true, baseline: "middle", maxW: W * 0.5 - 36 });
      }
      drawLines(ctx, fitted, st, { x: 58, y: top, color: "#FFFFFF", accent: acc, hits: hitsOf(i), outline: { width: 0.045, color: "#000000" }, shadow: "hard" });
      byline(ctx, i.byline, 60, H - 36, 22, "rgba(255,255,255,.88)", f);
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
      photo(ctx, i.still, 0, 0, W, H, { bias: { x: 0.7, y: 0.45 }, zoom: 1.45 });
      ctx.fillStyle = linear(ctx, 0, 0, W * 0.75, 0, [[0, rgba(shade, 0.92)], [0.55, rgba(shade, 0.62)], [1, rgba(shade, 0)]]);
      ctx.fillRect(0, 0, W, H);
      pill(ctx, i.kicker, 60, 56, 22, p.paper, p.ink, f);
      const st = HEAVY(f);
      headline(ctx, i.headline, st, { w: W * 0.54, h: H * 0.6, lines: 3, max: 136, min: 56 }, { x: 64, y: H - 84, anchor: "bottom", color: "#FFFFFF", accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink), shadow: "soft" });
      byline(ctx, i.byline, W - 48, H - 40, 22, "rgba(255,255,255,.88)", f, "right");
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
      photo(ctx, i.still, 0, 0, W * 0.52, H, { bias: { x: 0.5, y: 0.4 }, clip: poly([[0, 0], [W * 0.52, 0], [W * 0.44, H], [0, H]]) });
      const x = W * 0.52 + 36;
      const w = W - x - 56;
      const st = MONT(f);
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.6, lines: 4, max: 104, min: 42 }, hitsOf(i));
      const bh = blockHeight(fitted, st);
      const top = (H - bh) / 2 + 6;
      kicker(ctx, i.kicker, x, top - 50, 22, rgba(ink, 0.75), f, "left", w);
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
      const { hero, rest } = heroOf(i);
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, W * 0.58, 0, W * 0.42, H, { bias: { x: 0.5, y: 0.4 } });
      ctx.fillStyle = acc;
      ctx.fillRect(W * 0.58 - 4, 0, 8, H);
      const hs = ANTON(f);
      const rs: TextStyle = { font: (s) => `800 ${s}px ${f.mont}`, upper: true, lineHeight: 1.08, tracking: 0.01 };
      const w = W * 0.58 - 120;
      const hf = fit(ctx, hero, hs, { w, h: H * 0.5, lines: 1, max: 330, min: 90 });
      const rf = fit(ctx, rest, rs, { w, h: H * 0.26, lines: 3, max: 60, min: 26 }, hitsOf(i));
      const gap = rest ? 18 : 0;
      const total = blockHeight(hf, hs) + gap + blockHeight(rf, rs);
      const top = Math.max(96, (H - total) / 2 + 12);
      kicker(ctx, i.kicker, 64, top - 44, 24, rgba(p.paper, 0.75), f, "left", w);
      const b = drawLines(ctx, hf, hs, { x: 60, y: top, color: acc, accent: acc, hits: new Set() });
      drawLines(ctx, rf, rs, { x: 64, y: b.bottom + gap, color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, 64, H - 40, 22, rgba(p.paper, 0.75), f);
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
      photo(ctx, i.still, W * 0.6, 0, W * 0.4, H, { bias: { x: 0.5, y: 0.4 } });
      ctx.fillStyle = linear(ctx, W * 0.6, 0, W * 0.72, 0, [[0, p.bg], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(W * 0.6, 0, W * 0.12, H);
      const x = 64;
      const w = W * 0.56 - x;
      kicker(ctx, i.kicker, x, 52, 22, acc, f, "left", w);
      const st = MONT(f, false);
      const b = headline(ctx, i.headline, st, { w, h: H * 0.32, lines: 3, max: 72, min: 36 }, { x, y: 90, color: p.paper, accent: acc, hits: hitsOf(i) });
      const points = (i.points ?? []).map((s) => shortPoint(s, 30)).filter(Boolean).slice(0, 3);
      const rowH = Math.min(78, (H - 70 - b.bottom - 36) / 3);
      const box = Math.round(rowH * 0.52);
      for (let k = 0; k < 3; k++) {
        const y = b.bottom + 34 + k * rowH;
        checkbox(ctx, x, y, box, acc, k === 0, inkOn(acc));
        if (points[k]) label(ctx, points[k], x + box + 22, y + box / 2, { size: Math.round(box * 0.78), font: (s) => `600 ${s}px ${f.mont}`, color: rgba(p.paper, 0.92), baseline: "middle", maxW: w - box - 22 });
        else {
          ctx.fillStyle = rgba(p.paper, 0.22);
          ctx.beginPath();
          ctx.roundRect(x + box + 22, y + box * 0.32, (w - box - 22) * [0.82, 0.64, 0.74][k], box * 0.36, box * 0.18);
          ctx.fill();
        }
      }
      byline(ctx, i.byline, x, H - 34, 20, rgba(p.paper, 0.7), f);
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
      photo(ctx, i.still, W * 0.5, 0, W * 0.5, H, { bias: { x: 0.52, y: 0.4 }, clip: poly([[W * 0.6, 0], [W, 0], [W, H], [W * 0.52, H]]) });
      ctx.fillStyle = p.accent;
      ctx.fill(poly([[W * 0.6 - 10, 0], [W * 0.6, 0], [W * 0.52, H], [W * 0.52 - 10, H]]));
      // The question mark is the picture.
      label(ctx, "?", W * 0.03, H * 0.98, { size: H * 1.15, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: rgba(p.accent, 0.2) });
      const x = 64;
      const w = W * 0.47 - x;
      const st = MONT(f, false);
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.6, lines: 4, max: 92, min: 40 }, hitsOf(i));
      const top = (H - blockHeight(fitted, st)) / 2 + 8;
      kicker(ctx, i.kicker, x, top - 46, 22, mark, f, "left", w);
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
      photo(ctx, i.still, 0, 0, W, H, { bias: { x: 0.28, y: 0.45 }, zoom: 1.5 });
      ctx.fillStyle = linear(ctx, W * 0.3, 0, W, 0, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.35)"]]);
      ctx.fillRect(0, 0, W, H);
      const st = MONT_ITALIC(f);
      const sw = W * 0.46;
      const pad = 34;
      const fitted = fit(ctx, i.headline, st, { w: sw - pad * 2, h: H * 0.56, lines: 4, max: 92, min: 40 }, hitsOf(i));
      const sh = blockHeight(fitted, st) + pad * 2;
      const cx = W * 0.72;
      const cy = H * 0.52;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.06);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = p.paper;
      ctx.beginPath();
      ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 24);
      ctx.fill();
      ctx.restore();
      drawLines(ctx, fitted, st, { x: 0, y: 0, anchor: "middle", align: "center", color: p.ink, accent: p.accent, hits: hitsOf(i), accentMode: "box", boxText: inkOn(p.accent, p.ink) });
      if (i.kicker.trim()) {
        // Round badge pinned to the corner.
        const r = 64;
        ctx.translate(-sw / 2 + 10, -sh / 2 + 4);
        ctx.rotate(-0.16);
        ctx.fillStyle = p.bg;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.paper;
        ctx.lineWidth = 5;
        ctx.stroke();
        const kf = fit(ctx, i.kicker, { font: (s) => `900 ${s}px ${f.mont}`, upper: true, lineHeight: 1.0 }, { w: r * 1.5, h: r * 1.2, lines: 3, max: 26, min: 12 });
        drawLines(ctx, kf, { font: (s) => `900 ${s}px ${f.mont}`, upper: true, lineHeight: 1.0 }, { x: 0, y: 0, anchor: "middle", align: "center", color: readable(p.accent, p.bg, 4), accent: p.accent, hits: new Set() });
      }
      ctx.restore();
      byline(ctx, i.byline, 48, H - 40, 22, "#FFFFFF", f);
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
      photo(ctx, i.still, 0, 0, W, H, { bias: { x: 0.5, y: 0.34 } });
      const bandH = H * 0.36;
      ctx.fillStyle = linear(ctx, 0, H - bandH - 80, 0, H - bandH, [[0, rgba(p.bg, 0)], [1, rgba(p.bg, 0.5)]]);
      ctx.fillRect(0, H - bandH - 80, W, 80);
      ctx.fillStyle = rgba(p.bg, 0.95);
      ctx.fillRect(0, H - bandH, W, bandH);
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, H - bandH, W, 6);
      const st = HEAVY(f);
      headline(ctx, i.headline, st, { w: W - 128, h: bandH - 56, lines: 2, max: 112, min: 44 }, { x: W / 2, y: H - bandH / 2 + 6, anchor: "middle", align: "center", color: p.paper, accent: acc, hits: hitsOf(i) });
      pill(ctx, i.kicker, W / 2, H - bandH - 19, 20, p.accent, inkOn(p.accent, p.ink), f, "center");
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
      photo(ctx, i.still, W * 0.53, 0, W * 0.47, H, { bias: { x: 0.5, y: 0.4 } });
      ctx.fillStyle = rule;
      ctx.fillRect(W * 0.53 - 4, 0, 8, H);
      ctx.strokeStyle = rgba(p.ink, 0.18);
      ctx.lineWidth = 2;
      ctx.strokeRect(28, 28, W * 0.53 - 56, H - 56);
      const st = SERIF(f);
      const fitted = fit(ctx, i.headline, st, { w: W * 0.4, h: H * 0.6, lines: 4, max: 116, min: 44 }, hitsOf(i));
      const top = (H - blockHeight(fitted, st)) / 2 + 12;
      kicker(ctx, i.kicker, 72, top - 46, 22, mark, f, "left", W * 0.4);
      drawLines(ctx, fitted, st, { x: 72, y: top, color: p.ink, accent: mark, hits: hitsOf(i) });
      byline(ctx, i.byline, 72, H - 64, 22, rgba(p.ink, 0.7), f, "left", false);
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
      label(ctx, name || "The Brief", W / 2, 82, { size: 56, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: ink, align: "center", maxW: W * 0.56 });
      kicker(ctx, i.kicker || "Planning notes", 48, 44, 18, readable(p.mark, paper, 4.5), f, "left", W * 0.2);
      label(ctx, creds, W - 48, 44, { size: 18, font: (s) => `700 ${s}px ${f.sans}`, color: rgba(ink, 0.7), align: "right", baseline: "top", tracking: 0.12, upper: true, maxW: W * 0.2 });
      ctx.fillStyle = ink;
      ctx.fillRect(40, 104, W - 80, 4);
      ctx.fillRect(40, 113, W - 80, 1.5);
      const py = 140;
      const pw = W * 0.4;
      photo(ctx, i.still, 40, py, pw, H - py - 40, { bias: { x: 0.5, y: 0.38 }, tone: "mono" });
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(40, py, pw, H - py - 40);
      const x = 40 + pw + 40;
      ctx.fillStyle = rgba(ink, 0.3);
      ctx.fillRect(x - 20, py, 1.5, H - py - 40);
      const st = PLAYFAIR(f);
      const fitted = fit(ctx, i.headline, st, { w: W - x - 48, h: H - py - 70, lines: 4, max: 120, min: 40 }, hitsOf(i));
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
      const g = ctx.createRadialGradient(W * 0.78, H * 0.5, 40, W * 0.78, H * 0.5, W * 0.5);
      g.addColorStop(0, rgba(mix(p.bg, "#FFFFFF", 0.14), 1));
      g.addColorStop(1, rgba(p.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const r = H * 0.34;
      const cx = W * 0.79;
      const cy = H * 0.5;
      photo(ctx, i.still, cx - r, cy - r, r * 2, r * 2, { bias: { x: 0.5, y: 0.45 }, clip: circle(cx, cy, r) });
      ctx.strokeStyle = acc;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
      ctx.stroke();
      label(ctx, "“", 46, 240, { size: 300, font: (s) => `italic 900 ${s}px ${f.playfair}`, color: acc });
      const st = PLAYFAIR(f);
      const x = 72;
      const w = W * 0.56 - x;
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.48, lines: 4, max: 100, min: 36 }, hitsOf(i));
      const top = Math.max(200, (H - blockHeight(fitted, st)) / 2 + 30);
      const b = drawLines(ctx, fitted, st, { x, y: top, color: p.paper, accent: acc, hits: hitsOf(i) });
      if (i.byline.trim()) label(ctx, `— ${i.byline}`, x, Math.min(H - 40, b.bottom + 52), { size: 24, font: (s) => `600 ${s}px ${f.mont}`, color: acc, tracking: 0.02, maxW: w });
      kicker(ctx, i.kicker, W - 48, 40, 18, rgba(p.paper, 0.6), f, "right", W * 0.3);
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
      photo(ctx, i.still, px, 48, W - px - 48, H - 96, { bias: { x: 0.5, y: 0.4 }, clip: rounded(px, 48, W - px - 48, H - 96, 20) });
      const x = 72;
      const w = px - x - 64;
      const st = CLEAN(f);
      const fitted = fit(ctx, i.headline, st, { w, h: H * 0.52, lines: 4, max: 96, min: 34 }, hitsOf(i));
      const top = (H - blockHeight(fitted, st)) / 2 - 14;
      kicker(ctx, i.kicker, x, top - 42, 18, mark, f, "left", w);
      drawLines(ctx, fitted, st, { x, y: top, color: p.ink, accent: mark, hits: hitsOf(i) });
      monogram(ctx, i.byline, x, H - 76, 22, p.ink, p.paper, rgba(p.ink, 0.8), f);
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
      photo(ctx, i.still, 0, 0, W, H, { bias: { x: 0.72, y: 0.45 }, zoom: 1.45, tone: { dark: darken(p.bg, 0.35), light: mix(p.accent, "#FFFFFF", 0.45) } });
      ctx.fillStyle = linear(ctx, 0, 0, W * 0.72, 0, [[0, rgba(p.bg, 0.9)], [0.6, rgba(p.bg, 0.55)], [1, rgba(p.bg, 0)]]);
      ctx.fillRect(0, 0, W, H);
      const st = BEBAS(f);
      const b = headline(ctx, i.headline, st, { w: W * 0.52, h: H * 0.62, lines: 3, max: 190, min: 64 }, { x: 64, y: H - 92, anchor: "bottom", color: "#FFFFFF", accent: acc, hits: hitsOf(i) });
      if (i.kicker.trim()) {
        ctx.fillStyle = acc;
        ctx.fillRect(64, Math.max(56, b.top - 40), 36, 4);
        kicker(ctx, i.kicker, 112, Math.max(48, b.top - 48), 20, "rgba(255,255,255,.85)", f, "left", W * 0.42);
      }
      byline(ctx, i.byline, 64, H - 44, 22, "rgba(255,255,255,.8)", f);
    },
  },
  {
    id: "cinema",
    label: "Cinematic",
    shape: "long",
    look: "Editorial",
    palettes: ["classic", "teal", "signal", "plum"],
    draw(ctx, W, H, i, f, p) {
      const bar = Math.round(H * 0.12);
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);
      photo(ctx, i.still, 0, bar, W, H - bar * 2, { bias: { x: 0.64, y: 0.42 }, zoom: 1.35 });
      // A gentle grade toward the palette, then a floor of shadow for the words.
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = rgba(p.bg, 0.55);
      ctx.fillRect(0, bar, W, H - bar * 2);
      ctx.restore();
      ctx.fillStyle = linear(ctx, 0, H * 0.4, 0, H - bar, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.85)"]]);
      ctx.fillRect(0, H * 0.4, W, H * 0.6 - bar);
      const acc = readable(p.accent, "#000000", 6);
      const st: TextStyle = { ...BEBAS(f), tracking: 0.06, lineHeight: 0.92 };
      headline(ctx, i.headline, st, { w: W * 0.82, h: H * 0.34, lines: 2, max: 124, min: 46 }, { x: W / 2, y: H - bar - 28, anchor: "bottom", align: "center", color: "#FFFFFF", accent: acc, hits: hitsOf(i) });
      label(ctx, i.kicker, W / 2, bar / 2 + 2, { size: 30, font: (s) => `400 ${s}px ${f.bebas}`, color: acc, align: "center", baseline: "middle", tracking: 0.4, upper: true, maxW: W * 0.7 });
      label(ctx, i.byline, W / 2, H - bar / 2 + 1, { size: 18, font: (s) => `600 ${s}px ${f.sans}`, color: "rgba(255,255,255,.7)", align: "center", baseline: "middle", tracking: 0.22, upper: true, maxW: W * 0.7 });
    },
  },
];
