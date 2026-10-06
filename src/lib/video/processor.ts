import type { JobResult, JobStatus, ProcessorId, ProcessRequest } from "./types";
import type { StoredUpload } from "./storage";

/**
 * The seam between Renom and whatever service edits the videos.
 * Server-only. Every provider (the offline mock, Mirage, a future one)
 * implements this, and the API routes only ever talk to this interface.
 *
 * Uploads always land in our own object store first (see storage.ts), so the app-facing
 * `sourceId` is our upload id; a provider keeps its own id in `remoteId`.
 */
export interface VideoProcessor {
  id: ProcessorId;
  /** Whether the provider is configured well enough to accept work. */
  readiness(): { ok: true } | { ok: false; reason: string };
  /** Send a stored take to the provider. Returns the provider's id for it. */
  upload(source: StoredUpload, bytes: Uint8Array): Promise<{ remoteId: string }>;
  /** Start captions + edit + overlays work on an uploaded source. */
  process(req: ProcessRequest, source: StoredUpload): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<JobStatus | null>;
  /** Null until the job is done. */
  getResult(jobId: string): Promise<JobResult | null>;
}

/** Errors that are safe to show the user, with the HTTP status to answer with. */
export class VideoProcessorError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/** VIDEO_PROCESSOR=local|mock|mirage (default local: the built-in ffmpeg editor). */
export function processorId(): ProcessorId {
  const v = process.env.VIDEO_PROCESSOR;
  return v === "mirage" ? "mirage" : v === "mock" ? "mock" : "local";
}

export async function getProcessor(): Promise<VideoProcessor> {
  if (processorId() === "mirage") return (await import("./mirage")).mirageProcessor;
  if (processorId() === "mock") return (await import("./mock")).mockProcessor;
  return (await import("./local")).localProcessor;
}
