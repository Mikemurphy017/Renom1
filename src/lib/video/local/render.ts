import { promises as fs } from "node:fs";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";
import type { Aspect, OverlayOptions, TimeRange, TranscriptWord } from "../types";

/**
 * Renders the final MP4: keeps what the advisor kept, frames it for the
 * platform, burns in captions / name title / end card, cleans up the audio.
 * H.264 + AAC with faststart, which every network and Buffer accept.
 */

export const OUTPUT_SIZE: Record<Aspect, [number, number]> = { "9:16": [1080, 1920], "16:9": [1920, 1080] };
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FONT = "Liberation Sans";

export interface RenderInput {
  source: string;
  out: string;
  workDir: string;
  durationSec: number;
  hasAudio: boolean;
  aspect: Aspect;
  cuts: TimeRange[];
  transcript: TranscriptWord[];
  keyPhrases: string[];
  overlays: OverlayOptions;
  enhanceAudio: boolean;
  onProgress?: (p: number) => void;
}

/** What stays, as ranges of the source. */
export function keepRanges(cuts: TimeRange[], dur: number): TimeRange[] {
  const sorted = cuts
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(dur, c.end) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);
  const keep: TimeRange[] = [];
  let t = 0;
  for (const c of sorted) {
    if (c.start > t) keep.push({ start: t, end: c.start });
    t = Math.max(t, c.end);
  }
  if (dur > t) keep.push({ start: t, end: dur });
  return keep.filter((k) => k.end - k.start >= 0.05);
}

/** Source time → time in the edited video (null if it was cut). */
function remap(keep: TimeRange[], t: number): number | null {
  let acc = 0;
  for (const k of keep) {
    if (t < k.start) return null;
    if (t <= k.end) return acc + (t - k.start);
    acc += k.end - k.start;
  }
  return null;
}

// ── ASS subtitles ────────────────────────────────────────────────────────────

const assColor = (hex: string, alpha = 0) => {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "D9B97E";
  return `&H${alpha.toString(16).padStart(2, "0").toUpperCase()}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
};
const ts = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const esc = (s: string) => s.replace(/\\/g, "＼").replace(/[{}]/g, "").replace(/\n/g, " ");
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");

export function buildAss(o: { W: number; H: number; outDur: number; keep: TimeRange[]; transcript: TranscriptWord[]; keyPhrases: string[]; overlays: OverlayOptions }) {
  const { W, H, overlays: ov } = o;
  const vertical = H > W;
  const cap = ov.captions;
  const hl = assColor(cap.color);
  const white = "&H00FFFFFF";
  const navy = "&H003A1F0B";
  const size = cap.style === "bold" ? (vertical ? 84 : 76) : cap.style === "classic" ? (vertical ? 62 : 56) : vertical ? 54 : 48;
  const align = cap.position === "top" ? 8 : cap.position === "middle" ? 5 : 2;
  const marginV = cap.position === "middle" ? 0 : Math.round(H * (vertical ? (cap.position === "bottom" ? 0.2 : 0.12) : 0.08));
  const capStyle =
    cap.style === "classic"
      ? `Style: Cap,${FONT},${size},${white},${white},&H00000000,&H90000000,-1,0,0,0,100,100,0,0,3,14,0,${align},80,80,${marginV},1`
      : cap.style === "bold"
        ? `Style: Cap,${FONT},${size},${white},${white},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,${align},70,70,${marginV},1`
        : `Style: Cap,${FONT},${size},${white},${white},&H50000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,${align},90,90,${marginV},1`;

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
    capStyle,
    `Style: LT,${FONT},${vertical ? 46 : 40},${white},${white},${navy},${navy},-1,0,0,0,100,100,0,0,3,18,0,1,${Math.round(W * 0.06)},80,${Math.round(H * (vertical ? 0.3 : 0.12))},1`,
    `Style: Card,${FONT},${vertical ? 76 : 70},${white},${white},&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,90,90,0,1`,
    `Style: Box,${FONT},10,${navy},${navy},${navy},${navy},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const ev = (layer: number, a: number, b: number, style: string, text: string) => b > a && lines.push(`Dialogue: ${layer},${ts(a)},${ts(b)},${style},,0,0,0,,${text}`);

  const ec = ov.endCard;
  const endCardAt = ec.enabled && o.outDur >= 6 && (ec.headline.trim() || ec.cta.trim()) ? o.outDur - 3 : Infinity;

  // Captions: a few words on screen, the spoken word lit up, key figures in the accent color.
  if (cap.enabled && o.transcript.length) {
    const keys = new Set(ov.keyPhrases ? o.keyPhrases.flatMap((k) => k.split(/\s+/).map(norm)) : []);
    const words = o.transcript
      .map((w) => ({ text: cap.style === "bold" ? w.text.toUpperCase() : w.text, start: remap(o.keep, w.start), end: remap(o.keep, w.end) }))
      .filter((w): w is { text: string; start: number; end: number } => w.start !== null && w.end !== null && w.end > w.start);
    const chunks: (typeof words)[] = [];
    let cur: typeof words = [];
    for (const w of words) {
      cur.push(w);
      if (cur.length >= (vertical ? 3 : 5) || /[.!?,;:]["”]?$/.test(w.text)) {
        chunks.push(cur);
        cur = [];
      }
    }
    if (cur.length) chunks.push(cur);
    chunks.forEach((c, ci) => {
      const chunkEnd = Math.min(chunks[ci + 1]?.[0].start ?? c.at(-1)!.end + 0.4, c.at(-1)!.end + 0.6);
      c.forEach((w, wi) => {
        const a = w.start;
        const b = wi < c.length - 1 ? c[wi + 1].start : chunkEnd;
        const text = c
          .map((x, xi) => {
            const lit = xi === wi;
            const key = keys.has(norm(x.text));
            const t = esc(x.text);
            return lit || key ? `{\\c${hl}${lit && cap.style === "bold" ? "\\fscx108\\fscy108" : ""}}${t}{\\r}` : t;
          })
          .join(" ");
        ev(1, a, Math.min(b, endCardAt), "Cap", text);
      });
    });
  }

  // Name title near the start.
  const lt = ov.lowerThird;
  if (lt.enabled && lt.name.trim() && o.outDur > 3) {
    const who = [lt.name.trim(), lt.credentials.trim()].filter(Boolean).join(", ");
    ev(2, 0.4, Math.min(4.6, o.outDur - 0.5), "LT", `{\\fad(250,250)}${esc(who)}${lt.firm.trim() ? `\\N{\\fs${vertical ? 34 : 30}\\b0}${esc(lt.firm.trim())}` : ""}`);
  }

  // End card over the last 3 seconds.
  if (endCardAt !== Infinity) {
    const a = endCardAt;
    ev(3, a, o.outDur, "Box", `{\\fad(300,0)\\pos(0,0)\\1a&H1A&\\p1}m 0 0 l ${W} 0 ${W} ${H} 0 ${H}{\\p0}`);
    ev(4, a, o.outDur, "Card", `{\\fad(300,0)}${esc(ec.headline.trim())}${ec.cta.trim() ? `\\N{\\fs${vertical ? 46 : 42}\\b0\\c${hl}}${esc(ec.cta.trim())}` : ""}`);
  }
  return lines.join("\n") + "\n";
}

// ── ffmpeg ───────────────────────────────────────────────────────────────────

export async function renderVideo(r: RenderInput): Promise<{ durationSec: number }> {
  const [W, H] = OUTPUT_SIZE[r.aspect];
  const keep = keepRanges(r.cuts, r.durationSec);
  if (!keep.length) throw new Error("Everything was cut. Restore at least one phrase.");
  const outDur = keep.reduce((a, k) => a + (k.end - k.start), 0);

  const assFile = path.join(r.workDir, "overlays.ass");
  await fs.writeFile(assFile, buildAss({ W, H, outDur, keep, transcript: r.transcript, keyPhrases: r.keyPhrases, overlays: r.overlays }));

  const f: string[] = [];
  keep.forEach((k, i) => {
    f.push(`[0:v]trim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    f.push(r.hasAudio ? `[0:a]atrim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]` : `[1:a]atrim=duration=${(k.end - k.start).toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  f.push(`${keep.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${keep.length}:v=1:a=1[vc][ac]`);
  f.push(`[vc]fps=30,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,ass=${assFile}:fontsdir=${FONT_DIR}[vout]`);
  f.push(r.enhanceAudio ? "[ac]highpass=f=80,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]" : "[ac]aresample=48000[aout]");

  const args = ["-y", "-i", r.source];
  if (!r.hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  args.push(
    "-filter_complex", f.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-c:a", "aac", "-b:a", "160k", "-ac", "2",
    "-movflags", "+faststart",
    r.out
  );
  await runFfmpeg(args, { onTime: (s) => r.onProgress?.(Math.min(0.99, s / outDur)) });
  return { durationSec: Math.round(outDur * 100) / 100 };
}
