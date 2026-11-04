import { getJSON, objects, putJSON } from "@/lib/storage/objects";
import type { User } from "@/lib/auth/server";

/**
 * The advisor's AI voice: cloned from a minute or two of them talking, then
 * used to read scripts for avatar videos. Server-only; the provider and its
 * key never reach the browser, and nothing user-facing names the provider.
 */

const KEY = () => process.env.ELEVENLABS_API_KEY?.trim() ?? "";
const BASE = () => (process.env.ELEVENLABS_API_URL?.trim() || "https://api.elevenlabs.io").replace(/\/+$/, "");
export const voiceConfigured = () => !!KEY();

/** The speech model: natural, multilingual, the best match to a cloned voice. */
const MODEL = () => process.env.VOICE_MODEL_ID?.trim() || "eleven_multilingual_v2";

export class VoiceError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export interface VoiceRecord {
  voiceId: string;
  createdAt: string;
  /** Seconds of sample audio it was made from (as the browser reported). */
  sampleSeconds?: number;
}

const recordKey = (userId: string) => `voice/${userId}.json`;
export const readVoice = (userId: string) => getJSON<VoiceRecord>(recordKey(userId)).catch(() => null);

async function call(path: string, init: RequestInit & { timeout?: number } = {}): Promise<Response> {
  if (!voiceConfigured()) throw new VoiceError("AI voice isn’t set up for this studio yet.", 503);
  let res: Response;
  try {
    res = await fetch(`${BASE()}${path}`, { ...init, headers: { "xi-api-key": KEY(), ...(init.headers ?? {}) }, cache: "no-store", signal: AbortSignal.timeout(init.timeout ?? 120_000) });
  } catch {
    throw new VoiceError("Couldn’t reach the voice service. Try again in a moment.");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { detail?: { message?: string; status?: string } | string } | null;
    const detail = typeof j?.detail === "string" ? j.detail : (j?.detail?.message ?? "");
    console.error(`[voice] ${res.status} ${path}: ${detail.slice(0, 300)}`);
    if (res.status === 401) throw new VoiceError("The studio’s voice key was refused. Your administrator can check it.", 503);
    if (res.status === 429) throw new VoiceError("The voice service is busy. Try again in a minute.", 429);
    if (/quota|credits|limit/i.test(detail)) throw new VoiceError("The studio has used its AI voice allowance for now. Your administrator can raise it.", 402);
    throw new VoiceError(res.status === 400 || res.status === 422 ? "That audio couldn’t be used. Record a clear minute or two of you talking, with no music or other voices." : `The voice service returned an error (${res.status}).`);
  }
  return res;
}

/** Makes (or remakes) the advisor's AI voice from their samples. */
export async function cloneVoice(user: User, samples: { bytes: Uint8Array; type: string; name: string }[], sampleSeconds?: number): Promise<VoiceRecord> {
  if (!samples.length) throw new VoiceError("Add a recording of your voice.", 400);
  const old = await readVoice(user.id);
  const form = new FormData();
  form.append("name", `Renom ${user.id}`);
  form.append("description", `AI voice for ${user.email}`);
  form.append("remove_background_noise", "true");
  for (const s of samples) form.append("files", new Blob([s.bytes as BlobPart], { type: s.type }), s.name);
  const res = await call("/v1/voices/add", { method: "POST", body: form, timeout: 180_000 });
  const j = (await res.json()) as { voice_id?: string };
  if (!j.voice_id) throw new VoiceError("The voice service didn’t return a voice. Try again.");
  const rec: VoiceRecord = { voiceId: j.voice_id, createdAt: new Date().toISOString(), sampleSeconds };
  await putJSON(recordKey(user.id), rec);
  // The old voice is replaced; remove it from the service.
  if (old?.voiceId) await call(`/v1/voices/${old.voiceId}`, { method: "DELETE" }).catch(() => {});
  return rec;
}

export async function deleteVoice(user: User) {
  const rec = await readVoice(user.id);
  if (rec?.voiceId) await call(`/v1/voices/${rec.voiceId}`, { method: "DELETE" }).catch((e) => console.warn("[voice] delete:", (e as Error).message));
  await objects().remove(recordKey(user.id)).catch(() => {});
}

/** The advisor's AI voice reading `text`, as MP3 bytes. */
export async function speak(user: User, text: string): Promise<Uint8Array> {
  const rec = await readVoice(user.id);
  if (!rec) throw new VoiceError("Create your AI voice first (Settings → Your AI voice).", 409);
  const res = await call(`/v1/text-to-speech/${encodeURIComponent(rec.voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL(), voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true } }),
    timeout: 180_000,
  });
  return new Uint8Array(await res.arrayBuffer());
}
