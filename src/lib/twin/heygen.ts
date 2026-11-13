import { promises as fs } from "node:fs";

/**
 * The AI twin service, over its v3 HTTP API. Server only: the key
 * (HEYGEN_API_KEY) never reaches the browser, and nothing advisors see names
 * the provider.
 *
 *  - Voice: an instant clone from one recording (POST /v3/models/audio/voices).
 *  - Twin: a digital twin trained from footage of the advisor talking
 *    (POST /v3/avatars type digital_twin), cleared by the advisor's own consent
 *    recording on the provider's hosted page.
 *  - Photos: photo looks of the same person, in the twin's group, so they
 *    move like the twin (engine avatar_v uses the twin as the motion reference).
 *  - Videos: POST /v3/videos type avatar with a look, the cloned voice and a script.
 */

const KEY = () => process.env.HEYGEN_API_KEY?.trim() ?? "";
const BASE = () => (process.env.HEYGEN_API_URL?.trim() || "https://api.heygen.com").replace(/\/+$/, "");
export const twinConfigured = () => !!KEY();

export class TwinError extends Error {
  constructor(message: string, readonly status = 502, readonly code?: string) {
    super(message);
  }
}

interface Envelope<T> {
  data?: T;
  error?: { code?: string; message?: string; param?: string } | null;
}

async function call<T>(path: string, init: RequestInit & { timeout?: number; idem?: string } = {}): Promise<T> {
  if (!twinConfigured()) throw new TwinError("AI videos aren’t switched on for this studio yet.", 503);
  const headers: Record<string, string> = { "X-Api-Key": KEY(), Accept: "application/json", ...((init.headers as Record<string, string>) ?? {}) };
  if (init.idem) headers["Idempotency-Key"] = init.idem;
  let res: Response;
  try {
    res = await fetch(`${BASE()}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(init.timeout ?? 60_000) });
  } catch {
    throw new TwinError("Couldn’t reach the AI video service. Try again in a moment.", 502, "unreachable");
  }
  const j = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || j?.error) {
    const e = j?.error ?? {};
    const text = `${e.code ?? ""} ${e.message ?? ""}`;
    console.error(`[twin] ${res.status} ${init.method ?? "GET"} ${path}: ${e.code ?? ""} ${e.param ?? ""} ${(e.message ?? "").slice(0, 300)}`);
    if (res.status === 401) throw new TwinError("The studio’s AI video key was refused. Your administrator can check it.", 503, "auth");
    if (res.status === 429) throw new TwinError("The AI video service is busy. Try again in a minute.", 429, "busy");
    if (res.status === 402 || /credit|quota|insufficient|balance/i.test(text)) throw new TwinError("The studio has used its AI video allowance for now. Your administrator can add more.", 402, "balance");
    if (res.status === 403) throw new TwinError("This isn’t included in the studio’s AI video plan. Your administrator can upgrade it.", 403, "plan");
    if (/moderat|policy/i.test(text)) throw new TwinError("That was declined by content review. Try a different recording or photo, or reword the script.", 400, "moderation");
    if (res.status === 404) throw new TwinError("Not found.", 404, "not_found");
    throw new TwinError(res.status >= 500 ? "The AI video service had a problem. Please try again." : e.message ? `The AI video service couldn’t use that: ${e.message}` : "The AI video service couldn’t use that.", res.status >= 500 ? 502 : 400, e.code);
  }
  return (j?.data ?? (j as unknown)) as T;
}

const json = (body: unknown, idem?: string) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), idem });

// ── Uploads ──

/** Small files (audio, photos) in one request. */
export async function uploadSmall(bytes: Uint8Array, mime: string, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), name);
  const d = await call<{ asset_id?: string; id?: string }>("/v3/assets", { method: "POST", body: form, timeout: 120_000 });
  const id = d.asset_id ?? d.id;
  if (!id) throw new TwinError("The upload wasn’t accepted. Try again.");
  return id;
}

/** Large files (training footage, up to 200 MB) straight to storage: create, PUT, complete. */
export async function uploadLarge(file: string, mime: string, name: string): Promise<string> {
  const size = (await fs.stat(file)).size;
  if (size > 209_715_200) throw new TwinError("The video is over 200 MB. Export a smaller copy (1080p, about 2 minutes) and try again.", 413);
  const d = await call<{ asset_id: string; upload_url: string; upload_headers?: Record<string, string> }>("/v3/assets/direct-uploads", json({ filename: name, content_type: mime, size_bytes: size }));
  let put: Response;
  try {
    put = await fetch(d.upload_url, { method: "PUT", headers: d.upload_headers ?? { "Content-Type": mime }, body: new Uint8Array(await fs.readFile(file)) as BodyInit, signal: AbortSignal.timeout(600_000) });
  } catch (e) {
    throw new TwinError(`The upload didn’t go through: ${(e as Error).message}`);
  }
  if (!put.ok) throw new TwinError(`The upload was refused (${put.status}). Try again.`);
  await call(`/v3/assets/${encodeURIComponent(d.asset_id)}/complete`, json({}));
  return d.asset_id;
}

// ── Voice ──

export async function cloneVoice(assetId: string, name: string, idem: string): Promise<string> {
  const d = await call<{ voice_id?: string; id?: string; voice?: { voice_id?: string; id?: string } }>("/v3/models/audio/voices", json({ mode: "instant", name: name.slice(0, 64), audio: [{ type: "asset_id", asset_id: assetId }] }, idem));
  const id = d.voice_id ?? d.id ?? d.voice?.voice_id ?? d.voice?.id;
  if (!id) throw new TwinError("The voice wasn’t created. Try again.");
  return id;
}

export type VoiceState = { state: "working" } | { state: "ready"; previewUrl?: string } | { state: "failed"; reason: string };

export async function voiceStatus(voiceId: string): Promise<VoiceState> {
  const d = await call<{ status?: string; failure_reason?: string | null; preview_audio_url?: string | null; voice?: { status?: string; failure_reason?: string | null; preview_audio_url?: string | null } }>(`/v3/models/audio/voices/${encodeURIComponent(voiceId)}`, { timeout: 20_000 });
  const v = d.voice ?? d;
  const st = (v.status ?? "").toUpperCase();
  if (st === "ACTIVE") return { state: "ready", previewUrl: v.preview_audio_url ?? undefined };
  if (st === "FAILED") {
    const why = v.failure_reason ?? "";
    return { state: "failed", reason: why === "INVALID_AUDIO" ? "That recording couldn’t be read. Upload an MP3 or WAV, or record again." : why === "PREPROCESSING_FAILED" ? "The recording didn’t pass the checks. Record about a minute of clear speech in a quiet room." : "Your voice couldn’t be made from that recording. Try again with a clearer one." };
  }
  return { state: "working" };
}

export const deleteVoice = (voiceId: string) => call(`/v3/models/audio/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" }).catch(() => {});

// ── Twin and looks ──

export async function createTwin(assetId: string, name: string, idem: string): Promise<{ lookId: string; groupId: string; voiceId?: string }> {
  const d = await call<{ avatar_item?: { id?: string; default_voice_id?: string }; avatar_group?: { id?: string } }>("/v3/avatars", json({ type: "digital_twin", name: name.slice(0, 100), file: { type: "asset_id", asset_id: assetId } }, idem));
  const lookId = d.avatar_item?.id;
  const groupId = d.avatar_group?.id;
  if (!lookId || !groupId) throw new TwinError("The twin wasn’t created. Try again.");
  return { lookId, groupId, voiceId: d.avatar_item?.default_voice_id };
}

export async function createPhotoLook(groupId: string, assetId: string, name: string, idem: string): Promise<string> {
  const d = await call<{ avatar_item?: { id?: string } }>("/v3/avatars", json({ type: "photo", name: name.slice(0, 100), avatar_group_id: groupId, file: { type: "asset_id", asset_id: assetId } }, idem));
  if (!d.avatar_item?.id) throw new TwinError("The photo wasn’t accepted. Try a different one.");
  return d.avatar_item.id;
}

/** A new look of the same person: a new outfit and setting, from a description. Joins the reference look's group. */
export async function createPromptLook(o: { refLookId: string; groupId: string; name: string; prompt: string; aspect: "9:16" | "16:9"; idem: string }): Promise<string> {
  const d = await call<{ avatar_item?: { id?: string } }>("/v3/avatars", json({ type: "prompt", name: o.name.slice(0, 100), prompt: o.prompt.slice(0, 1000), avatar_id: o.refLookId, avatar_group_id: o.groupId, aspect_ratio: o.aspect }, o.idem));
  if (!d.avatar_item?.id) throw new TwinError("The new look wasn’t started. Try again.");
  return d.avatar_item.id;
}

/** A curated set of looks (a look pack, usually five) for the same person. */
export async function createLookPack(o: { refLookId: string; templateId: string; aspect: "9:16" | "16:9"; idem: string }): Promise<string[]> {
  const d = await call<{ looks?: ({ id?: string } | string)[] }>("/v3/avatars/looks", json({ type: "look_pack", reference_look_id: o.refLookId, template_id: o.templateId, aspect_ratio: o.aspect }, o.idem));
  const ids = (d.looks ?? []).map((l) => (typeof l === "string" ? l : l.id)).filter((x): x is string => !!x);
  if (!ids.length) throw new TwinError("The looks weren’t started. Try again.");
  return ids;
}

export const deleteLook = (lookId: string) => call(`/v3/avatars/looks/${encodeURIComponent(lookId)}`, { method: "DELETE" }).catch(() => {});

/** Fetches a look's preview image (no key: it's a plain file URL). */
export async function fetchPreview(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    return bytes.length && bytes.length < 15_000_000 ? { bytes, type } : null;
  } catch {
    return null;
  }
}

export type LookState ={ state: "working" } | { state: "ready"; engines: string[]; preview?: string } | { state: "failed"; reason: string };

export async function lookStatus(lookId: string): Promise<LookState> {
  const d = await call<{ status?: string | null; supported_api_engines?: string[]; preview_image_url?: string | null; image_url?: string | null; error?: { code?: string; message?: string } | null }>(`/v3/avatars/looks/${encodeURIComponent(lookId)}`, { timeout: 20_000 });
  if (d.status === "failed") return { state: "failed", reason: d.error?.code === "moderation_failed" ? "That was declined by content review. Use a different recording or photo of just you." : d.error?.message || "It couldn’t be trained from that. Try a clearer recording or photo." };
  if (d.status === "processing" || d.status === "pending" || d.status === "upgrading") return { state: "working" };
  return { state: "ready", engines: d.supported_api_engines ?? [], preview: d.preview_image_url ?? d.image_url ?? undefined };
}

/** A link (valid 24 hours) where the advisor records their consent on camera. */
export async function consentLink(groupId: string, returnUrl: string, idem: string): Promise<string | null> {
  const d = await call<{ url?: string; consent_url?: string; avatar_group?: { consent_status?: string } }>(`/v3/avatars/${encodeURIComponent(groupId)}/consent`, json({ reroute_url: returnUrl }, idem));
  return d.url ?? d.consent_url ?? null;
}

export async function consentStatus(groupId: string): Promise<"pending" | "accepted" | "rejected" | null> {
  const d = await call<{ consent_status?: string | null; avatar_group?: { consent_status?: string | null } }>(`/v3/avatars/${encodeURIComponent(groupId)}`, { timeout: 20_000 });
  const s = d.avatar_group?.consent_status ?? d.consent_status ?? null;
  return s === "accepted" || s === "rejected" || s === "pending" ? s : null;
}

export const deleteGroup = (groupId: string) => call(`/v3/avatars/${encodeURIComponent(groupId)}`, { method: "DELETE" }).catch(() => {});

// ── Videos ──

export async function startVideo(o: { lookId: string; voiceId?: string; script: string; aspect: "9:16" | "16:9"; engines: string[]; title: string; idem: string }): Promise<string> {
  const base = { type: "avatar", avatar_id: o.lookId, script: o.script, ...(o.voiceId ? { voice_id: o.voiceId } : {}), aspect_ratio: o.aspect, resolution: "1080p", title: o.title.slice(0, 200) };
  // Avatar V moves like the advisor's own footage (their twin is the reference); Avatar IV otherwise.
  const body = o.engines.includes("avatar_v") ? { ...base, engine: { type: "avatar_v", more_blinking: true } } : base;
  const d = await call<{ video_id?: string; id?: string }>("/v3/videos", json(body, o.idem));
  const id = d.video_id ?? d.id;
  if (!id) throw new TwinError("The video wasn’t started. Try again.");
  return id;
}

export type VideoState = { state: "working" } | { state: "done"; url: string } | { state: "failed"; reason: string };

export async function videoStatus(videoId: string): Promise<VideoState> {
  const d = await call<{ status?: string; video_url?: string | null; failure_code?: string | null; failure_message?: string | null }>(`/v3/videos/${encodeURIComponent(videoId)}`, { timeout: 20_000 });
  if (d.status === "completed") return d.video_url ? { state: "done", url: d.video_url } : { state: "failed", reason: "The video came back empty. Please make it again." };
  if (d.status === "failed") return { state: "failed", reason: /moderat|policy/i.test(`${d.failure_code} ${d.failure_message}`) ? "The script or photo was declined by content review. Reword it or pick another look." : "This one couldn’t be made. Please try again." };
  return { state: "working" };
}
