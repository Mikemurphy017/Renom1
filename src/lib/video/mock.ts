import { getJob, getUpload, newId, saveJob } from "./storage";
import type { VideoProcessor } from "./processor";
import { VideoProcessorError } from "./processor";
import type { CutKind, EditOptions, JobKind, JobResult, JobStatus, ProcessRequest, SuggestedCut, TranscriptWord } from "./types";

/**
 * Offline processor. Keeps everything on local disk, derives a realistic
 * transcript and cut list deterministically from the take (its id, length and
 * the script it was read from), simulates progress over a few seconds, and
 * hands back the original file as the "rendered" output.
 */

const STAGES: Record<JobKind, string[]> = {
  analyze: ["Queued…", "Transcribing your take…", "Finding dead air and retakes…", "Picking the key phrases…", "Placing captions…"],
  render: ["Queued…", "Cutting dead air…", "Burning in captions…", "Adding your overlays…", "Encoding MP4…"],
};
const DURATION_MS: Record<JobKind, number> = { analyze: 4500, render: 6000 };

interface MockJob {
  id: string;
  kind: JobKind;
  sourceId: string;
  createdAt: number;
  result: JobResult;
}

const FALLBACK_LINES = [
  "Here's something most people get wrong about their retirement plan.",
  "They plan for the average year, and markets almost never hand you an average year.",
  "A plan that flexes with the market is worth more than a plan that looks perfect on paper.",
  "If that's you, let's talk.",
];

/** FNV-1a: stable seed from a string. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** mulberry32: small seeded PRNG so the same take always gets the same edit. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS_PER_SEC = 2.6;
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

type Item = { kind: "speech" | CutKind; text: string; dur: number };

/** Lay a plausible read of the script over the take's real length. */
export function mockAnalysis(seedKey: string, durationSec: number, script: string[] | undefined, edit: EditOptions) {
  const rand = rng(hash(seedKey));
  const lines = script?.filter((l) => l.trim()).length ? script : FALLBACK_LINES;
  const sentences = lines.flatMap((l) => l.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [l]);
  const silence = (min: number, max: number): Item => {
    const d = +(min + rand() * (max - min)).toFixed(1);
    return { kind: "silence", text: `[pause ${d}s]`, dur: d };
  };

  const items: Item[] = [silence(0.8, 1.8)];
  let nominal = items[0].dur;
  for (let i = 0; i < sentences.length; i++) {
    // Stop reading once the take is used up (at least one sentence).
    if (i > 0 && nominal >= durationSec * 0.85) break;
    const add = (it: Item) => {
      items.push(it);
      nominal += it.dur;
    };
    if (i === 1) add({ kind: "retake", text: "So the first— sorry, let me start that again.", dur: 2.6 });
    if (i === 2) add({ kind: "filler", text: "um, you know,", dur: 1.1 });
    add({ kind: "speech", text: sentences[i], dur: Math.max(1, wordCount(sentences[i]) / WORDS_PER_SEC) });
    if (i === 0 || rand() < 0.2) add(silence(1.2, 2.6));
  }
  // Trailing dead air (folded into a pause that's already there).
  const tail = silence(1, 2.2);
  const last = items.at(-1)!;
  if (last.kind === "silence") last.dur += tail.dur;
  else items.push(tail);
  nominal += tail.dur;

  // Fit to the real duration so cuts line up with the actual file: stretch the
  // talking, keep pauses natural (unless the take is too short for them).
  const pauses = items.filter((it) => it.kind === "silence").reduce((a, it) => a + it.dur, 0);
  const talk = nominal - pauses;
  const kTalk = (durationSec - pauses) / talk;
  const uniform = kTalk < 0.6 || kTalk > 3;
  const scale = (it: Item) => it.dur * (uniform ? durationSec / nominal : it.kind === "silence" ? 1 : kTalk);
  const transcript: TranscriptWord[] = [];
  const cuts: SuggestedCut[] = [];
  let t = 0;
  items.forEach((it, i) => {
    const start = t;
    const end = i === items.length - 1 ? durationSec : t + scale(it);
    t = end;
    if (it.kind !== "speech") {
      const allowed = it.kind === "silence" ? edit.removeSilence : it.kind === "retake" ? edit.removeBadTakes : edit.removeFillers;
      if (allowed) cuts.push({ id: `c${cuts.length}`, kind: it.kind, start: round(start), end: round(end) });
    }
    if (it.kind === "silence") return;
    const words = it.text.split(/\s+/).filter(Boolean);
    const per = (end - start) / words.length;
    words.forEach((w, j) => transcript.push({ text: w, start: round(start + j * per), end: round(start + (j + 0.9) * per) }));
  });

  // Key phrases: numbers and money first, then the longest word of a few sentences.
  const clean = (w: string) => w.replace(/^[“"'(]+|[,.;:!?”"')]+$/g, "");
  const spoken = items.filter((it) => it.kind === "speech");
  const numeric = spoken.flatMap((it) => it.text.split(/\s+/).filter((w) => /[\d$%]/.test(w)).map(clean));
  const longest = spoken.filter((_, i) => i % 2 === 0).map((it) => it.text.split(/\s+/).map(clean).sort((a, b) => b.length - a.length)[0]).filter((w) => w && w.length >= 7);
  const keyPhrases = [...new Set([...numeric, ...longest])].slice(0, 6);

  return { transcript, cuts, keyPhrases };
}

const round = (n: number) => Math.round(n * 100) / 100;

export const mockProcessor: VideoProcessor = {
  id: "mock",
  readiness: () => ({ ok: true }),

  // Nothing to send anywhere: the file is already on our disk.
  async upload(source) {
    return { remoteId: source.id };
  },

  async process(req: ProcessRequest, source) {
    const base = mockAnalysis(source.id, source.durationSec, req.script, req.edit);
    const id = newId("job");
    const result: JobResult = {
      jobId: id,
      kind: req.kind,
      outputUrl: `/api/video/files/${source.id}`,
      durationSec: source.durationSec,
      transcript: base.transcript,
      // A render reports the cuts it applied (the advisor's final choice).
      cuts:
        req.kind === "render"
          ? (req.cuts ?? []).map((c, i) => ({ id: `r${i}`, kind: base.cuts.find((s) => s.start <= c.start && s.end >= c.end)?.kind ?? "silence", start: c.start, end: c.end }))
          : base.cuts,
      keyPhrases: req.overlays.keyPhrases ? base.keyPhrases : [],
    };
    await saveJob<MockJob>({ id, kind: req.kind, sourceId: source.id, createdAt: Date.now(), result });
    return { jobId: id };
  },

  async getStatus(jobId) {
    const job = await getJob<MockJob>(jobId);
    if (!job) return null;
    if (!(await getUpload(job.sourceId))) throw new VideoProcessorError("The source video is gone.", 410);
    const p = Math.min(1, (Date.now() - job.createdAt) / DURATION_MS[job.kind]);
    const stages = STAGES[job.kind];
    const status: JobStatus = {
      id: job.id,
      kind: job.kind,
      state: p >= 1 ? "done" : p < 0.08 ? "queued" : "processing",
      progress: round(p),
      stage: p >= 1 ? "Done" : stages[Math.min(stages.length - 1, Math.floor(p * stages.length))],
    };
    return status;
  },

  async getResult(jobId) {
    const status = await mockProcessor.getStatus(jobId);
    if (status?.state !== "done") return null;
    return (await getJob<MockJob>(jobId))?.result ?? null;
  },
};
