import type { JobResult } from "./types";
import { segmentsFromResult, type Segment } from "./edit-model";

/**
 * Clips from a long recording: the transcript as numbered sentences (what
 * Claude picks from), and a clip's range turned into the Edit step's segments
 * (everything outside it cut, the usual pause and retake cuts inside it).
 */

export interface Sentence {
  n: number;
  start: number;
  end: number;
  text: string;
}

export function sentencesOf(r: JobResult): Sentence[] {
  const words = [...r.transcript].sort((a, b) => a.start - b.start);
  const out: Sentence[] = [];
  let run: typeof words = [];
  const flush = () => {
    if (run.length) out.push({ n: out.length + 1, start: run[0].start, end: run.at(-1)!.end, text: run.map((w) => w.text).join(" ") });
    run = [];
  };
  for (const w of words) {
    run.push(w);
    if (/[.!?]["”]?$/.test(w.text) || run.length >= 35) flush();
  }
  flush();
  return out;
}

/** A recording long enough to be worth clipping. */
export const clippable = (durationSec: number) => durationSec >= 150;

export interface ClipRange {
  start: number;
  end: number;
}

/** Sentence numbers from Claude → time ranges: in order, 15–120 s long, not overlapping. */
export function rangesFrom(picks: { first: number; last: number }[], sentences: Sentence[]): (ClipRange & { index: number })[] {
  const byN = new Map(sentences.map((s) => [s.n, s]));
  const out: (ClipRange & { index: number })[] = [];
  picks.forEach((p, index) => {
    const a = byN.get(Math.min(p.first, p.last));
    const b = byN.get(Math.max(p.first, p.last));
    if (!a || !b) return;
    const start = Math.max(0, a.start - 0.15);
    const end = b.end + 0.25;
    if (end - start < 15 || end - start > 120) return;
    if (out.some((o) => start < o.end && end > o.start)) return;
    out.push({ start, end, index });
  });
  return out.sort((x, y) => x.start - y.start);
}

/** The Edit step's segments for a clip: outside the range cut, inside as the AI edit suggested. */
export function clipSegments(r: JobResult, range: ClipRange): Segment[] {
  let t = 0;
  return segmentsFromResult(r).map((s) => {
    const mid = t + s.dur / 2;
    t += s.dur;
    return mid < range.start || mid > range.end ? { ...s, removed: true } : s;
  });
}

/** Seconds a clip runs once its cuts are taken out. */
export const keptSeconds = (segments: Segment[]) => segments.reduce((a, s) => a + (s.removed ? 0 : s.dur), 0);
