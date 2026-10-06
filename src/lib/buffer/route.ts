import { NextResponse } from "next/server";
import { BufferError, bufferConfigured } from "./server";
import type { BufferService } from "./types";

/** Shared validation and JSON helpers for the /api/buffer routes (server only). */

export const SERVICES: BufferService[] = ["bluesky", "facebook", "googlebusiness", "instagram", "linkedin", "mastodon", "pinterest", "startPage", "substack", "threads", "tiktok", "twitter", "whatsapp", "youtube"];

/** Buffer ids (posts, channels, orgs, tags, idea groups) are 24-character hex. */
export const isBufferId = (v: unknown): v is string => typeof v === "string" && /^[a-f\d]{24}$/i.test(v);

export const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export const notConnected = () => (bufferConfigured() ? null : fail("Buffer is not connected", 503));

/** Turn anything thrown by the Buffer client into a clean JSON error. */
export function fromError(e: unknown) {
  if (e instanceof BufferError) return fail(e.message, e.status);
  return fail((e as Error)?.message || "Unexpected error", 500);
}

/** ISO date-time → normalized ISO string, or null when it doesn't parse. */
export function parseDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export async function readJson<T>(request: Request): Promise<Partial<T> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/** `a,b` or repeated `?k=a&k=b` → ["a", "b"]. */
export function listParam(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}
