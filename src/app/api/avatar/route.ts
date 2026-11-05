import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser, type User } from "@/lib/auth/server";
import { isPro, proOnly } from "@/lib/billing/tier";
import { getJSON, objects, putJSON } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import { VoiceError, speak } from "@/lib/voice/server";
import { avatarConfigured, avatarVideoStatus, createPhotoLook, lookStatus, startAvatarVideo, uploadAsset } from "@/lib/avatar/heygen";
import { buildAvatarTake, normalizeTalkingVideo, prepareAvatarPhoto } from "@/lib/video/local/avatar";
import { getProcessor } from "@/lib/video/processor";
import { saveUpload, updateUpload } from "@/lib/video/storage";
import type { StoredTake } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * AI avatar takes, in the advisor's AI voice.
 *  - "talking": one photo of the advisor, lip-synced to the script. It takes a
 *    few minutes, so POST starts it and GET ?job= reports on it.
 *  - "slideshow": their photos with slow zooms under the voice, made at once.
 * Either way the result is a stored take, ready for the AI edit.
 */

/** Avatar videos per advisor per hour, and per month (each costs voice and video time). */
const PER_HOUR = 6;
const PER_MONTH = () => Math.max(1, Number(process.env.AVATAR_MONTHLY_LIMIT) || 20);
const recent = new Map<string, number[]>();

interface Job {
  userId: string;
  vertical: boolean;
  /** Renom's video this take is for. */
  videoId?: string;
  startedAt: string;
  /** "look": the photo avatar is still being made; "video": the video is rendering. */
  stage: "look" | "video";
  lookId: string;
  audioAssetId: string;
  title?: string;
  renderId?: string;
  take?: StoredTake;
  error?: string;
}
const jobKey = (id: string) => `avatarjob/${id}.json`;
const quotaKey = (userId: string) => `avatarquota/${userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)}.json`;
/** The photo avatar made from one of the advisor's photos, kept so it's only made once. */
const lookKey = (userId: string, photoId: string, vertical: boolean) => `avatarlook/${crypto.createHash("sha256").update(`${userId}:${photoId}:${vertical ? "v" : "h"}`).digest("hex").slice(0, 32)}.json`;
const month = () => new Date().toISOString().slice(0, 7);

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const fail = (e: unknown, where: string) => {
  if (e instanceof VoiceError) return json({ ok: false, error: e.message }, e.status);
  console.error(`[avatar] ${where}`, e);
  return json({ ok: false, error: "Couldn’t make the avatar video. Please try again." }, 500);
};

async function readPhoto(id: string, dir: string, i: number) {
  const r = await objects().read(mediaKey(id)).catch(() => null);
  if (!r) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(r.contentType)) {
    void r.body.cancel().catch(() => {});
    return null;
  }
  const file = path.join(dir, `photo${i}`);
  await fs.writeFile(file, new Uint8Array(await new Response(r.body).arrayBuffer()));
  return file;
}

async function store(file: string, take: { durationSec: number; width: number; height: number }, videoId?: string): Promise<StoredTake> {
  const size = (await fs.stat(file)).size;
  const rec = await saveUpload({ filename: "avatar.mp4", mimeType: "video/mp4", size, durationSec: take.durationSec, videoId }, file);
  const processor = await getProcessor();
  const { remoteId } = await processor.upload(rec, file);
  await updateUpload(rec.id, { remoteId });
  return { sourceId: rec.id, url: `/api/video/files/${rec.id}`, mimeType: "video/mp4", durationSec: take.durationSec, width: take.width, height: take.height, recordedAt: new Date().toISOString() };
}

async function takeQuota(user: User): Promise<string | null> {
  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 3600_000);
  if (mine.length >= PER_HOUR) return `That’s ${PER_HOUR} avatar videos this hour. Try again a little later.`;
  const q = (await getJSON<{ month: string; count: number }>(quotaKey(user.id)).catch(() => null)) ?? { month: month(), count: 0 };
  const count = q.month === month() ? q.count : 0;
  if (count >= PER_MONTH()) return `You’ve made ${PER_MONTH()} avatar videos this month, the plan’s limit. It resets on the 1st.`;
  recent.set(user.id, [...mine, now]);
  await putJSON(quotaKey(user.id), { month: month(), count: count + 1 });
  return null;
}

async function refund(user: User) {
  recent.set(user.id, (recent.get(user.id) ?? []).slice(0, -1));
  const q = await getJSON<{ month: string; count: number }>(quotaKey(user.id)).catch(() => null);
  if (q && q.month === month() && q.count > 0) await putJSON(quotaKey(user.id), { month: q.month, count: q.count - 1 }).catch(() => {});
}

/** Body: { text, photoIds: media ids (talking uses the first), vertical, videoId, mode: "talking" | "slideshow" }. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ ok: false, error: "Sign in first." }, 401);
  if (!(await isPro(user))) return proOnly("AI avatar videos");
  const b = (await request.json().catch(() => null)) as { text?: unknown; photoIds?: unknown; vertical?: unknown; videoId?: unknown; mode?: unknown } | null;
  const text = typeof b?.text === "string" ? b.text.replace(/\s+/g, " ").trim().slice(0, 4500) : "";
  const ids = Array.isArray(b?.photoIds) ? b.photoIds.filter(isMediaId).slice(0, 6) : [];
  const videoId = typeof b?.videoId === "string" && /^[\w-]{1,40}$/.test(b.videoId) ? b.videoId : undefined;
  const vertical = b?.vertical !== false;
  const talking = b?.mode !== "slideshow";
  if (text.length < 20) return json({ ok: false, error: "The script is too short to read." }, 400);
  if (!ids.length) return json({ ok: false, error: "Pick a photo of you." }, 400);

  const limited = await takeQuota(user);
  if (limited) return json({ ok: false, error: limited }, 429);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-avatar-"));
  try {
    if (talking) {
      if (!avatarConfigured()) throw new VoiceError("Talking avatars aren’t switched on for this studio yet. Use Photo slideshow for now.", 503);
      // The advisor's AI voice reads the script first: no point making an avatar if that fails.
      const speech = await speak(user, text);
      const audioAssetId = await uploadAsset(speech, "audio/mpeg", "voice.mp3");
      // Their photo avatar: reuse the one made from this photo before, unless it failed.
      const lk = lookKey(user.id, ids[0], vertical);
      let lookId = (await getJSON<{ lookId: string }>(lk).catch(() => null))?.lookId;
      let st = lookId ? await lookStatus(lookId).catch(() => null) : null;
      if (!lookId || !st || st.state === "failed") {
        const src = await readPhoto(ids[0], dir, 0);
        if (!src) throw new VoiceError("That photo couldn’t be read. Pick another.", 400);
        const photo = path.join(dir, "avatar.jpg");
        await prepareAvatarPhoto(src, photo, vertical);
        const asset = await uploadAsset(new Uint8Array(await fs.readFile(photo)), "image/jpeg", "photo.jpg");
        lookId = await createPhotoLook(`Renom ${user.name || user.email}`.trim(), asset);
        await putJSON(lk, { lookId });
        st = await lookStatus(lookId).catch(() => ({ state: "working" }) as const);
      }
      if (st.state === "failed") throw new VoiceError(st.reason, 400);
      const job = crypto.randomBytes(10).toString("hex");
      const base: Job = { userId: user.id, vertical, videoId, startedAt: new Date().toISOString(), stage: "look", lookId, audioAssetId, title: text.slice(0, 80) };
      if (st.state === "ready") Object.assign(base, { stage: "video", renderId: await startAvatarVideo({ lookId, audioAssetId, vertical, engines: st.engines, title: base.title }) });
      await putJSON(jobKey(job), base);
      return json({ ok: true, job });
    }
    const photos = (await Promise.all(ids.map((id, i) => readPhoto(id, dir, i)))).filter((f): f is string => !!f);
    if (!photos.length) throw new VoiceError("Those photos couldn’t be read. Pick others.", 400);
    const audio = path.join(dir, "voice.mp3");
    await fs.writeFile(audio, await speak(user, text));
    const out = path.join(dir, "avatar.mp4");
    const take = await store(out, await buildAvatarTake({ photos, audio, out, vertical }), videoId);
    return json({ ok: true, take });
  } catch (e) {
    await refund(user);
    return fail(e, "start");
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** ?job=<id>: how a talking avatar is coming along; the stored take once it's done. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ ok: false, error: "Sign in first." }, 401);
  const id = new URL(request.url).searchParams.get("job") ?? "";
  if (!/^[a-f0-9]{20}$/.test(id)) return json({ ok: false, error: "Unknown video." }, 404);
  const job = await getJSON<Job>(jobKey(id)).catch(() => null);
  if (!job || job.userId !== user.id) return json({ ok: false, error: "Unknown video." }, 404);
  if (job.take) return json({ ok: true, state: "done", take: job.take });
  if (job.error) return json({ ok: true, state: "failed", error: job.error });

  const elapsedSec = Math.round((Date.now() - Date.parse(job.startedAt)) / 1000);
  if (!job.stage || !job.lookId) return json({ ok: true, state: "failed", error: "Please make this video again." });
  try {
    // Still making the photo avatar: once it's ready, start the video.
    if (job.stage === "look") {
      const lk = await lookStatus(job.lookId);
      if (lk.state === "failed") {
        await putJSON(jobKey(id), { ...job, error: lk.reason });
        await refund(user);
        return json({ ok: true, state: "failed", error: lk.reason });
      }
      if (lk.state === "working") return json({ ok: true, state: "working", phase: "avatar", elapsedSec });
      job.renderId = await startAvatarVideo({ lookId: job.lookId, audioAssetId: job.audioAssetId, vertical: job.vertical, engines: lk.engines, title: job.title });
      job.stage = "video";
      await putJSON(jobKey(id), job);
      return json({ ok: true, state: "working", phase: "video", elapsedSec });
    }
  } catch (e) {
    if (e instanceof VoiceError && e.status < 500 && e.status !== 429) {
      await putJSON(jobKey(id), { ...job, error: e.message });
      await refund(user);
      return json({ ok: true, state: "failed", error: e.message });
    }
    return json({ ok: true, state: "working", elapsedSec });
  }

  const st = await avatarVideoStatus(job.renderId ?? "").catch((e) => (e instanceof VoiceError && e.status < 500 ? ({ state: "failed", reason: e.message } as const) : ({ state: "working" } as const)));
  if (st.state === "working") {
    // Give up after an hour: something's stuck on the service's side.
    if (elapsedSec < 3600) return json({ ok: true, state: "working", phase: "video", elapsedSec });
    await putJSON(jobKey(id), { ...job, error: "This one took too long. Please make it again." });
    return json({ ok: true, state: "failed", error: "This one took too long. Please make it again." });
  }
  if (st.state === "failed") {
    await putJSON(jobKey(id), { ...job, error: st.reason });
    await refund(user);
    return json({ ok: true, state: "failed", error: st.reason });
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-avatar-"));
  try {
    // The finished file sits behind a short-lived signed link: download it now.
    const res = await fetch(st.url, { cache: "no-store", signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const raw = path.join(dir, "raw.mp4");
    await fs.writeFile(raw, new Uint8Array(await res.arrayBuffer()));
    const out = path.join(dir, "avatar.mp4");
    const take = await store(out, await normalizeTalkingVideo(raw, out, job.vertical), job.videoId);
    await putJSON(jobKey(id), { ...job, take });
    return json({ ok: true, state: "done", take });
  } catch (e) {
    return fail(e, "finish");
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
