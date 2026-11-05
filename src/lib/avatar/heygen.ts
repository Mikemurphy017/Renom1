import { VoiceError } from "@/lib/voice/server";

/**
 * Talking avatars: the advisor's photo, lip-synced to their AI voice. Server
 * only; the provider and its key never reach the browser, and nothing
 * user-facing names the provider.
 *
 * Flow: upload the photo → make a photo avatar look (a few minutes the first
 * time, then reused) → upload the speech → render with the best engine the
 * look supports → download the result.
 */

const KEY = () => process.env.HEYGEN_API_KEY?.trim() ?? "";
const BASE = () => (process.env.HEYGEN_API_URL?.trim() || "https://api.heygen.com").replace(/\/+$/, "");
export const avatarConfigured = () => !!KEY();

interface ApiError {
  error?: { code?: string; message?: string; param?: string } | null;
}

async function call<T>(path: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  if (!avatarConfigured()) throw new VoiceError("Talking avatars aren’t set up for this studio yet.", 503);
  let res: Response;
  try {
    res = await fetch(`${BASE()}${path}`, { ...init, headers: { "x-api-key": KEY(), Accept: "application/json", ...(init.headers ?? {}) }, cache: "no-store", signal: AbortSignal.timeout(init.timeout ?? 60_000) });
  } catch {
    throw new VoiceError("Couldn’t reach the avatar service. Try again in a moment.");
  }
  const j = (await res.json().catch(() => null)) as (ApiError & { data?: unknown }) | null;
  if (!res.ok || j?.error) {
    const e = j?.error ?? {};
    console.error(`[avatar] ${res.status} ${path}: ${e.code ?? ""} ${e.param ?? ""} ${(e.message ?? "").slice(0, 300)}`);
    if (res.status === 401) throw new VoiceError("The studio’s avatar key was refused. Your administrator can check it.", 503);
    if (res.status === 429) throw new VoiceError("The avatar service is busy. Try again in a minute.", 429);
    if (res.status === 402 || /credit|quota|insufficient|balance|plan/i.test(`${e.code} ${e.message}`)) throw new VoiceError("The studio has used its avatar video allowance for now. Your administrator can add more.", 402);
    if (/moderat|policy|blocked/i.test(`${e.code} ${e.message}`)) throw new VoiceError("The avatar service declined this photo or script. Try a different photo, or reword the script.", 400);
    throw new VoiceError(res.status >= 500 ? "The avatar service had a problem. Please try again." : "The avatar service couldn’t use that request. Try a different photo.", res.status >= 500 ? 502 : 400);
  }
  return (j?.data ?? j) as T;
}

/** Uploads a file (photo or speech) and returns its asset id. */
export async function uploadAsset(bytes: Uint8Array, mime: string, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), name);
  const d = await call<{ asset_id?: string }>("/v3/assets", { method: "POST", body: form, timeout: 120_000 });
  if (!d.asset_id) throw new VoiceError("The avatar service didn’t accept the upload. Try again.");
  return d.asset_id;
}

/** Makes a photo avatar look from an uploaded photo. Returns the look id (used as avatar_id). */
export async function createPhotoLook(name: string, assetId: string): Promise<string> {
  const d = await call<{ avatar_item?: { id?: string } }>("/v3/avatars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "photo", name: name.slice(0, 100), file: { type: "asset_id", asset_id: assetId } }),
  });
  const id = d.avatar_item?.id;
  if (!id) throw new VoiceError("The avatar service didn’t create the avatar. Try again.");
  return id;
}

export type LookState = { state: "working" } | { state: "ready"; engines: string[] } | { state: "failed"; reason: string };

export async function lookStatus(lookId: string): Promise<LookState> {
  let d: { status?: string | null; supported_api_engines?: string[]; error?: { code?: string; message?: string } | null };
  try {
    d = await call(`/v3/avatars/looks/${encodeURIComponent(lookId)}`, { timeout: 20_000 });
  } catch (e) {
    if (e instanceof VoiceError && (e.status === 429 || e.status >= 500)) return { state: "working" };
    throw e;
  }
  if (d.status === "failed") {
    console.error(`[avatar] look ${lookId} failed: ${d.error?.code ?? ""} ${(d.error?.message ?? "").slice(0, 200)}`);
    return { state: "failed", reason: d.error?.code === "moderation_failed" ? "The avatar service declined this photo. Pick a different photo of just you." : "That photo couldn’t be turned into an avatar. Pick a clear, front-facing photo of just you." };
  }
  if (d.status === "processing") return { state: "working" };
  return { state: "ready", engines: d.supported_api_engines ?? [] };
}

/** Starts the talking video. Uses Avatar V when the look supports it. */
export async function startAvatarVideo(o: { lookId: string; audioAssetId: string; vertical: boolean; engines: string[]; title?: string }): Promise<string> {
  const v = o.engines.includes("avatar_v");
  const body = {
    type: "avatar",
    avatar_id: o.lookId,
    audio_asset_id: o.audioAssetId,
    title: o.title?.slice(0, 200) || "Renom avatar video",
    resolution: "1080p",
    aspect_ratio: o.vertical ? "9:16" : "16:9",
    ...(v
      ? { engine: { type: "avatar_v", more_blinking: true } }
      : { expressiveness: "medium", motion_prompt: "Speaking warmly and confidently to camera, natural head movement, occasional small hand gestures." }),
  };
  const d = await call<{ video_id?: string }>("/v3/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!d.video_id) throw new VoiceError("The avatar service didn’t start the video. Try again.");
  return d.video_id;
}

export type VideoState = { state: "working" } | { state: "done"; url: string } | { state: "failed"; reason: string };

export async function avatarVideoStatus(videoId: string): Promise<VideoState> {
  let d: { status?: string; video_url?: string | null; failure_code?: string | null; failure_message?: string | null };
  try {
    d = await call(`/v3/videos/${encodeURIComponent(videoId)}`, { timeout: 20_000 });
  } catch (e) {
    if (e instanceof VoiceError && (e.status === 429 || e.status >= 500)) return { state: "working" };
    throw e;
  }
  if (d.status === "completed") return d.video_url ? { state: "done", url: d.video_url } : { state: "failed", reason: "The video came back empty. Please make it again." };
  if (d.status === "failed") {
    console.error(`[avatar] video ${videoId} failed: ${d.failure_code ?? ""} ${(d.failure_message ?? "").slice(0, 300)}`);
    return { state: "failed", reason: /moderat|policy/i.test(`${d.failure_code} ${d.failure_message}`) ? "The avatar service declined this photo or script. Try a different photo, or reword the script." : "The avatar service couldn’t make this one. Please try again, or pick a different photo." };
  }
  return { state: "working" };
}
