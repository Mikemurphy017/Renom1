import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";
import { buildAss, normWord, type Beat, type TimedWord } from "./ass";
import { pickBeats } from "./beats";
import { footageFor } from "./broll";
import { musicBed, sfx, type SfxKind } from "./audio-beds";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import { getStyle, normalizeOverlays, type MusicMood } from "../styles";
import type { Aspect, OverlayOptions, TimeRange, TranscriptWord } from "../types";

/**
 * Renders the final MP4: keeps what the advisor kept, frames it for the
 * platform, then applies the edit style: punch-in zooms, b-roll cutaways,
 * captions and keyword cards, name title, end card, and a mix of the cleaned
 * voice with music (ducked under speech) and sound effects.
 * H.264 + AAC with faststart, which every network and Buffer accept.
 */

export const OUTPUT_SIZE: Record<Aspect, [number, number]> = { "9:16": [1080, 1920], "16:9": [1920, 1080] };
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
/** RNNoise model for speech in recordings ("somnolent-hogwash", github.com/GregorR/rnnoise-models). */
const DENOISE_MODEL = path.join(process.cwd(), "assets", "audio", "voice-denoise.rnnn");

/**
 * "Studio sound" for the voice: rumble cut, neural denoise plus a light
 * spectral pass, a touch of EQ (less mud, more presence and air), de-essing,
 * gentle compression, and an expander that drops the room between sentences
 * without touching the words. Loudness is set on the final mix.
 */
function studioVoice() {
  const denoise = existsSync(DENOISE_MODEL) ? `arnndn=m=${DENOISE_MODEL},afftdn=nf=-35:tn=1` : "afftdn=nf=-25:tn=1";
  return [
    "highpass=f=75",
    denoise,
    "equalizer=f=220:t=q:w=1.2:g=-2",
    "equalizer=f=3200:t=q:w=1.4:g=2.5",
    "highshelf=f=9500:g=2",
    "deesser=i=0.35",
    "acompressor=threshold=0.1:ratio=3:attack=10:release=150:makeup=1.6",
    "agate=threshold=0.02:ratio=2.5:range=0.12:attack=5:release=250",
  ].join(",");
}

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

// ── render ───────────────────────────────────────────────────────────────────

const MOODS: MusicMood[] = ["calm", "uplift", "pulse", "cinematic"];

async function musicFile(choice: string, dir: string): Promise<string | null> {
  if (choice.startsWith("media:")) {
    const id = choice.slice(6);
    if (!isMediaId(id)) return null;
    const r = await objects().read(mediaKey(id)).catch(() => null);
    if (!r || !r.contentType.startsWith("audio/")) return null;
    const file = path.join(dir, "music-upload");
    await fs.writeFile(file, new Uint8Array(await new Response(r.body).arrayBuffer()));
    return file;
  }
  return MOODS.includes(choice as MusicMood) ? musicBed(choice as MusicMood) : null;
}

export async function renderVideo(r: RenderInput): Promise<{ durationSec: number }> {
  const [W, H] = OUTPUT_SIZE[r.aspect];
  const ov = normalizeOverlays(r.overlays);
  const st = getStyle(ov.captions.style);
  const ex = ov.extras;
  const keep = keepRanges(r.cuts, r.durationSec);
  if (!keep.length) throw new Error("Everything was cut. Restore at least one phrase.");
  const outDur = keep.reduce((a, k) => a + (k.end - k.start), 0);
  const fps = 30;

  // Words in the edited timeline.
  // A word that starts a hair inside a trimmed pause (recognizers stamp words a
  // little early) starts where the kept part begins instead of being dropped.
  const words: TimedWord[] = r.transcript
    .map((w) => {
      const end = remap(keep, w.end);
      const start = remap(keep, w.start) ?? (end !== null ? remap(keep, keep.find((k) => k.start > w.start && k.start < w.end)?.start ?? -1) : null);
      return { text: w.text, start, end };
    })
    .filter((w): w is TimedWord => w.start !== null && w.end !== null && w.end > w.start);

  // The big moments drive cards, zooms, b-roll and sound effects.
  const wantsBeats = (ex.keywordCards && !!st.card) || ex.motion || ex.broll || ex.sfx;
  r.onProgress?.(0.02);
  const endCardAt = ov.endCard.enabled && outDur >= 6 ? outDur - 3 : outDur;
  // Moments never run into the end card.
  const beats: Beat[] = (wantsBeats ? await pickBeats(words, outDur, ex.broll) : [])
    .filter((b) => endCardAt - b.at >= 0.8)
    .map((b) => ({ ...b, dur: Math.min(b.dur, endCardAt - b.at) }));
  console.info(`[video] ${st.name}: ${beats.length} moments`, beats.map((b) => `${b.at.toFixed(1)}s ${b.keyword}${b.broll ? ` (b-roll: ${b.query})` : ""}`).join(" · "));
  const keyWords = new Set<string>([...(ov.keyPhrases ? r.keyPhrases : []), ...beats.map((b) => b.keyword)].flatMap((k) => k.split(/\s+/).map(normWord)).filter(Boolean));
  const clips = ex.broll ? await footageFor(beats, ex.brollMedia, r.aspect, r.workDir) : new Map();

  const assFile = path.join(r.workDir, "overlays.ass");
  await fs.writeFile(assFile, buildAss({ W, H, outDur, words, keyWords, beats, overlays: ov }));

  // ── inputs ──
  const args = ["-y", "-i", r.source];
  let next = 1;
  const silent = r.hasAudio ? -1 : next++;
  if (!r.hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  const music = ex.music !== "none" ? await musicFile(ex.music, r.workDir).catch(() => null) : null;
  const musicIn = music ? next++ : -1;
  if (music) args.push("-stream_loop", "-1", "-i", music);
  const sfxEvents: { at: number; kind: SfxKind; input: number }[] = [];
  if (ex.sfx) {
    for (const b of beats.slice(0, 8)) {
      const kind: SfxKind = clips.has(b) ? "whoosh" : st.card === "backdrop" ? "hit" : st.card === "headline" ? "whoosh" : "pop";
      const file = await sfx(kind).catch(() => null);
      if (!file) continue;
      args.push("-i", file);
      sfxEvents.push({ at: Math.max(0, b.at - (kind === "whoosh" ? 0.18 : 0.02)), kind, input: next++ });
    }
  }
  const brollIn: { beat: Beat; input: number; kind: "video" | "image" }[] = [];
  for (const [beat, clip] of clips) {
    if (clip.kind === "image") args.push("-loop", "1", "-framerate", String(fps), "-t", beat.dur.toFixed(2), "-i", clip.file);
    else args.push("-t", (beat.dur + 0.5).toFixed(2), "-i", clip.file);
    brollIn.push({ beat, input: next++, kind: clip.kind });
  }

  // ── video ──
  const f: string[] = [];
  keep.forEach((k, i) => {
    f.push(`[0:v]trim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    f.push(r.hasAudio ? `[0:a]atrim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]` : `[${silent}:a]atrim=duration=${(k.end - k.start).toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  f.push(`${keep.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${keep.length}:v=1:a=1[vc][ac]`);
  let v = "vb";
  f.push(`[vc]fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[vb]`);

  // Punch-in on each moment that isn't covered by b-roll (ease in over 120 ms, hold).
  const zooms = ex.motion ? beats.filter((b) => !clips.has(b)).map((b) => ({ a: b.at, b: Math.min(outDur, b.at + Math.max(1.6, b.dur + 0.4)) })) : [];
  if (zooms.length) {
    const z = zooms.map((p) => `between(it,${p.a.toFixed(2)},${p.b.toFixed(2)})*min(1,(it-${p.a.toFixed(2)})/0.12)`).join("+");
    f.push(`[${v}]zoompan=z='1+0.12*min(1,${z})':x='iw/2-(iw/zoom/2)':y='ih*0.4-(ih/zoom*0.4)':d=1:s=${W}x${H}:fps=${fps}[vz]`);
    v = "vz";
  }

  // B-roll cutaways with short fades.
  brollIn.forEach(({ beat, input, kind }, i) => {
    const d = beat.dur.toFixed(2);
    const kb = kind === "image" ? `,zoompan=z='min(zoom+0.0009,1.1)':d=${Math.ceil(beat.dur * fps)}:s=${W}x${H}:fps=${fps}` : "";
    f.push(`[${input}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${fps}${kb},trim=duration=${d},format=yuva420p,fade=t=in:st=0:d=0.2:alpha=1,fade=t=out:st=${(beat.dur - 0.2).toFixed(2)}:d=0.2:alpha=1,setpts=PTS-STARTPTS+${beat.at.toFixed(2)}/TB[br${i}]`);
    f.push(`[${v}][br${i}]overlay=eof_action=pass:enable='between(t,${beat.at.toFixed(2)},${(beat.at + beat.dur).toFixed(2)})'[vo${i}]`);
    v = `vo${i}`;
  });
  f.push(`[${v}]ass=${assFile}:fontsdir=${FONT_DIR},format=yuv420p[vout]`);

  // ── audio ──
  f.push(`[ac]aresample=48000,aformat=channel_layouts=mono${r.enhanceAudio ? `,${studioVoice()}` : ""},aformat=channel_layouts=stereo[voice]`);
  const mix: string[] = [];
  if (musicIn >= 0) {
    const gain = (0.5 * Math.max(0, Math.min(1, ex.musicVolume))).toFixed(3);
    f.push(`[voice]asplit=2[vmain][vkey]`);
    f.push(`[${musicIn}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${outDur.toFixed(2)},asetpts=PTS-STARTPTS,volume=${gain},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, outDur - 1.5).toFixed(2)}:d=1.5[mraw]`);
    f.push(`[mraw][vkey]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[mus]`);
    mix.push("[vmain]", "[mus]");
  } else mix.push("[voice]");
  sfxEvents.forEach((s, i) => {
    const ms = Math.round(s.at * 1000);
    f.push(`[${s.input}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.45,adelay=${ms}|${ms}[sx${i}]`);
    mix.push(`[sx${i}]`);
  });
  // -14 LUFS is where the social networks normalize to.
  const master = r.enhanceAudio ? "loudnorm=I=-14:TP=-1:LRA=11" : "alimiter=limit=0.95";
  f.push(mix.length > 1 ? `${mix.join("")}amix=inputs=${mix.length}:normalize=0:duration=first,${master},aresample=48000[aout]` : `${mix[0]}${master},aresample=48000[aout]`);

  args.push(
    "-filter_complex", f.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-t", outDur.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps),
    "-c:a", "aac", "-b:a", "192k", "-ac", "2",
    "-movflags", "+faststart",
    r.out
  );
  await runFfmpeg(args, { onTime: (s) => r.onProgress?.(0.05 + Math.min(0.94, (s / outDur) * 0.94)) });
  return { durationSec: Math.round(outDur * 100) / 100 };
}
