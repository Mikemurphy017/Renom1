import type { JobResult, JobStatus, ProcessorId, ProcessRequest } from "./types";
import type { StoredUpload } from "./storage";

/**
 * The seam between Renom and whatever service edits the videos.
 * Server-only. Every provider (the offline mock, Mirage, a future one)
 * implements this, and the API routes only ever talk to this interface.
 *
 * Uploads always land on our own disk first (see storage.ts), so the app-facing
 * `sourceId` is our upload id; a provider keeps its own id in `remoteId`.
 */
export interface VideoProcessor {
  id: ProcessorId;
  /** Whether the provider is configured well enough to accept work. */
  readiness(): { ok: true } | { ok: false; reason: string };
  /** Send a stored take to the provider. Returns the provider's id for it. */
  upload(source: StoredUpload, filePath: string): Promise<{ remoteId: string }>;
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

/** VIDEO_PROCESSOR=mock|mirage (default mock). */
export function processorId(): ProcessorId {
  return process.env.VIDEO_PROCESSOR === "mirage" ? "mirage" : "mock";
}

export async function getProcessor(): Promise<VideoProcessor> {
  if (processorId() === "mirage") return (await import("./mirage")).mirageProcessor;
  return (await import("./mock")).mockProcessor;
}
