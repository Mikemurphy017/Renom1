import type { JobResult, JobState, JobStatus, ProcessRequest, SuggestedCut, TranscriptWord } from "../types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MIRAGE (Captions) API MAPPING — UNVERIFIED
 * ─────────────────────────────────────────────────────────────────────────────
 *  TODO(mirage-docs): EVERYTHING in this file is a placeholder.
 *
 *  It was written without access to the Mirage documentation (the network
 *  this was built on blocks captions.ai and *.mirage.app). The only confirmed
 *  facts are:
 *    - the docs index is https://captions.ai/llms.txt
 *    - every request carries an `x-api-key` header (MIRAGE_API_KEY)
 *
 *  Before setting MIRAGE_VERIFIED=1, confirm each item below against the docs
 *  and replace the placeholder values:
 *    1. Base URL                            → MIRAGE_API_URL / DEFAULT_BASE_URL
 *    2. How a video is uploaded             → PATHS.upload, uploadRequest(), parseUpload()
 *       (direct multipart? signed URL then PUT? a public URL the API fetches?)
 *    3. How captions / AI edit / overlays are requested, and which of our
 *       options exist there                 → PATHS.process, processBody()
 *    4. How a job is polled, its state names and progress field
 *                                           → PATHS.status, parseStatus(), STATE_MAP
 *    5. Where the output URL, transcript (word timings) and removed
 *       segments come back                  → PATHS.result, parseResult()
 *    6. Size / duration / format limits, rate limits, webhooks, URL expiry
 *
 *  Nothing else in the app knows about Mirage: only this file and ./index.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// TODO(mirage-docs): confirm the API base URL.
export const DEFAULT_BASE_URL = "https://api.mirage.app";

// TODO(mirage-docs): every path below is a placeholder, not a real endpoint.
export const PATHS = {
  upload: "/TODO-mirage-docs/upload",
  process: "/TODO-mirage-docs/process",
  status: (jobId: string) => `/TODO-mirage-docs/jobs/${encodeURIComponent(jobId)}`,
  result: (jobId: string) => `/TODO-mirage-docs/jobs/${encodeURIComponent(jobId)}/result`,
};

/** The one confirmed piece: auth is an `x-api-key` header. */
export const authHeaders = (key: string) => ({ "x-api-key": key });

// TODO(mirage-docs): confirm the upload mechanism and the form field name.
export function uploadRequest(file: Blob, filename: string): { body: BodyInit; headers: Record<string, string> } {
  const form = new FormData();
  form.append("file", file, filename); // placeholder field name
  return { body: form, headers: {} };
}

// TODO(mirage-docs): confirm where the uploaded video's id is returned.
export function parseUpload(json: unknown): string {
  const j = json as Record<string, unknown>;
  const id = j?.id ?? j?.video_id ?? j?.asset_id; // placeholder field names
  if (typeof id !== "string") throw new Error("Mirage upload response did not include an id (mapping unverified).");
  return id;
}

/**
 * Our options → Mirage request body.
 * TODO(mirage-docs): every key here is a placeholder. Confirm which features
 * Mirage offers (caption templates, position, highlight color, silence /
 * bad-take / filler removal, audio enhancement, lower thirds, emphasis, end
 * cards) and how a render with the advisor's own cut list is requested.
 * Options Mirage doesn't support should be dropped here, not guessed.
 */
export function processBody(req: ProcessRequest, remoteSourceId: string): Record<string, unknown> {
  return {
    source_id: remoteSourceId,
    mode: req.kind,
    aspect_ratio: req.aspect,
    script: req.script,
    edit: {
      remove_silence: req.edit.removeSilence,
      remove_bad_takes: req.edit.removeBadTakes,
      remove_fillers: req.edit.removeFillers,
      enhance_audio: req.edit.enhanceAudio,
    },
    captions: req.overlays.captions.enabled
      ? { style: req.overlays.captions.style, position: req.overlays.captions.position, highlight_color: req.overlays.captions.color }
      : null,
    overlays: {
      lower_third: req.overlays.lowerThird.enabled ? { name: req.overlays.lowerThird.name, title: req.overlays.lowerThird.credentials, firm: req.overlays.lowerThird.firm } : null,
      key_phrase_emphasis: req.overlays.keyPhrases,
      end_card: req.overlays.endCard.enabled ? { headline: req.overlays.endCard.headline, cta: req.overlays.endCard.cta } : null,
    },
    cuts: req.cuts?.map((c) => ({ start: c.start, end: c.end })),
  };
}

// TODO(mirage-docs): confirm where the job id is returned.
export function parseProcess(json: unknown): string {
  const j = json as Record<string, unknown>;
  const id = j?.id ?? j?.job_id; // placeholder field names
  if (typeof id !== "string") throw new Error("Mirage process response did not include a job id (mapping unverified).");
  return id;
}

// TODO(mirage-docs): confirm Mirage's job state names.
const STATE_MAP: Record<string, JobState> = {
  queued: "queued",
  pending: "queued",
  processing: "processing",
  running: "processing",
  completed: "done",
  succeeded: "done",
  done: "done",
  failed: "failed",
  error: "failed",
};

// TODO(mirage-docs): confirm the status/progress fields.
export function parseStatus(jobId: string, kind: ProcessRequest["kind"], json: unknown): JobStatus {
  const j = json as Record<string, unknown>;
  const raw = String(j?.status ?? j?.state ?? "processing").toLowerCase();
  const state = STATE_MAP[raw] ?? "processing";
  const pct = typeof j?.progress === "number" ? (j.progress > 1 ? j.progress / 100 : j.progress) : state === "done" ? 1 : 0;
  return {
    id: jobId,
    kind,
    state,
    progress: Math.max(0, Math.min(1, pct)),
    stage: state === "done" ? "Done" : state === "failed" ? "Failed" : state === "queued" ? "Queued…" : "Processing…",
    error: state === "failed" ? String(j?.error ?? "Mirage reported a failure") : undefined,
  };
}

// TODO(mirage-docs): confirm the output URL, transcript and cut list shapes.
export function parseResult(jobId: string, kind: ProcessRequest["kind"], json: unknown): JobResult {
  const j = json as Record<string, unknown>;
  const words = Array.isArray(j?.words) ? (j.words as Record<string, unknown>[]) : [];
  const segs = Array.isArray(j?.removed_segments) ? (j.removed_segments as Record<string, unknown>[]) : [];
  const transcript: TranscriptWord[] = words.map((w) => ({ text: String(w.text ?? w.word ?? ""), start: Number(w.start), end: Number(w.end) })).filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end));
  const cuts: SuggestedCut[] = segs
    .map((s, i) => ({ id: `m${i}`, kind: (["silence", "retake", "filler"].includes(String(s.reason)) ? s.reason : "silence") as SuggestedCut["kind"], start: Number(s.start), end: Number(s.end) }))
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start);
  return {
    jobId,
    kind,
    outputUrl: typeof j?.output_url === "string" ? j.output_url : undefined,
    durationSec: Number(j?.duration ?? transcript.at(-1)?.end ?? 0),
    transcript,
    cuts,
    keyPhrases: Array.isArray(j?.key_phrases) ? (j.key_phrases as unknown[]).map(String) : [],
  };
}
