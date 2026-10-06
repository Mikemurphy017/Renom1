import { runFfmpeg } from "./ffmpeg";
import type { EditOptions, SuggestedCut, TimeRange, TranscriptWord } from "../types";

/**
 * Listens to the take: measures loudness every 50 ms, finds the pauses, and
 * lays the script the advisor read over the stretches where they were talking.
 * No speech recognition here, so it doesn't invent retakes or filler words.
 */

const SR = 16000;
const WIN = 0.05; // seconds per loudness window
const MIN_PAUSE = 0.7; // shorter pauses are part of natural speech
const PAD = 0.15; // keep a breath either side of a cut

export interface Analysis {
  durationSec: number;
  /** Loudness every 0.1 s, 0–1, for the timeline waveform. */
  levels: number[];
  speech: TimeRange[];
  cuts: SuggestedCut[];
  transcript: TranscriptWord[];
  keyPhrases: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;

async function loudness(file: string): Promise<number[]> {
  const { stdout } = await runFfmpeg(["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(SR), "-f", "s16le", "pipe:1"], { captureStdout: true });
  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 2));
  const per = Math.round(SR * WIN);
  const db: number[] = [];
  for (let i = 0; i < samples.length; i += per) {
    let sum = 0;
    const end = Math.min(samples.length, i + per);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    const rms = Math.sqrt(sum / Math.max(1, end - i)) / 32768;
    db.push(20 * Math.log10(rms + 1e-9));
  }
  return db;
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] ?? -90;
};

export async function analyzeTake(file: string, durationSec: number, hasAudio: boolean, script: string[] | undefined, edit: EditOptions): Promise<Analysis> {
  const db = hasAudio ? await loudness(file) : [];
  const dur = durationSec || db.length * WIN;

  // Adaptive threshold between the room's noise floor and the advisor's voice.
  const floor = pct(db, 0.1);
  const voice = pct(db, 0.9);
  const threshold = floor + Math.max(6, (voice - floor) * 0.35);
  const quietRuns: TimeRange[] = [];
  let runStart = -1;
  db.forEach((d, i) => {
    const quiet = d < threshold;
    if (quiet && runStart < 0) runStart = i;
    if ((!quiet || i === db.length - 1) && runStart >= 0) {
      const end = quiet ? i + 1 : i;
      if ((end - runStart) * WIN >= MIN_PAUSE) quietRuns.push({ start: runStart * WIN, end: Math.min(dur, end * WIN) });
      runStart = -1;
    }
  });
  // With almost no dynamic range there is nothing reliable to cut.
  const usable = hasAudio && voice - floor >= 8;
  const pauses = usable ? quietRuns : [];

  const cuts: SuggestedCut[] = [];
  if (edit.removeSilence) {
    for (const p of pauses) {
      const start = p.start <= 0.05 ? 0 : p.start + PAD;
      const end = p.end >= dur - 0.05 ? dur : p.end - PAD;
      if (end - start >= 0.3) cuts.push({ id: `c${cuts.length}`, kind: "silence", start: round(start), end: round(end) });
    }
  }

  // Talking = everything that isn't a pause.
  const speech: TimeRange[] = [];
  let t = 0;
  for (const p of pauses) {
    if (p.start - t > 0.2) speech.push({ start: t, end: p.start });
    t = Math.max(t, p.end);
  }
  if (dur - t > 0.2) speech.push({ start: t, end: dur });
  if (!speech.length) speech.push({ start: 0, end: dur });

  const transcript = layScript(script, speech);
  const levels: number[] = [];
  for (let i = 0; i < db.length; i += 2) levels.push(round(Math.max(0, Math.min(1, (Math.max(db[i], db[i + 1] ?? -90) + 60) / 60))));

  return { durationSec: round(dur), levels, speech, cuts, transcript, keyPhrases: keyPhrasesOf(script) };
}

/** Spread the script's words across the talking stretches, weighted by word length. */
function layScript(script: string[] | undefined, speech: TimeRange[]): TranscriptWord[] {
  const words = (script ?? []).join(" ").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const talk = speech.reduce((a, s) => a + (s.end - s.start), 0);
  const weight = (w: string) => 1 + w.replace(/[^\p{L}\p{N}]/gu, "").length * 0.12 + (/[.!?]["”]?$/.test(w) ? 0.6 : /[,;:]$/.test(w) ? 0.3 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  const out: TranscriptWord[] = [];
  let si = 0;
  let pos = speech[0].start;
  for (const w of words) {
    let d = (weight(w) / total) * talk;
    let start = pos;
    // Carry into the next talking stretch when this one is used up.
    while (si < speech.length - 1 && start >= speech[si].end - 0.01) {
      si++;
      start = pos = speech[si].start;
    }
    const end = Math.min(speech[si].end, start + d);
    d = end - start;
    out.push({ text: w, start: round(start), end: round(start + d * 0.92) });
    pos = end;
  }
  return out;
}

function keyPhrasesOf(script: string[] | undefined) {
  const clean = (w: string) => w.replace(/^[“"'(]+|[,.;:!?”"')]+$/g, "");
  const words = (script ?? []).join(" ").split(/\s+/).map(clean).filter(Boolean);
  const numeric = words.filter((w) => /[\d$%]/.test(w));
  return [...new Set(numeric)].slice(0, 6);
}
