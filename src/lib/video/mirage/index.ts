import { promises as fs } from "node:fs";
import { getJob, newId, saveJob } from "../storage";
import { VideoProcessorError, type VideoProcessor } from "../processor";
import type { JobKind } from "../types";
import * as M from "./endpoints";

/**
 * Mirage (Captions) adapter. Server-only: MIRAGE_API_KEY never leaves the server.
 *
 * The request/response mapping in ./endpoints.ts has not been checked against
 * the Mirage docs yet, so this refuses to run unless MIRAGE_VERIFIED=1. That
 * keeps the app from silently calling guessed URLs.
 */

interface MirageJob {
  id: string;
  kind: JobKind;
  sourceId: string;
  remoteJobId: string;
  createdAt: number;
}

function ready(): { ok: true } | { ok: false; reason: string } {
  if (!process.env.MIRAGE_API_KEY) return { ok: false, reason: "MIRAGE_API_KEY is not set." };
  if (process.env.MIRAGE_VERIFIED !== "1")
    return { ok: false, reason: "Mirage endpoints not yet verified. Confirm src/lib/video/mirage/endpoints.ts against https://captions.ai/llms.txt, then set MIRAGE_VERIFIED=1." };
  return { ok: true };
}

function assertReady() {
  const r = ready();
  if (!r.ok) throw new VideoProcessorError(r.reason, 503);
}

async function call(path: string, init: RequestInit = {}) {
  assertReady();
  const base = (process.env.MIRAGE_API_URL || M.DEFAULT_BASE_URL).replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(base + path, { ...init, headers: { ...M.authHeaders(process.env.MIRAGE_API_KEY!), ...(init.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new VideoProcessorError("Couldn’t reach Mirage. Check the network connection.");
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new VideoProcessorError("Mirage rejected the API key. Check MIRAGE_API_KEY.");
  if (!res.ok) throw new VideoProcessorError(`Mirage returned an error (${res.status}).`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new VideoProcessorError("Mirage returned something that wasn’t JSON.");
  }
}

export const mirageProcessor: VideoProcessor = {
  id: "mirage",
  readiness: ready,

  async upload(source, filePath) {
    assertReady();
    const bytes = await fs.readFile(filePath);
    const { body, headers } = M.uploadRequest(new Blob([bytes], { type: source.mimeType }), source.filename);
    const json = await call(M.PATHS.upload, { method: "POST", body, headers });
    return { remoteId: M.parseUpload(json) };
  },

  async process(req, source) {
    if (!source.remoteId) throw new VideoProcessorError("This take hasn’t been sent to Mirage yet.", 409);
    const json = await call(M.PATHS.process, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(M.processBody(req, source.remoteId)) });
    const job: MirageJob = { id: newId("job"), kind: req.kind, sourceId: source.id, remoteJobId: M.parseProcess(json), createdAt: Date.now() };
    await saveJob(job);
    return { jobId: job.id };
  },

  async getStatus(jobId) {
    const job = await getJob<MirageJob>(jobId);
    if (!job) return null;
    return M.parseStatus(job.id, job.kind, await call(M.PATHS.status(job.remoteJobId)));
  },

  async getResult(jobId) {
    const job = await getJob<MirageJob>(jobId);
    if (!job) return null;
    const status = M.parseStatus(job.id, job.kind, await call(M.PATHS.status(job.remoteJobId)));
    if (status.state !== "done") return null;
    return M.parseResult(job.id, job.kind, await call(M.PATHS.result(job.remoteJobId)));
  },
};
