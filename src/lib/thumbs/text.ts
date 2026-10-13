"use client";

import {
  ANTON,
  CLEAN,
  HEAVY,
  MONT,
  SERIF,
  bigLines,
  blockHeight,
  byline,
  checkbox,
  drawLines,
  fillRound,
  fit,
  ground,
  hitsOf,
  inkOn,
  kicker,
  label,
  monogram,
  readable,
  rgba,
  shortPoint,
  stack,
  type CoverTemplate,
} from "./kit";

/**
 * Covers with no photo of the advisor: words, color and graphics only. For
 * advisors (often institutional) who'd rather not have a face, real or AI, on
 * every thumbnail. Same canvases and palettes as the photo layouts.
 */

const SM = 90; // short margin
const LM = 64; // long margin

export const TEXT_SHORT: CoverTemplate[] = [
  {
    id: "t-statement",
    label: "Statement",
    shape: "short",
    look: "Text",
    noPhoto: true,
    palettes: ["classic", "forest", "plum", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ground(ctx, W, H, p, "rings", { cx: W * 0.85, cy: H * 0.2, strength: 1.2 });
      ctx.fillStyle = acc;
      ctx.fillRect(SM, 300, 120, 12);
      stack(ctx, i, f, { st: HEAVY(f), x: SM, w: W - SM * 2, top: 360, bottom: H - 420, max: 190, min: 70, lines: 6, color: p.paper, accent: acc, kick: acc, kSize: 34, bSize: 34 });
      monogram(ctx, i.byline, SM + 40, H - 230, 40, acc, inkOn(acc), rgba(p.paper, 0.85), f);
    },
  },
  {
    id: "t-card",
    label: "Card",
    shape: "short",
    look: "Text",
    noPhoto: true,
    palettes: ["classic", "forest", "coral", "cobalt"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      ground(ctx, W, H, p, "ruled", { base: p.paper });
      const cx = 70;
      const cy = 420;
      const cw = W - cx * 2;
      const ch = H - cy - 380;
      ctx.fillStyle = p.bg;
      fillRound(ctx, cx, cy, cw, ch, 36);
      const acc = readable(p.accent, p.bg, 4);
      ctx.fillStyle = acc;
      fillRound(ctx, cx + 70, cy - 26, 220, 52, 26);
      label(ctx, (i.kicker || "Worth knowing").slice(0, 18), cx + 180, cy, { size: 26, font: (s) => `800 ${s}px ${f.mont}`, color: inkOn(acc), align: "center", baseline: "middle", tracking: 0.08, upper: true, maxW: 200 });
      stack(ctx, { ...i, kicker: "" }, f, { st: SERIF(f), x: W / 2, align: "center", w: cw - 140, top: cy + 110, bottom: cy + ch - 90, max: 150, min: 60, lines: 6, color: p.paper, accent: acc, kSize: 30, bSize: 30 });
      byline(ctx, i.byline, W / 2, cy + ch + 150, 36, mark, f, "center", false);
    },
  },
  {
    id: "t-checklist",
    label: "Checklist",
    shape: "short",
    look: "Text",
    noPhoto: true,
    palettes: ["forest", "classic", "cobalt", "plum"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ground(ctx, W, H, p, "dots", { cy: H * 0.8, strength: 0.8 });
      const x = SM + 6;
      const w = W - x * 2;
      kicker(ctx, i.kicker, x, 260, 32, acc, f, "left", w);
      const st = MONT(f, false);
      const b = drawLines(ctx, fit(ctx, i.headline, st, { w, h: 560, lines: 5, max: 132, min: 60 }, hitsOf(i)), st, { x, y: 320, color: p.paper, accent: acc, hits: hitsOf(i) });
      const points = (i.points ?? []).map((s) => shortPoint(s, 26)).filter(Boolean).slice(0, 3);
      const box = 76;
      const rowH = 150;
      const rows = Math.max(b.bottom + 110, 900);
      for (let k = 0; k < 3; k++) {
        const y = rows + k * rowH;
        checkbox(ctx, x, y, box, acc, k === 0, inkOn(acc));
        if (points[k]) label(ctx, points[k], x + box + 40, y + box / 2 + 2, { size: 52, font: (s) => `600 ${s}px ${f.mont}`, color: rgba(p.paper, 0.94), baseline: "middle", maxW: w - box - 40 });
        else {
          ctx.fillStyle = rgba(p.paper, 0.2);
          fillRound(ctx, x + box + 40, y + box * 0.32, (w - box - 40) * [0.82, 0.62, 0.74][k], box * 0.36, box * 0.18);
        }
      }
      byline(ctx, i.byline, x, H - 220, 34, rgba(p.paper, 0.75), f, "left", false);
    },
  },
  {
    id: "t-bigtype",
    label: "Big type",
    shape: "short",
    look: "Text",
    noPhoto: true,
    palettes: ["signal", "coral", "classic", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ground(ctx, W, H, p, "rays", { cy: H * 0.55, strength: 1.4 });
      kicker(ctx, i.kicker, W / 2, 300, 36, acc, f, "center", W - SM * 2);
      bigLines(ctx, i.headline, ANTON(f), { x: W / 2, y: H * 0.5, w: W - SM * 2, h: H * 0.58, lines: 5, max: 330, align: "center", anchor: "middle", color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, H - 240, 36, rgba(p.paper, 0.82), f, "center", false);
    },
  },
];

export const TEXT_LONG: CoverTemplate[] = [
  {
    id: "t-statement",
    label: "Statement",
    shape: "long",
    look: "Text",
    noPhoto: true,
    palettes: ["classic", "forest", "plum", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ground(ctx, W, H, p, "rings", { cx: W * 0.92, cy: H * 0.15, strength: 1.2 });
      ctx.fillStyle = acc;
      ctx.fillRect(LM, 96, 12, H - 192);
      stack(ctx, i, f, { st: HEAVY(f), x: LM + 48, w: W * 0.8 - LM, top: 90, bottom: H - 90, max: 128, min: 48, lines: 4, color: p.paper, accent: acc, kick: acc, by: rgba(p.paper, 0.75), kSize: 24, bSize: 24 });
    },
  },
  {
    id: "t-card",
    label: "Card",
    shape: "long",
    look: "Text",
    noPhoto: true,
    palettes: ["classic", "forest", "coral", "cobalt"],
    draw(ctx, W, H, i, f, p) {
      const mark = readable(p.mark, p.paper, 4.5);
      ground(ctx, W, H, p, "grid", { base: p.paper });
      const cx = 120;
      const cy = 90;
      const cw = W - cx * 2;
      const ch = H - cy * 2 - 50;
      ctx.fillStyle = p.bg;
      fillRound(ctx, cx, cy, cw, ch, 28);
      const acc = readable(p.accent, p.bg, 4);
      stack(ctx, i, f, { st: SERIF(f), x: W / 2, align: "center", w: cw - 120, top: cy + 40, bottom: cy + ch - 40, max: 104, min: 44, lines: 3, color: p.paper, accent: acc, kick: acc, kSize: 22, bSize: 22 });
      byline(ctx, i.byline, W / 2, cy + ch + 34, 24, mark, f, "center", false);
    },
  },
  {
    id: "t-checklist",
    label: "Checklist",
    shape: "long",
    look: "Text",
    noPhoto: true,
    palettes: ["forest", "classic", "cobalt", "plum"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ground(ctx, W, H, p, "dots", { cx: W * 0.8, strength: 0.8 });
      const x = LM;
      const colW = W * 0.5 - LM;
      const st = CLEAN(f);
      const fitted = fit(ctx, i.headline, st, { w: colW, h: H - 260, lines: 4, max: 84, min: 40 }, hitsOf(i));
      const top = (H - blockHeight(fitted, st)) / 2;
      kicker(ctx, i.kicker, x, top - 30, 22, acc, f, "left", colW);
      drawLines(ctx, fitted, st, { x, y: top, color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, x, H - 60, 22, rgba(p.paper, 0.72), f, "left", false);
      const px = W * 0.56;
      const pw = W - px - LM;
      const points = (i.points ?? []).map((s) => shortPoint(s, 24)).filter(Boolean).slice(0, 3);
      const box = 48;
      const rowH = 120;
      const rows = (H - rowH * 3) / 2 + 20;
      for (let k = 0; k < 3; k++) {
        const y = rows + k * rowH;
        checkbox(ctx, px, y, box, acc, k === 0, inkOn(acc));
        if (points[k]) label(ctx, points[k], px + box + 26, y + box / 2 + 2, { size: 34, font: (s) => `600 ${s}px ${f.mont}`, color: rgba(p.paper, 0.94), baseline: "middle", maxW: pw - box - 26 });
        else {
          ctx.fillStyle = rgba(p.paper, 0.2);
          fillRound(ctx, px + box + 26, y + box * 0.32, (pw - box - 26) * [0.82, 0.62, 0.74][k], box * 0.36, box * 0.18);
        }
      }
    },
  },
  {
    id: "t-bigtype",
    label: "Big type",
    shape: "long",
    look: "Text",
    noPhoto: true,
    palettes: ["signal", "coral", "classic", "teal"],
    draw(ctx, W, H, i, f, p) {
      const acc = readable(p.accent, p.bg, 4);
      ground(ctx, W, H, p, "rays", { cy: H * 0.5, strength: 1.4 });
      bigLines(ctx, i.headline, ANTON(f), { x: W / 2, y: H * 0.48, w: W - LM * 3, h: H - 220, lines: 3, max: 240, align: "center", anchor: "middle", color: p.paper, accent: acc, hits: hitsOf(i) });
      byline(ctx, i.byline, W / 2, H - 56, 24, rgba(p.paper, 0.82), f, "center", false);
    },
  },
];
