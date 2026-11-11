import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getJSON, objects, putJSON } from "@/lib/storage/objects";
import { isMediaId, mediaKey, mediaUrl, newMediaId } from "@/lib/storage/media";
import { saveUpload } from "@/lib/video/storage";
import { probe, runFfmpeg } from "@/lib/video/local/ffmpeg";
import { listUsers, type User } from "@/lib/auth/server";
import { HfError, estimateUsd, higgsfieldConfigured, requestStatus, submit, uploadMedia } from "./higgsfield";
import { imageModel, videoModel } from "./models";
import { clipSeconds, countWords, nextStatus, resolveSetting, stillPrompt, validateScript, videoPrompt, voiceDescription, DEFAULT_WARDROBE, type CinematicAspect, type CinematicEvent, type CinematicStatus } from "./core";

/**
 * The cinematic video pipeline. A job is one JSON record; `advance` moves it
 * one step whenever someone looks at it (the advisor's page polls, and an
 * hourly tick picks up jobs nobody is watching), so it survives restarts and
 * needs no separate worker. Finished stills and videos are copied into Renom's
 * own storage; Higgsfield deletes its copies after a week.
 */

export const CONSENT_TEXT = "I am the person in these photos and I authorize Renom to create AI-generated video of me.";

/** Give up on a still after this long, and on a video after this long. */
const STILL_TIMEOUT_MS = 10 * 60_000;
const VIDEO_TIMEOUT_MS = 40 * 60_000;
/** Capped retries for busy/transient submission failures only. */
const MAX_SUBMIT_ATTEMPTS = 4;

export interface CostEntry {
  at: string;
  step: "still" | "video";
  model: string;
  requestId: string;
  /** Higgsfield's estimate for this request (USD), or null when it gave none. */
  usd: number | null;
  /** charged: it completed. refunded: it failed or was moderated (Higgsfield doesn't charge those). pending: not finished. */
  outcome: "pending" | "charged" | "refunded";
}

interface Step {
  idempotencyKey: string;
  model: string;
  prompt: string;
  input?: Record<string, unknown>;
  requestId?: string;
  submittedAt?: string;
  attempts: number;
  /** Don't try again before this (backoff after a busy/transient failure). */
  retryAt?: number;
}

export interface CinematicJob {
  id: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
  status: CinematicStatus;
  /** Which step failed, so a retry resumes there. */
  failedAt?: "scene" | "filming";
  /** What the advisor sees. */
  error?: string;
  /** What the admin sees (never shown to advisors). */
  adminError?: string;
  inputs: {
    /** The advisor's own headshots (media ids); the first is the reference. */
    headshotIds: string[];
    script: string;
    settingId: string;
    customSetting?: string;
    wardrobe: string;
    voiceId: string;
    aspect: CinematicAspect;
    /** Burn a small "AI-generated" label into the video. */
    aiLabel: boolean;
    /** The studio video this was made for, when it was started from the Record step. */
    videoId?: string;
  };
  consent: { at: string; text: string };
  still?: Step & { mediaId?: string };
  /** Earlier stills the advisor passed on (kept for the record). */
  pastStills?: { mediaId: string; requestId: string; at: string }[];
  video?: Step & { seconds: number; uploadId?: string; durationSec?: number; width?: number; height?: number; rawUploadId?: string };
  costs: CostEntry[];
}

/** What the advisor's page gets: no prompts, request ids, costs or admin notes. */
export interface CinematicView {
  id: string;
  createdAt: string;
  status: CinematicStatus;
  error?: string;
  failedAt?: "scene" | "filming";
  script: string;
  settingName: string;
  aspect: CinematicAspect;
  aiLabel: boolean;
  stillUrl?: string;
  videoUrl?: string;
  /** The finished video as an editor source: its id and size. */
  uploadId?: string;
  width?: number;
  height?: number;
  /** The studio video it was made for, if any. */
  videoId?: string;
  durationSec?: number;
  /** Seconds since the current step started, for the progress line. */
  elapsedSec?: number;
}

const jobKey = (id: string) => `cinematic/${id}.json`;
const indexKey = (userId: string) => `cinematicidx/${userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)}.json`;
export const isJobId = (id: unknown): id is string => typeof id === "string" && /^cj[a-f0-9]{18}$/.test(id);

const now = () => new Date().toISOString();
const save = async (job: CinematicJob) => {
  job.updatedAt = now();
  await putJSON(jobKey(job.id), job);
  return job;
};
export const getJob = (id: string) => (isJobId(id) ? getJSON<CinematicJob>(jobKey(id)) : Promise.resolve(null));
const readIndex = async (userId: string) => (await getJSON<{ ids: string[] }>(indexKey(userId)).catch(() => null))?.ids ?? [];

export async function listJobs(userId: string): Promise<CinematicJob[]> {
  const ids = await readIndex(userId);
  return (await Promise.all(ids.slice(0, 60).map((id) => getJob(id).catch(() => null)))).filter((j): j is CinematicJob => !!j);
}

export function view(job: CinematicJob): CinematicView {
  const setting = resolveSetting(job.inputs.settingId, job.inputs.customSetting);
  const started = job.status === "scene" ? job.still?.submittedAt : job.status === "filming" ? job.video?.submittedAt : undefined;
  return {
    id: job.id,
    createdAt: job.createdAt,
    status: job.status,
    error: job.error,
    failedAt: job.failedAt,
    script: job.inputs.script,
    settingName: setting?.name ?? "Custom setting",
    aspect: job.inputs.aspect,
    aiLabel: job.inputs.aiLabel,
    stillUrl: job.still?.mediaId ? mediaUrl(job.still.mediaId) : undefined,
    videoUrl: job.video?.uploadId ? `/api/video/files/${job.video.uploadId}` : undefined,
    uploadId: job.video?.uploadId,
    width: job.video?.width,
    height: job.video?.height,
    videoId: job.inputs.videoId,
    durationSec: job.video?.durationSec,
    elapsedSec: started ? Math.max(0, Math.round((Date.now() - Date.parse(started)) / 1000)) : undefined,
  };
}

export class CinematicError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Videos per advisor per calendar month (the plan is "unlimited"; this is a guard against runaway cost). */
export const monthlyLimit = () => Math.max(1, Number(process.env.CINEMATIC_MONTHLY_LIMIT) || 20);

export interface CreateInput {
  headshotIds: unknown;
  script: unknown;
  settingId: unknown;
  customSetting?: unknown;
  wardrobe?: unknown;
  voiceId?: unknown;
  aspect?: unknown;
  aiLabel?: unknown;
  consent?: unknown;
  videoId?: unknown;
}

export async function createJob(user: User, b: CreateInput): Promise<CinematicJob> {
  if (!(await higgsfieldConfigured())) throw new CinematicError("Cinematic videos aren’t switched on for this studio yet.", 503);
  if (b.consent !== true) throw new CinematicError("Confirm that you’re the person in these photos before we make a video of you.");
  const headshotIds = (Array.isArray(b.headshotIds) ? b.headshotIds : []).filter(isMediaId).slice(0, 3);
  if (!headshotIds.length) throw new CinematicError("Add a clear, front-facing photo of yourself.");
  const script = typeof b.script === "string" ? b.script.replace(/\s+/g, " ").trim() : "";
  const check = validateScript(script, videoModel().maxSeconds);
  if (!check.ok) throw new CinematicError(check.error);
  const settingId = typeof b.settingId === "string" ? b.settingId : "";
  const customSetting = typeof b.customSetting === "string" ? b.customSetting.slice(0, 400) : undefined;
  if (!resolveSetting(settingId, customSetting)) throw new CinematicError("Pick a setting, or describe your own in a sentence.");
  const mine = await listJobs(user.id);
  const month = now().slice(0, 7);
  if (mine.filter((j) => j.createdAt.startsWith(month) && j.status !== "failed").length >= monthlyLimit()) throw new CinematicError(`You’ve made ${monthlyLimit()} cinematic videos this month. More open up on the 1st.`, 429);

  const job: CinematicJob = {
    id: `cj${randomBytes(9).toString("hex")}`,
    userId: user.id,
    userEmail: user.email,
    createdAt: now(),
    updatedAt: now(),
    status: "uploading",
    inputs: {
      headshotIds,
      script,
      settingId,
      customSetting,
      wardrobe: (typeof b.wardrobe === "string" && b.wardrobe.replace(/\s+/g, " ").trim().slice(0, 160)) || DEFAULT_WARDROBE,
      voiceId: typeof b.voiceId === "string" ? b.voiceId : "male-us",
      aspect: b.aspect === "16:9" ? "16:9" : "9:16",
      aiLabel: b.aiLabel === true,
      videoId: typeof b.videoId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(b.videoId) ? b.videoId : undefined,
    },
    consent: { at: now(), text: CONSENT_TEXT },
    costs: [],
  };
  await save(job);
  await putJSON(indexKey(user.id), { ids: [job.id, ...(await readIndex(user.id))].slice(0, 500) });
  return job;
}

// ── Moving a job along ──

function go(job: CinematicJob, event: CinematicEvent) {
  const to = nextStatus(job.status, event, job.failedAt);
  if (!to) throw new CinematicError("That can’t be done right now.", 409);
  job.status = to;
}

const FRIENDLY: Record<string, string> = {
  moderated: "This one was declined by the video service’s content check. Try a different photo or reword the script.",
  failed: "The video service couldn’t make this one. Try again.",
  canceled: "This one was canceled before it finished. Try again.",
  timeout: "This one took too long. Try again.",
  setup: "Cinematic videos aren’t available right now. We’ve been told, and nothing was charged to you.",
};

function fail(job: CinematicJob, at: "scene" | "filming", reason: keyof typeof FRIENDLY, admin: string) {
  job.failedAt = at;
  job.status = "failed";
  job.error = FRIENDLY[reason];
  job.adminError = admin;
  for (const c of job.costs) if (c.outcome === "pending") c.outcome = "refunded";
  console.error(`[cinematic] ${job.id} (${job.userEmail}) failed at ${at}: ${admin}`);
}

async function mediaBytes(id: string): Promise<{ bytes: Uint8Array; type: "image/jpeg" | "image/png" | "image/webp" } | null> {
  const r = await objects().read(mediaKey(id)).catch(() => null);
  if (!r) return null;
  const type = /^image\/(jpeg|png|webp)$/.test(r.contentType) ? (r.contentType as "image/jpeg" | "image/png" | "image/webp") : null;
  if (!type) {
    void r.body.cancel().catch(() => {});
    return null;
  }
  return { bytes: new Uint8Array(await new Response(r.body).arrayBuffer()), type };
}

/** Submit a step's generation once, safely: the idempotency key was saved before the first try. */
async function submitStep(job: CinematicJob, step: Step, kind: "still" | "video", build: () => Promise<Record<string, unknown>>): Promise<boolean> {
  if (step.requestId) return true;
  if (step.retryAt && Date.now() < step.retryAt) return false;
  try {
    // The exact request is kept: a retry with the same key must send the same body.
    if (!step.input) {
      step.input = await build();
      await save(job);
    }
    const usd = await estimateUsd(step.model, step.input);
    step.attempts++;
    step.requestId = await submit(step.model, step.input, step.idempotencyKey);
    step.submittedAt = now();
    step.retryAt = undefined;
    job.costs.push({ at: now(), step: kind, model: step.model, requestId: step.requestId, usd, outcome: "pending" });
    await save(job);
    return true;
  } catch (e) {
    const at = kind === "still" ? "scene" : "filming";
    if (e instanceof HfError && e.retryable && step.attempts < MAX_SUBMIT_ATTEMPTS) {
      // Busy or a blip: wait longer each time, and send the same request with the same key.
      step.retryAt = Date.now() + Math.min(120_000, 5000 * 2 ** step.attempts);
      console.warn(`[cinematic] ${job.id} ${kind} submit will retry (${step.attempts}/${MAX_SUBMIT_ATTEMPTS}): ${e.message}`);
      await save(job);
      return false;
    }
    // Credentials, balance, plan, validation: retrying won't help. Tell the admin plainly.
    const kindOf = e instanceof HfError ? e.kind : "unknown";
    fail(job, at, e instanceof HfError && !e.retryable ? "setup" : "failed", `${kind} submit (${kindOf}): ${(e as Error).message}`);
    await save(job);
    return false;
  }
}

const settle = (job: CinematicJob, requestId: string, outcome: "charged" | "refunded") => {
  const c = job.costs.find((x) => x.requestId === requestId);
  if (c) c.outcome = outcome;
};

async function download(url: string, file: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  await fs.writeFile(file, new Uint8Array(await res.arrayBuffer()));
  return res.headers.get("content-type") ?? "";
}

/** A small "AI-generated" label in the lower corner, for advisors (or firms) who want the disclosure in the picture. */
async function burnLabel(input: string, out: string, height: number) {
  const font = path.join(process.cwd(), "public", "fonts", "Montserrat_600SemiBold.ttf");
  const size = Math.round(height * 0.017);
  const pad = Math.round(height * 0.022);
  await runFfmpeg([
    "-y", "-i", input,
    "-vf", `drawtext=fontfile='${font.replace(/[\\:']/g, "\\$&")}':text='AI-generated':fontsize=${size}:fontcolor=white@0.85:box=1:boxcolor=black@0.38:boxborderw=${Math.round(size * 0.5)}:x=${pad}:y=h-th-${pad}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", out,
  ]);
}

const advancing = new Map<string, Promise<CinematicJob>>();

/** Move a job one step if it can move. Safe to call as often as you like, from anywhere. */
export function advance(id: string): Promise<CinematicJob | null> {
  const running = advancing.get(id);
  if (running) return running;
  const p = (async () => {
    const job = await getJob(id);
    if (!job) return null as unknown as CinematicJob;
    try {
      await step(job);
    } catch (e) {
      console.error(`[cinematic] ${id} advance:`, (e as Error).message);
    }
    return job;
  })().finally(() => advancing.delete(id));
  advancing.set(id, p);
  return p;
}

async function step(job: CinematicJob) {
  const setting = resolveSetting(job.inputs.settingId, job.inputs.customSetting);
  if (!setting) return;

  // Uploading → scene: send the reference headshot, then ask for the still.
  if (job.status === "uploading" || (job.status === "scene" && !job.still?.requestId)) {
    if (!job.still) {
      job.still = { idempotencyKey: randomUUID(), model: imageModel().id, prompt: stillPrompt({ wardrobe: job.inputs.wardrobe, setting }), attempts: 0 };
      await save(job);
    }
    const ok = await submitStep(job, job.still, "still", async () => {
      const shot = await mediaBytes(job.inputs.headshotIds[0]);
      if (!shot) throw new HfError("validation", "The headshot couldn’t be read from storage.");
      const headshotUrl = await uploadMedia(shot.bytes, shot.type);
      return imageModel().input({ prompt: job.still!.prompt, headshotUrl, aspect: job.inputs.aspect });
    });
    if (ok && job.status === "uploading") {
      go(job, "uploaded");
      await save(job);
    }
    return;
  }

  // Scene: wait for the still, then keep our own copy and ask the advisor.
  if (job.status === "scene" && job.still?.requestId) {
    const r = await requestStatus(job.still.requestId);
    if (r.state === "working") {
      if (Date.now() - Date.parse(job.still.submittedAt ?? job.updatedAt) > STILL_TIMEOUT_MS) {
        fail(job, "scene", "timeout", `still ${job.still.requestId} not finished after ${STILL_TIMEOUT_MS / 60_000} min`);
        await save(job);
      }
      return;
    }
    if (r.state === "failed") {
      settle(job, job.still.requestId, "refunded");
      fail(job, "scene", r.reason, `still ${job.still.requestId}: ${r.detail}`);
      await save(job);
      return;
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-cine-"));
    try {
      const file = path.join(dir, "still");
      const type = await download(r.url, file);
      const mediaId = newMediaId();
      await objects().put(mediaKey(mediaId), new Uint8Array(await fs.readFile(file)), /png/.test(type) ? "image/png" : /webp/.test(type) ? "image/webp" : "image/jpeg");
      job.still.mediaId = mediaId;
      settle(job, job.still.requestId, "charged");
      go(job, "still_ready");
      await save(job);
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    return;
  }

  // Filming: submit the video from the approved still (our stored copy), then wait for it.
  if (job.status === "filming" && job.still?.mediaId) {
    if (!job.video) {
      const model = videoModel();
      job.video = { idempotencyKey: randomUUID(), model: model.id, prompt: videoPrompt({ setting, voice: voiceDescription(job.inputs.voiceId), script: job.inputs.script }), seconds: clipSeconds(countWords(job.inputs.script), model.minSeconds, model.maxSeconds), attempts: 0 };
      await save(job);
    }
    const video = job.video;
    if (!video.requestId) {
      await submitStep(job, video, "video", async () => {
        const still = await mediaBytes(job.still!.mediaId!);
        if (!still) throw new HfError("validation", "The approved still couldn’t be read from storage.");
        const imageUrl = await uploadMedia(still.bytes, still.type);
        return videoModel().input({ prompt: video.prompt, imageUrl, seconds: video.seconds, aspect: job.inputs.aspect });
      });
      return;
    }
    const r = await requestStatus(video.requestId);
    if (r.state === "working") {
      if (Date.now() - Date.parse(video.submittedAt ?? job.updatedAt) > VIDEO_TIMEOUT_MS) {
        fail(job, "filming", "timeout", `video ${video.requestId} not finished after ${VIDEO_TIMEOUT_MS / 60_000} min`);
        await save(job);
      }
      return;
    }
    if (r.state === "failed") {
      settle(job, video.requestId, "refunded");
      fail(job, "filming", r.reason, `video ${video.requestId}: ${r.detail}`);
      await save(job);
      return;
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-cine-"));
    try {
      const raw = path.join(dir, "raw.mp4");
      await download(r.url, raw);
      const info = await probe(raw);
      const rawRec = await saveUpload({ filename: "cinematic.mp4", mimeType: "video/mp4", size: (await fs.stat(raw)).size, durationSec: info.durationSec }, raw);
      let final = rawRec;
      if (job.inputs.aiLabel) {
        const labeled = path.join(dir, "labeled.mp4");
        try {
          await burnLabel(raw, labeled, info.height || 1920);
          final = await saveUpload({ filename: "cinematic-labeled.mp4", mimeType: "video/mp4", size: (await fs.stat(labeled)).size, durationSec: info.durationSec }, labeled);
        } catch (e) {
          // The video is still good; say so rather than lose it.
          console.error(`[cinematic] ${job.id} label failed:`, (e as Error).message);
          job.adminError = `AI label couldn’t be added: ${(e as Error).message.slice(0, 200)}`;
        }
      }
      video.rawUploadId = rawRec.id;
      video.uploadId = final.id;
      video.durationSec = Math.round(info.durationSec * 10) / 10;
      video.width = info.width || undefined;
      video.height = info.height || undefined;
      settle(job, video.requestId, "charged");
      go(job, "video_ready");
      await save(job);
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ── What the advisor can do ──

async function owned(user: User, id: string) {
  const job = await getJob(id);
  if (!job || job.userId !== user.id) throw new CinematicError("Not found.", 404);
  return job;
}

export async function act(user: User, id: string, action: "approve" | "regenerate" | "retry"): Promise<CinematicJob> {
  const job = await owned(user, id);
  if (action === "approve") {
    go(job, "approve");
    job.video = undefined;
  } else if (action === "regenerate" || (action === "retry" && job.failedAt !== "filming")) {
    // A new still is a new generation: new key, and the old still is kept for the record.
    if (job.still?.mediaId && job.still.requestId) job.pastStills = [...(job.pastStills ?? []), { mediaId: job.still.mediaId, requestId: job.still.requestId, at: now() }].slice(-10);
    if ((job.pastStills?.length ?? 0) >= 6 && action === "regenerate") throw new CinematicError("That’s six stills for this video. Start a new one with a different photo or setting.", 429);
    go(job, action === "retry" ? "retry" : "regenerate");
    job.still = undefined;
    job.video = undefined;
  } else {
    // Retry the video from the still that was already approved.
    go(job, "retry");
    job.video = undefined;
  }
  job.error = undefined;
  job.failedAt = undefined;
  await save(job);
  return (await advance(job.id)) ?? job;
}

export async function removeJob(user: User, id: string) {
  const job = await owned(user, id);
  await putJSON(indexKey(user.id), { ids: (await readIndex(user.id)).filter((x) => x !== job.id) });
}

/** The hourly tick: move along jobs nobody has open. */
export async function advanceAll() {
  if (!(await higgsfieldConfigured())) return;
  for (const u of await listUsers().catch(() => [])) {
    for (const id of (await readIndex(u.id)).slice(0, 30)) {
      const job = await getJob(id).catch(() => null);
      if (job && (job.status === "uploading" || job.status === "scene" || job.status === "filming")) await advance(id);
    }
  }
}

// ── Admin: usage and margin ──

const sumUsd = (job: CinematicJob) => job.costs.filter((c) => c.outcome !== "refunded").reduce((a, c) => a + (c.usd ?? 0), 0);

export async function adminUsage() {
  const users = await listUsers().catch(() => []);
  const rows = [];
  for (const u of users) {
    const ids = await readIndex(u.id);
    if (!ids.length) continue;
    const jobs = (await Promise.all(ids.slice(0, 200).map((id) => getJob(id).catch(() => null)))).filter((j): j is CinematicJob => !!j);
    rows.push({
      userId: u.id,
      email: u.email,
      name: u.name,
      videos: jobs.map((j) => ({
        id: j.id,
        createdAt: j.createdAt,
        status: j.status,
        script: j.inputs.script.slice(0, 120),
        setting: resolveSetting(j.inputs.settingId, j.inputs.customSetting)?.name ?? "Custom",
        stills: j.costs.filter((c) => c.step === "still").length,
        usd: Math.round(sumUsd(j) * 1000) / 1000,
        unpriced: j.costs.some((c) => c.usd === null && c.outcome !== "refunded"),
        adminError: j.adminError,
        models: [...new Set(j.costs.map((c) => c.model))],
        requestIds: j.costs.map((c) => c.requestId),
      })),
    });
  }
  return rows;
}
