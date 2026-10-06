import { BRAND } from "@/lib/brand";
import type { AdvisorProfile, VideoFormat } from "@/lib/types";
import type { CutKind, JobResult, OverlayOptions, TimeRange } from "./types";

/** One clickable phrase in the Edit step's transcript. Segments are contiguous from 0. */
export interface Segment {
  id: string;
  text: string;
  kind: "speech" | CutKind;
  dur: number;
  removed: boolean;
}

export function defaultOverlays(profile: AdvisorProfile, format: VideoFormat): OverlayOptions {
  return {
    captions: { enabled: true, style: "bold", position: format === "short" ? "middle" : "bottom", color: BRAND.captionColor },
    lowerThird: { enabled: true, name: profile.name, credentials: profile.credentials, firm: profile.firm },
    keyPhrases: true,
    endCard: { enabled: true, headline: `${profile.name}, ${profile.credentials}`, cta: "Follow for more like this" },
  };
}

type Span = { kind: Segment["kind"]; start: number; end: number; text: string };

/** Turn a processor result (word timings + suggested cuts) into transcript segments. */
export function segmentsFromResult(r: JobResult): Segment[] {
  const cuts = [...r.cuts].sort((a, b) => a.start - b.start);
  const inCut = (t: number) => cuts.find((c) => t >= c.start && t < c.end);
  const spans: Span[] = cuts.map((c) => {
    const words = r.transcript.filter((w) => w.start >= c.start && w.start < c.end).map((w) => w.text);
    return { kind: c.kind, start: c.start, end: c.end, text: words.length ? words.join(" ") : `[${c.kind === "silence" ? "pause" : c.kind} ${(c.end - c.start).toFixed(1)}s]` };
  });

  // Kept speech: runs of words outside cuts, split at sentence ends (or ~20 words).
  let run: typeof r.transcript = [];
  const flush = () => {
    if (run.length) spans.push({ kind: "speech", start: run[0].start, end: run.at(-1)!.end, text: run.map((w) => w.text).join(" ") });
    run = [];
  };
  for (const w of [...r.transcript].sort((a, b) => a.start - b.start)) {
    if (inCut(w.start)) {
      flush();
      continue;
    }
    run.push(w);
    if (/[.!?]["”]?$/.test(w.text) || run.length >= 20) flush();
  }
  flush();
  spans.sort((a, b) => a.start - b.start);
  if (!spans.length) return [{ id: "s0", text: "[no speech found]", kind: "silence", dur: Math.max(1, r.durationSec), removed: false }];

  // Close the gaps so segments are contiguous; speech absorbs the small gaps
  // between words, suggested cuts keep their exact bounds where possible.
  const end = Math.max(r.durationSec, spans.at(-1)!.end);
  spans[0].start = 0;
  for (let i = 0; i < spans.length; i++) {
    const cur = spans[i];
    const next = spans[i + 1];
    const until = next ? next.start : end;
    if (until <= cur.end) {
      if (next) next.start = cur.end;
      continue;
    }
    if (cur.kind === "speech" || !next || next.kind !== "speech") cur.end = until;
    else next.start = cur.end;
  }
  return spans
    .filter((s) => s.end - s.start > 0.01)
    .map((s, i) => ({ id: `r${i}`, text: s.text, kind: s.kind, dur: s.end - s.start, removed: s.kind !== "speech" }));
}

/** Removed segments → merged time ranges to send with a render. */
export function cutsFromSegments(segments: Segment[]): TimeRange[] {
  const out: TimeRange[] = [];
  let t = 0;
  for (const s of segments) {
    const start = t;
    t += s.dur;
    if (!s.removed) continue;
    const last = out.at(-1);
    if (last && Math.abs(last.end - start) < 0.001) last.end = round(t);
    else out.push({ start: round(start), end: round(t) });
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
