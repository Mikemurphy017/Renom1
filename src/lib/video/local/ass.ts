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

export function buildAss(o: { W: number; H: number; outDur: number; words: TimedWord[]; keyWords: Set<string>; beats: Beat[]; overlays: OverlayOptions }) {
  const { W, H, overlays: ov } = o;
  const vertical = H > W;
  const st = getStyle(ov.captions.style);
  const accent = ov.captions.color || st.accent;
  const l: Look = { st, W, H, vertical, base: Math.round((vertical ? 88 : 66) * st.font.size), accent };
  const out = assColor(st.outline.color);
  const capAlign = ov.captions.position === "top" ? 8 : ov.captions.position === "middle" ? 5 : 2;
  const capMarginV = ov.captions.position === "middle" ? 0 : Math.round(H * (vertical ? (ov.captions.position === "bottom" ? 0.2 : 0.12) : 0.08));

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
    // Captions: the original look for every style (big bold caps, heavy outline,
    // the spoken word lit). Styles change everything around the captions.
    `Style: Cap,Liberation Sans,${vertical ? 84 : 76},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,${capAlign},70,70,${capMarginV},1`,
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

  // ── captions ──
  // Up to 3 words on screen (5 on horizontal), the spoken word lit and slightly
  // larger, key figures in the highlight color.
  if (cap.enabled && o.words.length) {
    // White on white wouldn't show: a white highlight uses the original brass.
    const hl = assColor(/^#?f{6}$/i.test(accent) ? "#D9B97E" : accent);
    const chunks: TimedWord[][] = [];
    let cur: TimedWord[] = [];
    for (const w of o.words) {
      // A long pause starts a new line, so captions never run ahead of the voice.
      if (cur.length && w.start - cur.at(-1)!.end > 0.7) {
        chunks.push(cur);
        cur = [];
      }
      cur.push(w);
      if (cur.length >= (vertical ? 3 : 5) || /[.!?,;:]["”]?$/.test(w.text)) {
        chunks.push(cur);
        cur = [];
      }
    }
    if (cur.length) chunks.push(cur);
    chunks.forEach((c, ci) => {
      const chunkEnd = Math.min(chunks[ci + 1]?.[0].start ?? c.at(-1)!.end + 0.4, c.at(-1)!.end + 0.6, endCardAt);
      c.forEach((w, wi) => {
        const a = w.start;
        const b = Math.min(wi < c.length - 1 ? c[wi + 1].start : chunkEnd, endCardAt);
        const text = c
          .map((x, xi) => {
            const lit = xi === wi;
            const t = esc(x.text.toUpperCase());
            return lit || o.keyWords.has(normWord(x.text)) ? `{\\c${hl}${lit ? "\\fscx108\\fscy108" : ""}}${t}{\\r}` : t;
          })
          .join(" ");
        ev(1, a, b, "Cap", text);
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
