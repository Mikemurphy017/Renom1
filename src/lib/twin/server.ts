import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getJSON, objects, putJSON } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import { downloadUpload, getUpload, isStorageId, saveUpload } from "@/lib/video/storage";
import { probe, runFfmpeg } from "@/lib/video/local/ffmpeg";
import { listUsers, type User } from "@/lib/auth/server";
import * as hg from "./heygen";

/**
 * The advisor's AI twin and the videos made with it.
 *
 * Setup, once (onboarding or Settings): their voice (a recording, cloned),
 * a video of them talking (trained into a twin that moves like them, cleared by
 * their own consent recording), and photos of them (looks of the same person
 * that move like the twin). Then any script becomes a video of them.
 *
 * Records: twin/<user>.json for the setup, aivideo/<id>.json per video, and an
 * index per user. Only the advisor's own likeness is ever used, for their own videos.
 */

export const CONSENT_TEXT = "I am the person in this voice recording, video and these photos, and I authorize Renom to create an AI likeness and voice of me for my own videos.";

type Part = "working" | "ready" | "failed";
export interface TwinRecord {
  userId: string;
  consent?: { at: string; text: string };
  voice?: { id: string; status: Part; error?: string; createdAt: string; seconds?: number };
  twin?: { groupId: string; lookId: string; voiceId?: string; status: Part; error?: string; engines?: string[]; consent: "none" | "pending" | "accepted" | "rejected"; consentUrl?: string; consentUrlAt?: string; createdAt: string; uploadId: string };
  photos?: { mediaId: string; lookId: string; status: Part; error?: string; engines?: string[]; createdAt: string }[];
  /** The look AI videos use by default (a photo look or the twin itself). */
  defaultLook?: string;
  updatedAt: string;
}

/** What the advisor's page sees: no provider ids. */
export interface TwinView {
  available: boolean;
  voice: { status: Part; error?: string; createdAt: string; seconds?: number } | null;
  video: { status: Part; error?: string; createdAt: string; consent: "none" | "pending" | "accepted" | "rejected"; consentUrl?: string } | null;
  photos: { mediaId: string; status: Part; error?: string }[];
  /** Everything needed for a video: voice ready, twin trained and consented. */
  ready: boolean;
  looks: { id: string; label: string; mediaId?: string }[];
  defaultLook?: string;
}

export class TwinUserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const slug = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
const twinKey = (userId: string) => `twin/${slug(userId)}.json`;
const now = () => new Date().toISOString();
export const readTwin = async (userId: string) => (await getJSON<TwinRecord>(twinKey(userId)).catch(() => null)) ?? { userId, updatedAt: now() };
const saveTwin = (t: TwinRecord) => putJSON(twinKey(t.userId), { ...t, updatedAt: now() });

const looksOf = (t: TwinRecord) => [
  ...(t.photos ?? []).filter((p) => p.status === "ready").map((p, i) => ({ id: p.lookId, label: `Photo ${i + 1}`, mediaId: p.mediaId, engines: p.engines ?? [] })),
  ...(t.twin?.status === "ready" ? [{ id: t.twin.lookId, label: "Your video", mediaId: undefined, engines: t.twin.engines ?? [] }] : []),
];
export const isReady = (t: TwinRecord) => t.voice?.status === "ready" && t.twin?.status === "ready" && t.twin.consent === "accepted";

export function viewTwin(t: TwinRecord): TwinView {
  const looks = looksOf(t);
  return {
    available: hg.twinConfigured(),
    voice: t.voice ? { status: t.voice.status, error: t.voice.error, createdAt: t.voice.createdAt, seconds: t.voice.seconds } : null,
    video: t.twin ? { status: t.twin.status, error: t.twin.error, createdAt: t.twin.createdAt, consent: t.twin.consent, consentUrl: t.twin.consent === "accepted" ? undefined : t.twin.consentUrl } : null,
    photos: (t.photos ?? []).map((p) => ({ mediaId: p.mediaId, status: p.status, error: p.error })),
    ready: isReady(t),
    looks: looks.map(({ id, label, mediaId }) => ({ id, label, mediaId })),
    defaultLook: t.defaultLook && looks.some((l) => l.id === t.defaultLook) ? t.defaultLook : looks[0]?.id,
  };
}

const needConsent = (t: TwinRecord, given: unknown) => {
  if (t.consent) return;
  if (given !== true && given !== "yes") throw new TwinUserError("Confirm that this is you and that you agree to your AI likeness and voice being made.");
  t.consent = { at: now(), text: CONSENT_TEXT };
};

// ── Setup ──

/** The voice: one recording, converted to MP3 and cloned. Replaces an earlier voice. */
export async function setVoice(user: User, audio: { bytes: Uint8Array; name: string }, seconds: number | undefined, consent: unknown) {
  const t = await readTwin(user.id);
  needConsent(t, consent);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-voice-"));
  try {
    const src = path.join(dir, `in${path.extname(audio.name) || ".webm"}`);
    const mp3 = path.join(dir, "voice.mp3");
    await fs.writeFile(src, audio.bytes);
    await runFfmpeg(["-y", "-i", src, "-vn", "-ac", "1", "-ar", "44100", "-t", "180", "-b:a", "160k", mp3]);
    const info = await probe(mp3).catch(() => null);
    const length = info?.durationSec ?? seconds ?? 0;
    if (length < 30) throw new TwinUserError("Record at least 30 seconds of you talking (about a minute is best).");
    const asset = await hg.uploadSmall(new Uint8Array(await fs.readFile(mp3)), "audio/mpeg", "voice.mp3");
    const old = t.voice?.id;
    const id = await hg.cloneVoice(asset, `Renom ${slug(user.id)}`, randomUUID());
    t.voice = { id, status: "working", createdAt: now(), seconds: Math.round(length) };
    await saveTwin(t);
    if (old && old !== id) await hg.deleteVoice(old);
    return refresh(user);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** The talking video (already in Renom's storage): trained into the twin, then the consent link. */
export async function setVideo(user: User, uploadId: string, returnUrl: string, consent: unknown) {
  if (!isStorageId(uploadId)) throw new TwinUserError("Upload the video first.");
  const rec = await getUpload(uploadId);
  if (!rec) throw new TwinUserError("That video couldn’t be found. Upload it again.");
  const t = await readTwin(user.id);
  needConsent(t, consent);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-twin-"));
  try {
    const raw = path.join(dir, "raw");
    await downloadUpload(rec, raw);
    const info = await probe(raw);
    if (info.durationSec < 15) throw new TwinUserError("The video needs at least 15 seconds of you talking (about 2 minutes is best).");
    if (!info.hasAudio) throw new TwinUserError("The video has no sound. Record it with your microphone on: your voice and lip movements are learned from it.");
    // MP4, at most 1080p and 10 minutes, so it fits the 200 MB limit.
    const mp4 = path.join(dir, "twin.mp4");
    await runFfmpeg(["-y", "-i", raw, "-t", "600", "-vf", "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", mp4]);
    const asset = await hg.uploadLarge(mp4, "video/mp4", "twin.mp4");
    const old = t.twin?.groupId;
    const made = await hg.createTwin(asset, `Renom ${slug(user.id)}`, randomUUID());
    let consentUrl: string | undefined;
    try {
      consentUrl = (await hg.consentLink(made.groupId, returnUrl, randomUUID())) ?? undefined;
    } catch (e) {
      console.warn("[twin] consent link not made yet:", (e as Error).message);
    }
    t.twin = { groupId: made.groupId, lookId: made.lookId, voiceId: made.voiceId, status: "working", consent: consentUrl ? "pending" : "none", consentUrl, consentUrlAt: consentUrl ? now() : undefined, createdAt: now(), uploadId };
    // Photos belong to the old twin's group: they're made again for the new one.
    t.photos = (t.photos ?? []).map((p) => ({ ...p, lookId: "", status: "working" as Part }));
    await saveTwin(t);
    if (old && old !== made.groupId) await hg.deleteGroup(old);
    return refresh(user);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** A fresh consent link (they last 24 hours). */
export async function newConsentLink(user: User, returnUrl: string) {
  const t = await readTwin(user.id);
  if (!t.twin) throw new TwinUserError("Upload the video of you talking first.");
  const url = await hg.consentLink(t.twin.groupId, returnUrl, randomUUID());
  if (!url) throw new TwinUserError("The consent link couldn’t be made. Try again in a minute.", 502);
  t.twin.consentUrl = url;
  t.twin.consentUrlAt = now();
  if (t.twin.consent !== "accepted") t.twin.consent = "pending";
  await saveTwin(t);
  return url;
}

/** Photos of the advisor (their own headshots): each becomes a look that moves like the twin. */
export async function setPhotos(user: User, mediaIds: unknown, consent: unknown) {
  const ids = (Array.isArray(mediaIds) ? mediaIds : []).filter(isMediaId).slice(0, 6);
  if (!ids.length) throw new TwinUserError("Pick at least one photo of you.");
  const t = await readTwin(user.id);
  needConsent(t, consent);
  const keep = (t.photos ?? []).filter((p) => ids.includes(p.mediaId));
  t.photos = [...keep, ...ids.filter((id) => !keep.some((p) => p.mediaId === id)).map((mediaId) => ({ mediaId, lookId: "", status: "working" as Part, createdAt: now() }))];
  await saveTwin(t);
  return refresh(user);
}

export async function setDefaultLook(user: User, lookId: string) {
  const t = await readTwin(user.id);
  if (!looksOf(t).some((l) => l.id === lookId)) throw new TwinUserError("Pick one of your looks.");
  t.defaultLook = lookId;
  await saveTwin(t);
  return viewTwin(t);
}

export async function removeTwin(user: User) {
  const t = await readTwin(user.id);
  if (t.voice?.id) await hg.deleteVoice(t.voice.id);
  if (t.twin?.voiceId) await hg.deleteVoice(t.twin.voiceId);
  if (t.twin?.groupId) await hg.deleteGroup(t.twin.groupId);
  await objects().remove(twinKey(user.id)).catch(() => {});
}

async function mediaBytes(id: string) {
  const r = await objects().read(mediaKey(id)).catch(() => null);
  if (!r) return null;
  return { bytes: new Uint8Array(await new Response(r.body).arrayBuffer()), type: r.contentType };
}

/** Moves the setup along: voice and twin training, consent, and photo looks once the twin's group exists. */
export async function refresh(user: User): Promise<TwinView> {
  const t = await readTwin(user.id);
  let changed = false;
  const safe = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof hg.TwinError) || (e.status !== 429 && e.status < 500)) console.warn("[twin] refresh:", (e as Error).message);
    }
  };
  if (t.voice?.status === "working")
    await safe(async () => {
      const s = await hg.voiceStatus(t.voice!.id);
      if (s.state === "working") return;
      t.voice = { ...t.voice!, status: s.state === "ready" ? "ready" : "failed", error: s.state === "failed" ? s.reason : undefined };
      changed = true;
    });
  if (t.twin?.status === "working")
    await safe(async () => {
      const s = await hg.lookStatus(t.twin!.lookId);
      if (s.state === "working") return;
      t.twin = { ...t.twin!, status: s.state === "ready" ? "ready" : "failed", error: s.state === "failed" ? s.reason : undefined, engines: s.state === "ready" ? s.engines : undefined };
      changed = true;
    });
  if (t.twin && t.twin.consent !== "accepted")
    await safe(async () => {
      const c = await hg.consentStatus(t.twin!.groupId);
      if (c && c !== t.twin!.consent) {
        t.twin!.consent = c;
        changed = true;
      }
    });
  // Photos join the twin's group (one at a time, a few per look).
  if (t.twin)
    for (const p of t.photos ?? []) {
      if (p.status !== "working") continue;
      await safe(async () => {
        if (!p.lookId) {
          const img = await mediaBytes(p.mediaId);
          if (!img) {
            Object.assign(p, { status: "failed", error: "That photo couldn’t be read. Upload it again." });
            changed = true;
            return;
          }
          const asset = await hg.uploadSmall(img.bytes, img.type, "photo.jpg");
          p.lookId = await hg.createPhotoLook(t.twin!.groupId, asset, `Renom photo ${p.mediaId.slice(-6)}`, `${t.twin!.groupId}-${p.mediaId}`);
          changed = true;
          return;
        }
        const s = await hg.lookStatus(p.lookId);
        if (s.state === "working") return;
        Object.assign(p, { status: s.state === "ready" ? "ready" : "failed", error: s.state === "failed" ? s.reason : undefined, engines: s.state === "ready" ? s.engines : undefined });
        changed = true;
      });
    }
  if (changed) await saveTwin(t);
  return viewTwin(t);
}

// ── AI videos ──

export interface AiVideoJob {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  /** The studio video it's for, if any. */
  videoId?: string;
  script: string;
  aspect: "9:16" | "16:9";
  lookId: string;
  providerId?: string;
  status: "working" | "ready" | "failed";
  error?: string;
  uploadId?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  attempts: number;
}
export interface AiVideoView {
  id: string;
  createdAt: string;
  videoId?: string;
  script: string;
  aspect: "9:16" | "16:9";
  status: AiVideoJob["status"];
  error?: string;
  uploadId?: string;
  videoUrl?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  elapsedSec: number;
}

const jobKey = (id: string) => `aivideo/${id}.json`;
const indexKey = (userId: string) => `aivideoidx/${slug(userId)}.json`;
export const isAiVideoId = (id: unknown): id is string => typeof id === "string" && /^av[a-f0-9]{18}$/.test(id);
const getJob = (id: string) => (isAiVideoId(id) ? getJSON<AiVideoJob>(jobKey(id)).catch(() => null) : Promise.resolve(null));
const saveJob = (j: AiVideoJob) => putJSON(jobKey(j.id), { ...j, updatedAt: now() });
const readIndex = async (userId: string) => (await getJSON<{ ids: string[] }>(indexKey(userId)).catch(() => null))?.ids ?? [];

export function viewJob(j: AiVideoJob): AiVideoView {
  return { id: j.id, createdAt: j.createdAt, videoId: j.videoId, script: j.script, aspect: j.aspect, status: j.status, error: j.error, uploadId: j.uploadId, videoUrl: j.uploadId ? `/api/video/files/${j.uploadId}` : undefined, durationSec: j.durationSec, width: j.width, height: j.height, elapsedSec: Math.max(0, Math.round((Date.now() - Date.parse(j.createdAt)) / 1000)) };
}

/** AI videos per advisor per calendar month: a guard against runaway cost. */
export const monthlyLimit = () => Math.max(1, Number(process.env.AI_VIDEO_MONTHLY_LIMIT) || 30);
export const MAX_SCRIPT_WORDS = 400;

export async function listJobs(userId: string) {
  return (await Promise.all((await readIndex(userId)).slice(0, 60).map(getJob))).filter((j): j is AiVideoJob => !!j);
}

export async function startAiVideo(user: User, b: { script?: unknown; videoId?: unknown; aspect?: unknown; lookId?: unknown; title?: unknown }) {
  const script = typeof b.script === "string" ? b.script.replace(/\s+/g, " ").trim() : "";
  const words = script ? script.split(" ").length : 0;
  if (words < 5) throw new TwinUserError("Write at least a sentence for your AI twin to say.");
  if (words > MAX_SCRIPT_WORDS) throw new TwinUserError(`Keep it to ${MAX_SCRIPT_WORDS} words (about two and a half minutes).`);
  const t = await readTwin(user.id);
  if (!isReady(t)) throw new TwinUserError("Finish setting up your AI twin first (Settings → Your AI twin).", 409);
  const looks = looksOf(t);
  const look = looks.find((l) => l.id === b.lookId) ?? looks.find((l) => l.id === t.defaultLook) ?? looks[0];
  if (!look) throw new TwinUserError("Your AI twin has no look ready yet.", 409);
  const mine = await listJobs(user.id);
  const month = now().slice(0, 7);
  if (mine.filter((j) => j.createdAt.startsWith(month) && j.status !== "failed").length >= monthlyLimit()) throw new TwinUserError(`You’ve made ${monthlyLimit()} AI videos this month. More open up on the 1st.`, 429);
  const job: AiVideoJob = {
    id: `av${randomBytes(9).toString("hex")}`,
    userId: user.id,
    createdAt: now(),
    updatedAt: now(),
    videoId: typeof b.videoId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(b.videoId) ? b.videoId : undefined,
    script,
    aspect: b.aspect === "16:9" ? "16:9" : "9:16",
    lookId: look.id,
    status: "working",
    attempts: 0,
  };
  job.providerId = await hg.startVideo({ lookId: look.id, voiceId: t.voice!.id, script, aspect: job.aspect, engines: look.engines, title: typeof b.title === "string" ? b.title : "Renom AI video", idem: job.id });
  await saveJob(job);
  await putJSON(indexKey(user.id), { ids: [job.id, ...(await readIndex(user.id))].slice(0, 500) });
  return job;
}

const busy = new Map<string, Promise<AiVideoJob | null>>();

/** Looks at one job and, when the provider is done, copies the video into Renom's storage. */
export function advanceJob(id: string): Promise<AiVideoJob | null> {
  const running = busy.get(id);
  if (running) return running;
  const p = (async () => {
    const job = await getJob(id);
    if (!job || job.status !== "working" || !job.providerId) return job;
    let s: hg.VideoState;
    try {
      s = await hg.videoStatus(job.providerId);
    } catch (e) {
      if (e instanceof hg.TwinError && (e.status === 429 || e.status >= 500)) return job;
      job.status = "failed";
      job.error = (e as Error).message;
      await saveJob(job);
      return job;
    }
    if (s.state === "working") return job;
    if (s.state === "failed") {
      job.status = "failed";
      job.error = s.reason;
      await saveJob(job);
      return job;
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-aivideo-"));
    try {
      const file = path.join(dir, "video.mp4");
      const res = await fetch(s.url, { cache: "no-store", signal: AbortSignal.timeout(300_000) });
      if (!res.ok) throw new Error(`download ${res.status}`);
      await fs.writeFile(file, new Uint8Array(await res.arrayBuffer()));
      const info = await probe(file);
      const up = await saveUpload({ filename: "ai-video.mp4", mimeType: "video/mp4", size: (await fs.stat(file)).size, durationSec: info.durationSec }, file);
      Object.assign(job, { status: "ready", uploadId: up.id, durationSec: Math.round(info.durationSec * 10) / 10, width: info.width || undefined, height: info.height || undefined });
      await saveJob(job);
      return job;
    } catch (e) {
      // The provider keeps the file a while: try again next time.
      job.attempts++;
      if (job.attempts >= 6) Object.assign(job, { status: "failed", error: "The finished video couldn’t be saved. Please make it again." });
      await saveJob(job);
      console.warn(`[aivideo] ${job.id} copy failed:`, (e as Error).message);
      return job;
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  })().finally(() => busy.delete(id));
  busy.set(id, p);
  return p;
}

export async function getOwnJob(user: User, id: string) {
  const j = await getJob(id);
  if (!j || j.userId !== user.id) throw new TwinUserError("Not found.", 404);
  return j;
}

/** The background tick: finish videos and setups nobody has open. */
export async function advanceAllAi() {
  if (!hg.twinConfigured()) return;
  for (const u of await listUsers().catch(() => [])) {
    for (const id of (await readIndex(u.id)).slice(0, 20)) {
      const j = await getJob(id);
      if (j?.status === "working") await advanceJob(id).catch(() => null);
    }
    const t = await getJSON<TwinRecord>(twinKey(u.id)).catch(() => null);
    if (t && (t.voice?.status === "working" || t.twin?.status === "working" || t.twin?.consent === "pending" || (t.photos ?? []).some((p) => p.status === "working"))) await refresh(u).catch(() => null);
  }
}
