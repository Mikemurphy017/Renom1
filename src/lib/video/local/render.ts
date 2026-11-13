import { existsSync, promises as fs } from "node:fs";
import { PUSH_IN, cineOn, finishFilters, focusMaskExpr } from "../cine-look";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";
import { buildAss, normWord, type Beat } from "./ass";
import type { Graphic } from "./graphics";
import { planMoments } from "./plan";
import { footageFor } from "./broll";
import { musicBed, sfx, type SfxKind } from "./audio-beds";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import { getStyle, normalizeOverlays, type MusicMood } from "../styles";
import type { Aspect, OutputResolution, OverlayOptions, TimeRange, TranscriptWord } from "../types";
import { editedWords, keepRanges } from "../storyboard";

export { keepRanges };

/**
 * Renders the final MP4: keeps what the advisor kept, frames it for the
 * platform, then applies the edit style: punch-in zooms, b-roll cutaways,
 * captions and keyword cards, name title, end card, and a mix of the cleaned
 * voice with music (ducked under speech) and sound effects.
 * H.264 + AAC with faststart, which every network and Buffer accept.
 */

export const OUTPUT_SIZE: Record<Aspect, [number, number]> = { "9:16": [1080, 1920], "16:9": [1920, 1080] };
const OUTPUT_SIZE_4K: Record<Aspect, [number, number]> = { "9:16": [2160, 3840], "16:9": [3840, 2160] };

/**
 * The output frame. 4K only when the take fills a 4K frame without upscaling
 * (a 4K camera in the same orientation); anything smaller renders at 1080p.
 */
export function outputSize(aspect: Aspect, resolution: OutputResolution | undefined, src: { width: number; height: number }): [number, number] {
  if (resolution !== "2160p" || !src.width || !src.height) return OUTPUT_SIZE[aspect];
  const [W, H] = OUTPUT_SIZE_4K[aspect];
  return Math.max(W / src.width, H / src.height) <= 1.05 ? [W, H] : OUTPUT_SIZE[aspect];
}
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
/** RNNoise model for speech in recordings ("somnolent-hogwash", github.com/GregorR/rnnoise-models). */
const DENOISE_MODEL = path.join(process.cwd(), "assets", "audio", "voice-denoise.rnnn");

/** How a take sounds before cleanup: the room between words and the voice itself (dBFS). */
export interface VoiceMeasure {
  /** Noise floor: the quietest stretches, i.e. the room. */
  floor: number;
  /** Average level of the whole take. */
  rms: number;
  peak: number;
}

/** Reads the take's sound in one quick audio-only pass. Null when it can't tell. */
export async function measureVoice(source: string): Promise<VoiceMeasure | null> {
  const { stderr } = await runFfmpeg(["-nostats", "-i", source, "-vn", "-af", "aformat=channel_layouts=mono,highpass=f=75,astats=metadata=0:reset=0:measure_overall=Noise_floor+RMS_level+Peak_level:measure_perchannel=none", "-f", "null", "-"]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const num = (name: string) => {
    const m = new RegExp(`${name} dB: (-?[\\d.]+|-inf)`).exec(stderr);
    return m ? (m[1] === "-inf" ? -120 : Number(m[1])) : NaN;
  };
  const v = { floor: num("Noise floor"), rms: num("RMS level"), peak: num("Peak level") };
  return Object.values(v).every(Number.isFinite) ? v : null;
}

/**
 * "Studio sound" for the voice: rumble cut, neural denoise plus a spectral
 * pass, a touch of EQ (less mud, more presence and air), de-essing, gentle
 * compression, and an expander that drops the room between sentences
 * without touching the words. Loudness is set on the final mix.
 *
 * It's tuned to the take: a noisy room gets stronger noise reduction and a
 * deeper expander; a quiet room keeps more of the natural voice; a voice
 * recorded too quietly (a laptop mic across the desk) is brought up first so
 * the compressor and expander work on it as they would on a good mic.
 */
export function studioVoice(m: VoiceMeasure | null) {
  const room = !m ? "normal" : m.floor > -48 ? "noisy" : m.floor < -66 ? "quiet" : "normal";
  const hasModel = existsSync(DENOISE_MODEL);
  const spectral = room === "noisy" ? "afftdn=nf=-30:nr=22:tn=1" : room === "quiet" ? "afftdn=nf=-45:nr=8:tn=1" : "afftdn=nf=-35:nr=12:tn=1";
  const denoise = hasModel ? `arnndn=m=${DENOISE_MODEL}${room === "noisy" ? ":mix=1" : room === "quiet" ? ":mix=0.85" : ""},${spectral}` : spectral;
  // Lift a quiet take toward a -20 dBFS average before compression (at most +18 dB, and never past the peaks).
  const lift = m && m.rms < -26 ? Math.min(18, -20 - m.rms, -3 - m.peak) : 0;
  return [
    "highpass=f=75",
    ...(lift > 1 ? [`volume=${lift.toFixed(1)}dB`] : []),
    denoise,
    "equalizer=f=220:t=q:w=1.2:g=-2",
    "equalizer=f=3200:t=q:w=1.4:g=2.5",
    "highshelf=f=9500:g=2",
    "deesser=i=0.35",
    "acompressor=threshold=0.1:ratio=3:attack=10:release=150:makeup=1.6",
    room === "noisy" ? "agate=threshold=0.03:ratio=3:range=0.06:attack=5:release=250" : "agate=threshold=0.02:ratio=2.5:range=0.12:attack=5:release=250",
  ].join(",");
}

export interface RenderInput {
  source: string;
  out: string;
  workDir: string;
  durationSec: number;
  hasAudio: boolean;
  aspect: Aspect;
  /** Output frame (see outputSize). */
  size: [number, number];
  /** Frames per second of the take; 60 fps takes render at 60. */
  sourceFps: number;
  cuts: TimeRange[];
  transcript: TranscriptWord[];
  keyPhrases: string[];
  overlays: OverlayOptions;
  enhanceAudio: boolean;
  /**
   * The approved plan (see storyboard.ts): its moments and graphics are used
   * as they are. Without one, the render plans them itself.
   */
  plan?: { beats: Beat[]; graphics: Graphic[] };
  onProgress?: (p: number) => void;
}

// ── render ───────────────────────────────────────────────────────────────────

const MOODS: MusicMood[] = ["calm", "uplift", "pulse", "cinematic"];

async function musicFile(choice: string, dir: string): Promise<string | null> {
  if (choice.startsWith("media:")) {
    const id = choice.slice(6);
    if (!isMediaId(id)) return null;
    const r = await objects().read(mediaKey(id)).catch(() => null);
    if (!r) return null;
    // Let go of the bucket connection when it isn't the kind of file we can use.
    if (!r.contentType.startsWith("audio/")) {
      void r.body.cancel().catch(() => {});
      return null;
    }
    const file = path.join(dir, "music-upload");
    await fs.writeFile(file, new Uint8Array(await new Response(r.body).arrayBuffer()));
    return file;
  }
  return MOODS.includes(choice as MusicMood) ? musicBed(choice as MusicMood) : null;
}

export async function renderVideo(r: RenderInput): Promise<{ durationSec: number }> {
  const [W, H] = r.size;
  const ov = normalizeOverlays(r.overlays);
  const st = getStyle(ov.captions.style);
  const ex = ov.extras;
  const keep = keepRanges(r.cuts, r.durationSec);
  if (!keep.length) throw new Error("Everything was cut. Restore at least one phrase.");
  const outDur = keep.reduce((a, k) => a + (k.end - k.start), 0);
  const fps = r.sourceFps >= 50 ? 60 : 30;

  const words = editedWords(r.transcript, keep);

  // The big moments drive cards, zooms, b-roll and sound effects; graphics come
  // on top. The approved storyboard's plan when there is one (so the video is
  // what the advisor approved), otherwise planned here.
  r.onProgress?.(0.02);
  const { beats, graphics } = r.plan ?? (await planMoments(words, outDur, ov));
  if (!r.plan) console.info("[video] planned at render time");
  if (graphics.length) console.info(`[video] ${graphics.length} graphics`, graphics.map((g) => `${g.at.toFixed(1)}s ${g.kind}${g.title ? ` "${g.title}"` : ""}`).join(" · "));
  console.info(`[video] ${st.name}: ${beats.length} moments`, beats.map((b) => `${b.at.toFixed(1)}s ${b.keyword}${b.broll ? ` (b-roll: ${b.query})` : ""}`).join(" · "));
  const keyWords = new Set<string>([...(ov.keyPhrases ? r.keyPhrases : []), ...beats.map((b) => b.keyword)].flatMap((k) => k.split(/\s+/).map(normWord)).filter(Boolean));
  const clips = ex.broll ? await footageFor(beats, ex.brollMedia, r.aspect, r.workDir) : new Map();

  const assFile = path.join(r.workDir, "overlays.ass");
  // Overlays are laid out on the 1080p frame; libass scales them (fonts, borders,
  // positions) to the real frame, so a 4K render looks the same, only sharper.
  const [LW, LH] = OUTPUT_SIZE[r.aspect];
  await fs.writeFile(assFile, buildAss({ W: LW, H: LH, outDur, words, keyWords, beats, graphics, overlays: ov }));

  // The sound is mixed in its own (quick, audio-only) pass first. In one graph
  // with the picture, ffmpeg would hold ~3 s of decoded frames while loudnorm
  // looks ahead: about 1 GB more memory at 4K.

  // ── audio ──
  const aArgs = ["-y", "-i", r.source];
  let nextA = 1;
  const silent = r.hasAudio ? -1 : nextA++;
  if (!r.hasAudio) aArgs.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
  const music = ex.music !== "none" ? await musicFile(ex.music, r.workDir).catch(() => null) : null;
  const musicIn = music ? nextA++ : -1;
  if (music) aArgs.push("-stream_loop", "-1", "-i", music);
  const sfxEvents: { at: number; kind: SfxKind; input: number }[] = [];
  if (ex.sfx) {
    for (const b of beats.slice(0, 8)) {
      const kind: SfxKind = clips.has(b) ? "whoosh" : st.card === "backdrop" ? "hit" : st.card === "headline" ? "whoosh" : "pop";
      const file = await sfx(kind).catch(() => null);
      if (!file) continue;
      aArgs.push("-i", file);
      sfxEvents.push({ at: Math.max(0, b.at - (kind === "whoosh" ? 0.18 : 0.02)), kind, input: nextA++ });
    }
    // A whoosh as each graphic comes in, a pop for the small ones.
    for (const g of graphics.slice(0, 10)) {
      const kind: SfxKind = g.kind === "callout" || g.kind === "stat" ? "pop" : "whoosh";
      const file = await sfx(kind).catch(() => null);
      if (!file) continue;
      aArgs.push("-i", file);
      sfxEvents.push({ at: Math.max(0, g.at - (kind === "whoosh" ? 0.12 : 0)), kind, input: nextA++ });
    }
  }

  const af: string[] = [];
  keep.forEach((k, i) => {
    af.push(r.hasAudio ? `[0:a]atrim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]` : `[${silent}:a]atrim=duration=${(k.end - k.start).toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
  });
  af.push(`${keep.map((_, i) => `[a${i}]`).join("")}concat=n=${keep.length}:v=0:a=1[ac]`);
  const voice = r.enhanceAudio && r.hasAudio ? await measureVoice(r.source) : null;
  if (voice) console.info(`[video] voice: room ${voice.floor.toFixed(0)} dB, level ${voice.rms.toFixed(0)} dB, peak ${voice.peak.toFixed(0)} dB`);
  af.push(`[ac]aresample=48000,aformat=channel_layouts=mono${r.enhanceAudio ? `,${studioVoice(voice)}` : ""},aformat=channel_layouts=stereo[voice]`);
  const mix: string[] = [];
  if (musicIn >= 0) {
    const gain = (0.5 * Math.max(0, Math.min(1, ex.musicVolume))).toFixed(3);
    af.push(`[voice]asplit=2[vmain][vkey]`);
    af.push(`[${musicIn}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${outDur.toFixed(2)},asetpts=PTS-STARTPTS,volume=${gain},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, outDur - 1.5).toFixed(2)}:d=1.5[mraw]`);
    af.push(`[mraw][vkey]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[mus]`);
    mix.push("[vmain]", "[mus]");
  } else mix.push("[voice]");
  sfxEvents.forEach((s, i) => {
    const ms = Math.round(s.at * 1000);
    af.push(`[${s.input}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.45,adelay=${ms}|${ms}[sx${i}]`);
    mix.push(`[sx${i}]`);
  });
  // -14 LUFS is where the social networks normalize to.
  const master = r.enhanceAudio ? "loudnorm=I=-14:TP=-1:LRA=11" : "alimiter=limit=0.95";
  af.push(mix.length > 1 ? `${mix.join("")}amix=inputs=${mix.length}:normalize=0:duration=first,${master},aresample=48000[aout]` : `${mix[0]}${master},aresample=48000[aout]`);

  const mixFile = path.join(r.workDir, "mix.wav");
  aArgs.push("-filter_complex", af.join(";"), "-map", "[aout]", "-t", outDur.toFixed(3), "-c:a", "pcm_s16le", "-ac", "2", mixFile);
  await runFfmpeg(aArgs, { onTime: (s) => r.onProgress?.(0.03 + Math.min(0.05, (s / outDur) * 0.05)) });

  // ── video ──
  const args = ["-y", "-i", r.source];
  let next = 1;
  const brollIn: { beat: Beat; input: number; kind: "video" | "image" }[] = [];
  for (const [beat, clip] of clips) {
    if (clip.kind === "image") args.push("-loop", "1", "-framerate", String(fps), "-t", beat.dur.toFixed(2), "-i", clip.file);
    else args.push("-t", (beat.dur + 0.5).toFixed(2), "-i", clip.file);
    brollIn.push({ beat, input: next++, kind: clip.kind });
  }
  const mixIn = next++;
  args.push("-i", mixFile);
  // The cinematic look: a soft-focus mask (made once, as a still) for the edges of the frame.
  const cine = cineOn(ex.cinematic) ? ex.cinematic : null;
  let maskIn = -1;
  if (cine?.softFocus) {
    const mask = path.join(r.workDir, "focus-mask.png");
    try {
      await runFfmpeg(["-y", "-f", "lavfi", "-i", `color=black:s=${W}x${H}`, "-vf", `format=gray,geq=lum='${focusMaskExpr(H > W)}'`, "-frames:v", "1", mask]);
      // Decoded once and repeated in memory (looping the file would decode the PNG every frame).
      args.push("-i", mask);
      maskIn = next++;
    } catch (e) {
      console.warn("[video] soft-focus mask failed; rendering without it:", (e as Error).message);
    }
  }

  const f: string[] = [];
  // Frame the take first: every filter after this works on W×H at the output
  // rate, so a 4K or 60 fps take rendered at 1080p costs little more than a
  // 1080p one (decoding aside).
  const pieces = keep.map((_, i) => `[s${i}]`).join("");
  f.push(`[0:v]fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1${keep.length > 1 ? `,split=${keep.length}` : ""}${pieces}`);
  keep.forEach((k, i) => f.push(`[s${i}]trim=start=${k.start.toFixed(3)}:end=${k.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`));
  f.push(keep.length > 1 ? `${keep.map((_, i) => `[v${i}]`).join("")}concat=n=${keep.length}:v=1:a=0[vb]` : `[v0]null[vb]`);
  let v = "vb";

  // Soft focus: a blurred copy shows through the mask at the edges; the face stays sharp.
  // maskedmerge blends plane by plane, so the grey mask is copied into all three
  // planes once, then repeated in memory: far cheaper than an alpha overlay.
  if (maskIn >= 0) {
    const blur = Math.max(3, Math.round(Math.min(W, H) / 220));
    f.push(
      `[${maskIn}:v]format=gray,scale=${W}:${H},split=3[my][mu][mv]`,
      `[mu]scale=${W >> 1}:${H >> 1}[mu2]`,
      `[mv]scale=${W >> 1}:${H >> 1}[mv2]`,
      // Both streams on the same clock, frame for frame: rounding a still's
      // timestamps into another timebase would shift the picture against the sound.
      `[my][mu2][mv2]mergeplanes=0x001020:yuv420p,loop=loop=-1:size=1,settb=1/${fps},setpts=N[mk]`,
      `[${v}]format=yuv420p,settb=1/${fps},setpts=N,split[fs][fb]`,
      `[fb]scale=${W >> 1}:${H >> 1},boxblur=${blur}:2,scale=${W}:${H}[fbl]`,
      `[fs][fbl][mk]maskedmerge[vf]`
    );
    v = "vf";
  }

  // With the cinematic push-in, the frame also tightens slowly across the whole video.
  const zooms = ex.motion ? beats.filter((b) => !clips.has(b)).map((b) => ({ a: b.at, b: Math.min(outDur, b.at + Math.max(1.6, b.dur + 0.4)) })) : [];
  const push = cine?.pushIn ? `+${PUSH_IN}*min(1,it/${Math.max(1, outDur).toFixed(2)})` : "";
  if (zooms.length || push) {
    const z = zooms.map((p) => `between(it,${p.a.toFixed(2)},${p.b.toFixed(2)})*min(1,(it-${p.a.toFixed(2)})/0.12)`).join("+");
    f.push(`[${v}]zoompan=z='1${zooms.length ? `+0.12*min(1,${z})` : ""}${push}':x='iw/2-(iw/zoom/2)':y='ih*0.4-(ih/zoom*0.4)':d=1:s=${W}x${H}:fps=${fps}[vz]`);
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
  // Grade, vignette and grain over the whole picture, b-roll included; captions and graphics stay clean on top.
  const finish = cine ? finishFilters(cine) : [];
  if (finish.length) {
    f.push(`[${v}]${finish.join(",")}[vg]`);
    v = "vg";
  }
  f.push(`[${v}]ass=${assFile}:fontsdir=${FONT_DIR},format=yuv420p[vout]`);

  args.push(
    "-filter_complex", f.join(";"),
    "-map", "[vout]", "-map", `${mixIn}:a`,
    "-t", outDur.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps),
    // x264 keeps frames per thread (~75 MB each at 4K) and sizes its pool from
    // the host's cores, which on a shared host can be dozens: cap it.
    "-threads:v", W * H > 2_100_000 ? "8" : "16",
    "-c:a", "aac", "-b:a", "192k", "-ac", "2",
    "-movflags", "+faststart",
    r.out
  );
  await runFfmpeg(args, { onTime: (s) => r.onProgress?.(0.08 + Math.min(0.91, (s / outDur) * 0.91)) });
  return { durationSec: Math.round(outDur * 100) / 100 };
}
