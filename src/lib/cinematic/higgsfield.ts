import { priceFrom } from "./core";

/**
 * Higgsfield, server only, over its documented HTTP API: file uploads, cost
 * estimates, generation submissions and request status. Every submission
 * carries an Idempotency-Key, so repeating it after a timeout returns the
 * original request instead of creating, and charging for, another.
 *
 * The official SDK (@higgsfield/client, see scripts/higgsfield/index.ts) is
 * not used here: its TypeScript client only does submit-and-wait, has no
 * idempotency option, retries on its own, and replaces a 403's reason with a
 * generic "not enough credits", so a plan limit couldn't be told from a low
 * balance. HF_CREDENTIALS ("key-id:key-secret") is read at call time and never
 * logged.
 */

const creds = () => process.env.HF_CREDENTIALS?.trim() ?? "";
const BASE = () => (process.env.HF_API_URL?.trim() || "https://api.higgsfield.ai").replace(/\/+$/, "");
export const higgsfieldConfigured = () => creds().includes(":");

/**
 * auth/balance/plan/validation/not_found never fix themselves: don't retry,
 * tell the admin. busy/transient do: retry with backoff.
 */
export type HfErrorKind = "auth" | "balance" | "plan" | "validation" | "not_found" | "busy" | "transient";
export class HfError extends Error {
  constructor(readonly kind: HfErrorKind, message: string, readonly status?: number) {
    super(message);
  }
  get retryable() {
    return this.kind === "busy" || this.kind === "transient";
  }
}

function classify(status: number | undefined, detail: unknown): HfError {
  const text = typeof detail === "string" ? detail : JSON.stringify(detail ?? "");
  const short = text.slice(0, 300);
  if (/plan or higher|requires .{0,20}plan|not entitled|entitlement|upgrade your/i.test(text)) return new HfError("plan", `Plan or entitlement: ${short}`, status);
  if (status === 401) return new HfError("auth", "Higgsfield refused the API credentials.", status);
  if (status === 403) return new HfError("balance", `Insufficient Higgsfield balance, or not allowed: ${short}`, status);
  if (status === 404) return new HfError("not_found", `Model or request not found for this account: ${short}`, status);
  if (status === 400 || status === 422) return new HfError("validation", `Higgsfield rejected the request: ${short}`, status);
  if (status === 429 || status === 423 || status === 503) return new HfError("busy", `Higgsfield is busy (${status}): ${short}`, status);
  return new HfError("transient", `Higgsfield error${status ? ` ${status}` : ""}: ${short}`, status);
}

async function http<T>(path: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  if (!higgsfieldConfigured()) throw new HfError("auth", "HF_CREDENTIALS is not set.");
  let res: Response;
  try {
    res = await fetch(`${BASE()}${path}`, { ...init, headers: { Authorization: `Key ${creds()}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) }, cache: "no-store", signal: AbortSignal.timeout(init.timeout ?? 30_000) });
  } catch (e) {
    throw new HfError("transient", `Couldn’t reach Higgsfield: ${(e as Error).message}`);
  }
  const j = (await res.json().catch(() => null)) as (T & { detail?: unknown }) | null;
  if (!res.ok) throw classify(res.status, j?.detail ?? j);
  return j as T;
}

/** Puts a file where Higgsfield's models can read it; returns its URL. Credentials never go to the storage URL. */
export async function uploadMedia(bytes: Uint8Array, contentType: "image/jpeg" | "image/png" | "image/webp"): Promise<string> {
  const slot = await http<{ public_url: string; upload_url: string; upload_headers?: Record<string, string> }>("/files/generate-upload-url", { method: "POST", body: JSON.stringify({ content_type: contentType }) });
  let put: Response;
  try {
    put = await fetch(slot.upload_url, { method: "PUT", headers: slot.upload_headers ?? { "Content-Type": contentType }, body: bytes as BodyInit, signal: AbortSignal.timeout(120_000) });
  } catch (e) {
    throw new HfError("transient", `Upload didn’t go through: ${(e as Error).message}`);
  }
  if (!put.ok) throw new HfError(put.status >= 500 ? "transient" : "validation", `Upload was refused (${put.status}).`, put.status);
  return slot.public_url;
}

/**
 * What a request will cost, in US dollars, or null when Higgsfield won't say.
 * Never blocks a job. Some models answer with a figure, others with their rate
 * per second of video at each resolution; both are turned into one number.
 */
export async function estimateUsd(model: string, input: Record<string, unknown>): Promise<number | null> {
  try {
    const r = await http<{ usd?: string | number; pricing_description?: string }>(`/estimate/${model}`, { method: "POST", body: JSON.stringify(input), timeout: 15_000 });
    return priceFrom(r, input);
  } catch {
    return null;
  }
}

/**
 * Submits a generation and returns its request id without waiting. Call it
 * again with the same key after a timeout: Higgsfield returns the original
 * request rather than a second one.
 */
export async function submit(model: string, input: Record<string, unknown>, idempotencyKey: string): Promise<string> {
  const r = await http<{ request_id?: string }>(`/${model.replace(/^\/+/, "")}`, { method: "POST", body: JSON.stringify(input), headers: { "Idempotency-Key": idempotencyKey }, timeout: 60_000 });
  if (!r?.request_id) throw new HfError("transient", "Higgsfield accepted the request but returned no request id.");
  return r.request_id;
}

export type HfResult = { state: "working" } | { state: "done"; url: string } | { state: "failed"; reason: "moderated" | "failed" | "canceled"; detail: string };

/** Where a request is. A network blip or a 5xx counts as still working; it's asked again later. */
export async function requestStatus(requestId: string): Promise<HfResult> {
  let r: { status?: string; error?: string | null; images?: { url?: string }[]; video?: { url?: string } };
  try {
    r = await http(`/requests/${encodeURIComponent(requestId)}/status`, { timeout: 20_000 });
  } catch (e) {
    if (e instanceof HfError && e.retryable) return { state: "working" };
    throw e;
  }
  if (r.status === "completed") {
    const url = r.video?.url ?? r.images?.[0]?.url;
    return url ? { state: "done", url } : { state: "failed", reason: "failed", detail: "Completed without an output file." };
  }
  if (r.status === "nsfw") return { state: "failed", reason: "moderated", detail: r.error ?? "Rejected by moderation." };
  if (r.status === "failed") return { state: "failed", reason: "failed", detail: r.error ?? "Generation failed." };
  if (r.status === "canceled" || r.status === "cancelled") return { state: "failed", reason: "canceled", detail: "The request was canceled." };
  return { state: "working" };
}
