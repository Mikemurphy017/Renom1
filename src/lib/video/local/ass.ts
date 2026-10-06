import type { OverlayOptions } from "../types";
import { getStyle, type StyleDef } from "../styles";

/**
 * Builds the ASS subtitle file libass burns into the video: captions in the
 * chosen style, keyword cards on the big moments, the name title and the end
 * card. Times are in the edited video's timeline.
 */

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface Beat {
  /** Seconds into the edited video. */
  at: number;
  dur: number;
  keyword: string;
  /** Stock-footage search for b-roll at this moment. */
  query?: string;
  broll?: boolean;
}

const NAVY = "#0B1F3A";
const STOP = new Set("a an the and or but of for to in on at by with your you my our we i it is are was be this that these those from as if so do does not no yes".split(" "));

export const assColor = (hex: string, alpha = 0) => {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "FFFFFF";
  return `&H${alpha.toString(16).padStart(2, "0")}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase();
};
const ts = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const esc = (s: string) => s.replace(/\\/g, "＼").replace(/[{}]/g, "").replace(/\n/g, " ");
export const normWord = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");

interface Look {
  st: StyleDef;
  W: number;
  H: number;
  vertical: boolean;
  base: number;
  accent: string;
}

/** Override tags for one caption word. */
function wordTags(l: Look, o: { active: boolean; emph: boolean; visible: boolean; boxed?: boolean }) {
  const { st } = l;
  const ef = o.emph && st.emphasisFont ? st.emphasisFont : null;
  const font = ef?.family ?? st.font.family;
  const size = Math.round(l.base * (ef ? ef.scale : 1));
  const italic = ef?.italic ?? st.font.italic ?? false;
  const lit = (o.active && st.highlight === "spoken") || (o.emph && st.highlight === "key");
  const color = o.boxed ? NAVY : lit && !st.activeBox ? l.accent : st.text;
  const bump = o.active && st.highlight === "spoken" && st.animation === "pop" ? 108 : 100;
  return `{\\fn${font}\\fs${size}\\i${italic ? 1 : 0}\\c${assColor(color)}\\bord${o.boxed ? 0 : st.outline.width}\\fscx${bump}\\fscy${bump}\\alpha${o.visible ? "&H00&" : "&HFF&"}\\fsp${st.font.tracking ?? 0}}`;
}

const caseFor = (l: Look, text: string, emph: boolean) => {
  const upper = emph && l.st.emphasisFont?.upper !== undefined ? l.st.emphasisFont.upper : l.st.font.upper;
  return upper ? text.toUpperCase() : text;
};

export function buildAss(o: { W: number; H: number; outDur: number; words: TimedWord[]; keyWords: Set<string>; beats: Beat[]; overlays: OverlayOptions }) {
  const { W, H, overlays: ov } = o;
  const vertical = H > W;
  const st = getStyle(ov.captions.style);
  const accent = ov.captions.color || st.accent;
  const l: Look = { st, W, H, vertical, base: Math.round((vertical ? 88 : 66) * st.font.size), accent };
  const out = assColor(st.outline.color);

  const lines: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Captions. Clarity sits on a soft band (opaque box); the rest are outlined text.
    st.id === "clarity"
      ? `Style: Cap,${st.font.family},${l.base},&H00FFFFFF,&H00FFFFFF,&H64000000,&H64000000,0,0,0,0,100,100,0,0,3,16,0,5,90,90,0,1`
      : `Style: Cap,${st.font.family},${l.base},&H00FFFFFF,&H00FFFFFF,${out},&H80000000,0,0,0,0,100,100,0,0,1,${st.outline.width},${st.outline.width ? 2 : 0},5,80,80,0,1`,
    `Style: CapBox,${st.font.family},${l.base},&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,&H00FFFFFF,0,0,0,0,100,100,0,0,3,${Math.round(l.base * 0.16)},0,5,80,80,0,1`,
    // Karaoke fills Secondary → Primary as each word is said.
    `Style: Kara,${st.font.family},${l.base},${assColor(accent)},${assColor(st.text)},${out},&H80000000,0,0,0,0,100,100,0,0,1,${st.outline.width},2,5,80,80,0,1`,
    `Style: LT,Montserrat ExtraBold,${vertical ? 44 : 38},&H00FFFFFF,&H00FFFFFF,${assColor(NAVY)},${assColor(NAVY)},0,0,0,0,100,100,0,0,3,18,0,1,${Math.round(W * 0.06)},80,${Math.round(H * (vertical ? 0.3 : 0.12))},1`,
    `Style: Card,Montserrat Black,${vertical ? 76 : 70},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,90,90,0,1`,
    `Style: Big,Anton,${l.base * 2},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,6,0,5,40,40,0,1`,
    `Style: Chip,Montserrat ExtraBold,${Math.round(l.base * 0.55)},${assColor(NAVY)},${assColor(NAVY)},${assColor(accent)},${assColor(accent)},0,0,0,0,100,100,0,0,3,14,0,8,60,60,${Math.round(H * 0.09)},1`,
    `Style: Box,Montserrat ExtraBold,10,${assColor(NAVY)},${assColor(NAVY)},${assColor(NAVY)},${assColor(NAVY)},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const ev = (layer: number, a: number, b: number, style: string, text: string) => b - a > 0.01 && lines.push(`Dialogue: ${layer},${ts(a)},${ts(b)},${style},,0,0,0,,${text}`);

  const ec = ov.endCard;
  const endCardAt = ec.enabled && o.outDur >= 6 && (ec.headline.trim() || ec.cta.trim()) ? o.outDur - 3 : Infinity;
  const cap = ov.captions;
  const posY = cap.position === "top" ? H * 0.2 : cap.position === "middle" ? H * (vertical ? 0.56 : 0.5) : H * (vertical ? 0.74 : 0.85);
  const pos = `\\an5\\pos(${Math.round(W / 2)},${Math.round(posY)})`;

  // ── captions ──
  if (cap.enabled && o.words.length) {
    const per = st.words[vertical ? 0 : 1];
    const chunks: TimedWord[][] = [];
    let cur: TimedWord[] = [];
    for (const w of o.words) {
      // A long pause starts a new line, so captions never run ahead of the voice.
      if (cur.length && w.start - cur.at(-1)!.end > 0.7) {
        chunks.push(cur);
        cur = [];
      }
      cur.push(w);
      if (cur.length >= per || /[.!?,;:]["”]?$/.test(w.text)) {
        chunks.push(cur);
        cur = [];
      }
    }
    if (cur.length) chunks.push(cur);

    chunks.forEach((c, ci) => {
      const chunkEnd = Math.min(chunks[ci + 1]?.[0].start ?? c.at(-1)!.end + 0.5, c.at(-1)!.end + 0.7, endCardAt);
      if (c[0].start >= chunkEnd) return;
      // Emphasis: the key words in this line, else its strongest word.
      let emph = new Set(c.map((w, i) => (o.keyWords.has(normWord(w.text)) ? i : -1)).filter((i) => i >= 0));
      if (st.highlight === "key" && !emph.size) {
        const best = c.map((w, i) => ({ i, n: normWord(w.text) })).filter((x) => !STOP.has(x.n)).sort((a, b) => b.n.length - a.n.length)[0];
        if (best) emph = new Set([best.i]);
      }
      const intro = st.animation === "pop" ? "\\fscx70\\fscy70\\t(0,110,\\fscx104\\fscy104)\\t(110,180,\\fscx100\\fscy100)" : st.animation === "fade" || st.animation === "slide" ? "\\fad(140,0)" : "";

      if (st.animation === "karaoke") {
        const body = c
          .map((w, i) => {
            const next = c[i + 1]?.start ?? w.end;
            return `{\\kf${Math.max(1, Math.round((next - w.start) * 100))}}${esc(caseFor(l, w.text, false))}`;
          })
          .join(" ");
        ev(1, c[0].start, chunkEnd, "Kara", `{${pos}}${body}`);
        return;
      }

      // Pop/slide styles reveal words as they're said; the others show the whole line.
      const progressive = st.animation === "pop" || st.animation === "slide";
      c.forEach((w, wi) => {
        const a = w.start;
        const b = Math.min(wi < c.length - 1 ? c[wi + 1].start : chunkEnd, endCardAt);
        if (b <= a) return;
        const animate = wi === 0 ? intro : "";
        const state = (xi: number) => ({ active: xi === wi, emph: emph.has(xi), visible: !progressive || xi <= wi });
        const render = (fn: (xi: number, s: ReturnType<typeof state>) => string) => c.map((x, xi) => fn(xi, state(xi)) + esc(caseFor(l, x.text, emph.has(xi)))).join(" ");

        // Active word on a white block (Focus).
        if (st.activeBox) {
          ev(0, a, b, "CapBox", `{${pos}${animate}}` + render((xi, s) => wordTags(l, { ...s, visible: xi === wi, boxed: false }).replace("\\bord", "\\3a&H00&\\bord") ));
        }
        // Glow under the lit words.
        if (st.glow) {
          ev(0, a, b, "Cap", `{${pos}${animate}}` + render((xi, s) => {
            const lit = (s.active && st.highlight === "spoken") || (s.emph && st.highlight === "key");
            return wordTags(l, s).replace(/\\alpha&H..&/, lit && s.visible ? `\\1a&HFF&\\3a&H40&\\3c${assColor(l.accent)}\\bord${Math.round(l.base * 0.14)}\\blur${Math.round(l.base * 0.12)}` : "\\alpha&HFF&");
          }));
        }
        ev(1, a, b, "Cap", `{${pos}${animate}}` + render((xi, s) => wordTags(l, { ...s, boxed: st.activeBox && xi === wi })));
      });
    });
  }

  // ── keyword cards ──
  if (ov.extras.keywordCards && st.card) {
    for (const bt of o.beats) {
      const a = bt.at;
      const b = Math.min(bt.at + bt.dur, endCardAt);
      if (b - a < 0.4) continue;
      const kw = esc(bt.keyword.toUpperCase());
      const fit = (max: number) => Math.round(Math.min(max, (W * 1.7) / Math.max(4, kw.length)));
      if (st.card === "headline") {
        const fs = fit(l.base * 1.9);
        const p = `\\an5\\pos(${W / 2},${Math.round(H * (vertical ? 0.24 : 0.2))})\\fs${fs}\\fscx70\\fscy70\\t(0,120,\\fscx104\\fscy104)\\t(120,200,\\fscx100\\fscy100)\\fad(0,150)`;
        ev(2, a, b, "Big", `{${p}\\1a&HFF&\\3c${assColor(accent)}\\3a&H40&\\bord${Math.round(fs * 0.12)}\\blur${Math.round(fs * 0.1)}}${kw}`);
        ev(3, a, b, "Big", `{${p}\\c${assColor(accent)}\\3c&H000000&}${kw}`);
      } else if (st.card === "backdrop") {
        const fs = fit(l.base * 3.2);
        const p = `\\an5\\pos(${W / 2},${Math.round(H * (vertical ? 0.3 : 0.32))})\\fs${fs}\\fad(200,250)`;
        ev(0, a, b, "Big", `{${p}\\1a&HFF&\\3c${assColor(accent)}\\3a&H60&\\bord${Math.round(fs * 0.1)}\\blur${Math.round(fs * 0.12)}}${kw}`);
        ev(0, a, b, "Big", `{${p}\\1a&HFF&\\3c${assColor(accent)}\\3a&H10&\\bord5}${kw}`);
      } else if (st.card === "banner") {
        const bh = Math.round(H * (vertical ? 0.1 : 0.16));
        const y = Math.round(H * (vertical ? 0.7 : 0.12));
        const band = /^#?f{6}$/i.test(accent) ? "#2347E6" : accent;
        ev(2, a, b, "Box", `{\\an7\\pos(0,${y - bh / 2})\\c${assColor(band)}\\fad(120,120)\\p1}m 0 0 l ${W} 0 ${W} ${bh} 0 ${bh}{\\p0}`);
        ev(3, a, b, "Card", `{\\an5\\pos(${W / 2},${y})\\fs${fit(bh * 0.72)}\\fad(120,120)}${kw}`);
      } else if (st.card === "chip") {
        ev(2, a, b, "Chip", `{\\fad(150,150)}${kw}`);
      }
    }
  }

  // ── name title ──
  const lt = ov.lowerThird;
  if (lt.enabled && lt.name.trim() && o.outDur > 3) {
    const who = [lt.name.trim(), lt.credentials.trim()].filter(Boolean).join(", ");
    ev(4, 0.4, Math.min(4.6, o.outDur - 0.5), "LT", `{\\fad(250,250)}${esc(who)}${lt.firm.trim() ? `\\N{\\fnMontserrat SemiBold\\fs${vertical ? 32 : 28}}${esc(lt.firm.trim())}` : ""}`);
  }

  // ── end card ──
  if (endCardAt !== Infinity) {
    ev(5, endCardAt, o.outDur, "Box", `{\\fad(300,0)\\pos(0,0)\\1a&H1A&\\p1}m 0 0 l ${W} 0 ${W} ${H} 0 ${H}{\\p0}`);
    ev(6, endCardAt, o.outDur, "Card", `{\\fad(300,0)}${esc(ec.headline.trim())}${ec.cta.trim() ? `\\N{\\fnMontserrat SemiBold\\fs${vertical ? 44 : 40}\\c${assColor(accent)}}${esc(ec.cta.trim())}` : ""}`);
  }
  return lines.join("\n") + "\n";
}
