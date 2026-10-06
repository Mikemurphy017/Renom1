import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { TimeRange, TranscriptWord } from "../types";

/**
 * Offline speech recognition (sherpa-onnx, GigaSpeech zipformer) with a
 * timestamp for every word, so captions land when each word is said.
 * The model is fetched on `npm install` (scripts/fetch-asr-model.mjs).
 * Returns null when the model or the native module isn't available, and the
 * editor falls back to timing the script from the audio alone.
 */

const MODEL_DIR = path.resolve(process.env.ASR_MODEL_DIR || path.join(process.cwd(), ".models", "asr-gigaspeech"));
const FILES = {
  encoder: "encoder-epoch-30-avg-1.int8.onnx",
  decoder: "decoder-epoch-30-avg-1.int8.onnx",
  joiner: "joiner-epoch-30-avg-1.int8.onnx",
  tokens: "tokens.txt",
};

interface Recognizer {
  createStream(): { acceptWaveform(w: { samples: Float32Array; sampleRate: number }): void };
  decode(s: unknown): void;
  getResult(s: unknown): { text: string; tokens: string[]; timestamps: number[] };
}

let recognizer: Recognizer | null | undefined;

export function asrAvailable() {
  return Object.values(FILES).every((f) => existsSync(path.join(MODEL_DIR, f)));
}

function getRecognizer(): Recognizer | null {
  if (recognizer !== undefined) return recognizer;
  if (!asrAvailable()) {
    console.warn(`[asr] no speech model in ${MODEL_DIR}; captions will be timed from the audio. Run: node scripts/fetch-asr-model.mjs`);
    return (recognizer = null);
  }
  try {
    const sherpa = createRequire(import.meta.url)("sherpa-onnx-node");
    const f = (k: keyof typeof FILES) => path.join(MODEL_DIR, FILES[k]);
    recognizer = new sherpa.OfflineRecognizer({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: { encoder: f("encoder"), decoder: f("decoder"), joiner: f("joiner") },
        tokens: f("tokens"),
        numThreads: Math.max(1, Math.min(4, Number(process.env.ASR_THREADS) || 2)),
        provider: "cpu",
        debug: 0,
      },
      decodingMethod: "greedy_search",
    }) as Recognizer;
  } catch (e) {
    console.warn("[asr] couldn't load the speech recognizer:", (e as Error).message);
    recognizer = null;
  }
  return recognizer;
}

export interface HeardWord {
  text: string;
  start: number;
  end: number;
}

const SR = 16000;
const MAX_CHUNK = 20; // seconds per decode; keeps memory flat on long takes

/** Group the talking into chunks of at most ~20 s, split at pauses. */
function chunksOf(speech: TimeRange[], dur: number): TimeRange[] {
  const out: TimeRange[] = [];
  for (const s of speech) {
    const last = out.at(-1);
    if (last && s.start - last.end < 0.6 && s.end - last.start <= MAX_CHUNK) last.end = s.end;
    else out.push({ ...s });
  }
  // A single stretch longer than the limit gets cut into equal parts.
  return out.flatMap((c) => {
    const n = Math.ceil((c.end - c.start) / MAX_CHUNK);
    if (n <= 1) return [c];
    const len = (c.end - c.start) / n;
    return Array.from({ length: n }, (_, i) => ({ start: c.start + i * len, end: Math.min(c.end, c.start + (i + 1) * len) }));
  }).map((c) => ({ start: Math.max(0, c.start - 0.25), end: Math.min(dur, c.end + 0.25) }));
}

/** What was actually said, word by word, with times in seconds of the take. */
export function transcribe(samples: Int16Array, speech: TimeRange[], dur: number): HeardWord[] | null {
  const rec = getRecognizer();
  if (!rec) return null;
  const words: HeardWord[] = [];
  for (const c of chunksOf(speech, dur)) {
    const from = Math.floor(c.start * SR);
    const to = Math.min(samples.length, Math.ceil(c.end * SR));
    if (to - from < SR * 0.3) continue;
    const f32 = new Float32Array(to - from);
    for (let i = 0; i < f32.length; i++) f32[i] = samples[from + i] / 32768;
    const stream = rec.createStream();
    stream.acceptWaveform({ samples: f32, sampleRate: SR });
    rec.decode(stream);
    const r = rec.getResult(stream);
    const chunkWords: HeardWord[] = [];
    r.tokens.forEach((tok, i) => {
      const t = c.start + (r.timestamps[i] ?? 0);
      if (tok.startsWith(" ") || tok.startsWith("▁") || !chunkWords.length) chunkWords.push({ text: tok.replace(/^[ ▁]+/, ""), start: t, end: t + 0.2 });
      else {
        const w = chunkWords.at(-1)!;
        w.text += tok;
        w.end = t + 0.2;
      }
    });
    // A word lasts until the next one starts (capped), so captions don't flicker.
    chunkWords.forEach((w, i) => {
      const next = chunkWords[i + 1];
      w.end = Math.min(next ? next.start : w.end + 0.3, w.start + 1.2, c.end);
    });
    words.push(...chunkWords.filter((w) => w.text.trim()));
  }
  return words.map((w) => ({ text: w.text.toLowerCase(), start: round(w.start), end: round(Math.max(w.end, w.start + 0.08)) }));
}

const round = (n: number) => Math.round(n * 100) / 100;
const norm = (w: string) => w.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}'$%]/gu, "");

/** Spoken numbers and the digits a script writes them as count as the same word. */
const NUMBER_WORDS: Record<string, string> = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100" };
function same(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y || NUMBER_WORDS[x] === y || NUMBER_WORDS[y] === x) return true;
  if (x.replace(/'/g, "") === y.replace(/'/g, "")) return true;
  // Close spellings (names, plurals): small edit distance relative to length.
  if (Math.min(x.length, y.length) >= 4 && levenshtein(x, y) <= Math.floor(Math.max(x.length, y.length) / 4)) return true;
  return false;
}

function levenshtein(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/**
 * Caption words = what was said, timed by the recognizer, spelled like the
 * script wherever the two agree (names, numbers, punctuation and casing).
 * Script lines the advisor skipped are dropped; ad-libs are kept.
 */
export function alignToScript(heard: HeardWord[], script: string[] | undefined): TranscriptWord[] {
  const sw = (script ?? []).join(" ").split(/\s+/).filter(Boolean);
  if (!sw.length) return heard.map((w) => ({ ...w }));
  const n = sw.length;
  const m = heard.length;
  // Edit-distance alignment: match 0, substitute 1, skip either side 1.
  const cost = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 diag, 2 up (script skipped), 3 left (ad-lib)
  for (let i = 1; i <= n; i++) {
    cost[i][0] = i;
    move[i][0] = 2;
  }
  for (let j = 1; j <= m; j++) {
    cost[0][j] = j;
    move[0][j] = 3;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = cost[i - 1][j - 1] + (same(sw[i - 1], heard[j - 1].text) ? 0 : 1);
      const up = cost[i - 1][j] + 1;
      const left = cost[i][j - 1] + 1;
      const best = diag <= up && diag <= left ? 1 : up <= left ? 2 : 3;
      cost[i][j] = best === 1 ? diag : best === 2 ? up : left;
      move[i][j] = best;
    }
  }
  type Aligned = TranscriptWord & { kind: "match" | "sub" | "ins"; script?: string };
  const out: Aligned[] = [];
  let i = n;
  let j = m;
  let matched = 0;
  while (i > 0 || j > 0) {
    const mv = move[i][j];
    if (mv === 1) {
      const h = heard[j - 1];
      const match = same(sw[i - 1], h.text);
      if (match) matched++;
      out.push({ text: match ? sw[i - 1] : h.text, start: h.start, end: h.end, kind: match ? "match" : "sub", script: sw[i - 1] });
      i--;
      j--;
    } else if (mv === 2) {
      i--; // a script word that wasn't said
    } else {
      const h = heard[j - 1];
      out.push({ text: h.text, start: h.start, end: h.end, kind: "ins" });
      j--;
    }
  }
  out.reverse();
  // If the advisor went fully off-script, show exactly what was said.
  if (matched < Math.min(n, m) * 0.3) return heard.map((w) => ({ ...w }));
  // A one-for-one swap usually means the recognizer misheard a script word (names,
  // jargon: "Roth" heard as "ruffs"): use the script's spelling when the words are
  // close, or when the swap sits between words that matched.
  return out.map((w, k) => {
    if (w.kind !== "sub" || !w.script) return { text: w.text, start: w.start, end: w.end };
    const x = norm(w.script);
    const y = norm(w.text);
    const close = levenshtein(x, y) <= Math.max(2, Math.ceil(Math.max(x.length, y.length) * 0.6));
    const anchored = (out[k - 1]?.kind ?? "match") === "match" && (out[k + 1]?.kind ?? "match") === "match";
    return { text: close || anchored ? w.script : w.text, start: w.start, end: w.end };
  });
}

/**
 * Restarts: a run of 3+ words said twice in a row within a few seconds
 * ("the first thing… the first thing you should") means the first try was a retake.
 */
export function findRetakes(heard: HeardWord[]): TimeRange[] {
  const out: TimeRange[] = [];
  const t = heard.map((w) => norm(w.text));
  const phrase = (from: number, len: number) => t.slice(from, from + len).join(" ");
  let i = 0;
  scan: while (i < heard.length) {
    for (let len = 6; len >= 3; len--) {
      if (i + len > heard.length) continue;
      const gram = phrase(i, len);
      // The same words starting again shortly after (allowing a few words of the abandoned try in between).
      for (let k = i + len; k <= Math.min(heard.length - len, i + len + 8); k++) {
        if (phrase(k, len) !== gram) continue;
        const gap = heard[k].start - heard[i].start;
        if (gap > 0 && gap < 12) {
          out.push({ start: heard[i].start, end: heard[k].start });
          i = k;
          continue scan;
        }
      }
    }
    i++;
  }
  return out;
}
