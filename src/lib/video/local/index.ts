import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getJob, newId, saveJob, saveUpload, uploadBytes } from "../storage";
import type { VideoProcessor } from "../processor";
import { VideoProcessorError } from "../processor";
import type { JobKind, JobResult, JobStatus, ProcessRequest } from "../types";
import type { StoredUpload } from "../storage";
import { probe } from "./ffmpeg";
import { analyzeTake } from "./analyze";
import { renderVideo } from "./render";

/**
 * Built-in editor (ffmpeg). Runs on this server, so it needs nothing but the
 * bundled binary. Analyze measures the audio and finds the pauses; render
 * applies the advisor's cuts and look and stores a real MP4.
 */

interface LocalJob extends JobStatus {
  sourceId: string;
  createdAt: number;
  result?: JobResult;
}

// Live progress for running jobs; the stored record is the source of truth after.
const live = new Map<string, LocalJob>();
// One heavy job at a time keeps a small server responsive.
let queue: Promise<unknown> = Promise.resolve();

async function persist(job: LocalJob) {
  live.set(job.id, job);
  await saveJob(job);
}

async function withSource<T>(source: StoredUpload, fn: (file: string, dir: string) => Promise<T>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-"));
  try {
    const file = path.join(dir, `source.${source.mimeType.includes("mp4") ? "mp4" : source.mimeType.includes("quicktime") ? "mov" : "webm"}`);
    await fs.writeFile(file, await uploadBytes(source));
    return await fn(file, dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function run(job: LocalJob, req: ProcessRequest, source: StoredUpload) {
  const step = async (progress: number, stage: string) => {
    job.state = "processing";
    job.progress = Math.round(progress * 100) / 100;
    job.stage = stage;
    live.set(job.id, job);
  };
  try {
    await withSource(source, async (file, dir) => {
      await step(0.05, "Reading your take…");
      const info = await probe(file);
      if (!info.hasVideo) throw new Error("This file has no video track.");
      await step(0.15, "Listening for pauses…");
      const a = await analyzeTake(file, info.durationSec || source.durationSec, info.hasAudio, req.script, req.edit);

      if (req.kind === "analyze") {
        job.result = {
          jobId: job.id,
          kind: "analyze",
          outputUrl: `/api/video/files/${source.id}`,
          durationSec: a.durationSec,
          transcript: a.transcript,
          cuts: a.cuts,
          keyPhrases: req.overlays.keyPhrases ? a.keyPhrases : [],
          levels: a.levels,
          timedBy: a.timedBy,
        };
        return;
      }

      await step(0.2, "Cutting and adding your captions…");
      const out = path.join(dir, "final.mp4");
      let lastSave = 0;
      const rendered = await renderVideo({
        source: file,
        out,
        workDir: dir,
        durationSec: a.durationSec,
        hasAudio: info.hasAudio,
        aspect: req.aspect,
        cuts: req.cuts ?? a.cuts,
        transcript: a.transcript,
        keyPhrases: req.overlays.keyPhrases ? a.keyPhrases : [],
        overlays: req.overlays,
        enhanceAudio: req.edit.enhanceAudio,
        onProgress: (p) => {
          void step(0.2 + p * 0.7, p < 0.5 ? "Cutting and adding your captions…" : "Encoding MP4…");
          if (Date.now() - lastSave > 3000) {
            lastSave = Date.now();
            void saveJob(job).catch(() => {});
          }
        },
      });
      await step(0.93, "Saving to your library…");
      const bytes = new Uint8Array(await fs.readFile(out));
      const stored = await saveUpload({ filename: "video.mp4", mimeType: "video/mp4", size: bytes.byteLength, durationSec: rendered.durationSec, videoId: source.videoId }, bytes);
      job.result = {
        jobId: job.id,
        kind: "render",
        outputUrl: `/api/video/files/${stored.id}`,
        outputId: stored.id,
        sizeBytes: bytes.byteLength,
        durationSec: rendered.durationSec,
        transcript: a.transcript,
        cuts: (req.cuts ?? a.cuts).map((c, i) => ({ id: `r${i}`, kind: "silence" as const, start: c.start, end: c.end })),
        keyPhrases: req.overlays.keyPhrases ? a.keyPhrases : [],
      };
    });
    job.state = "done";
    job.progress = 1;
    job.stage = "Done";
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr;
    if (stderr) console.error(`[video] ${req.kind} ${job.id} failed:\n${stderr.slice(-2000)}`);
    else console.error(`[video] ${req.kind} ${job.id} failed:`, e);
    job.state = "failed";
    job.error = stderr ? "The video engine couldn’t process this take." : (e as Error).message;
    job.stage = "Failed";
  }
  await persist(job);
  setTimeout(() => live.delete(job.id), 60_000);
}

const STAGE: Record<JobKind, string> = { analyze: "Queued…", render: "Waiting for the editor…" };

export const localProcessor: VideoProcessor = {
  id: "local",
  readiness: () => ({ ok: true }),

  async upload(source) {
    return { remoteId: source.id };
  },

  async process(req, source) {
    const job: LocalJob = { id: newId("job"), kind: req.kind, sourceId: source.id, state: "queued", progress: 0, stage: STAGE[req.kind], createdAt: Date.now() };
    await persist(job);
    queue = queue.then(() => run(job, req, source)).catch(() => {});
    return { jobId: job.id };
  },

  async getStatus(jobId) {
    const job = live.get(jobId) ?? (await getJob<LocalJob>(jobId));
    if (!job) return null;
    // A job stored as running that this server isn't running was cut off by a restart.
    if ((job.state === "queued" || job.state === "processing") && !live.has(jobId)) {
      if (Date.now() - job.createdAt > 15_000) return { id: job.id, kind: job.kind, state: "failed", progress: job.progress, stage: "Failed", error: "Processing was interrupted. Please try again." };
    }
    return { id: job.id, kind: job.kind, state: job.state, progress: job.progress, stage: job.stage, error: job.error };
  },

  async getResult(jobId) {
    const job = live.get(jobId) ?? (await getJob<LocalJob>(jobId));
    if (!job || job.state !== "done") return null;
    if (!job.result) throw new VideoProcessorError("The result is missing.", 500);
    return job.result;
  },
};
