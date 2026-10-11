"use client";

import type { CoverImage, RenderedVideo, Video } from "@/lib/types";

/**
 * The cover at the start of the finished video (see /api/video/intro), so the
 * advisor never has to download the thumbnail and add it by hand. On by
 * default; kept in step whenever the cover or the render changes.
 */

export const coverIntroOn = (v: Pick<Video, "coverIntro">) => v.coverIntro !== false;

/** The cover that matches the render's shape. */
export const coverForOutput = (v: Pick<Video, "output" | "covers">): CoverImage | undefined => (v.output ? v.covers?.[v.output.aspect === "9:16" ? "short" : "long"] : undefined);

/** The render from Edit, without a cover. */
export function plainOutput(out: RenderedVideo): RenderedVideo {
  if (!out.withCover) return out;
  const { withCover, ...rest } = out;
  return { ...rest, ...withCover.plain };
}

/** Where the cover frame is in the video, for networks that pick a frame: the start, once it's been added. */
export const coverFrameMs = (v: Pick<Video, "output">, cover: Pick<CoverImage, "id" | "frameMs">) => (v.output?.withCover?.coverId === cover.id ? 0 : cover.frameMs);

/** What the video's output should be changed to, or null if it's already right. */
export function coverIntroNeeded(v: Pick<Video, "output" | "covers" | "coverIntro">): "add" | "remove" | null {
  const out = v.output;
  if (!out) return null;
  const cover = coverIntroOn(v) ? coverForOutput(v) : undefined;
  if (cover) return out.withCover?.coverId === cover.id ? null : "add";
  return out.withCover ? "remove" : null;
}

const inFlight = new Map<string, Promise<RenderedVideo | null>>();

/**
 * Bring the output in line with the cover and the switch. Returns the new
 * output to save (null when nothing changed). Calls for the same video share one request.
 */
export function syncCoverIntro(v: Pick<Video, "id" | "output" | "covers" | "coverIntro">): Promise<RenderedVideo | null> {
  const need = coverIntroNeeded(v);
  if (!need || !v.output) return Promise.resolve(null);
  const plain = plainOutput(v.output);
  if (need === "remove") return Promise.resolve(plain);
  const cover = coverForOutput(v)!;
  const key = `${v.id}:${plain.id}:${cover.id}`;
  const running = inFlight.get(key);
  if (running) return running;
  const p = (async () => {
    const res = await fetch("/api/video/intro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outputId: plain.id, coverId: cover.id }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || `Couldn’t add the cover (${res.status})`);
    const o = body.output as { id: string; url: string; durationSec: number; sizeBytes?: number };
    return { ...plain, ...o, withCover: { coverId: cover.id, introSec: body.introSec as number, plain: { id: plain.id, url: plain.url, durationSec: plain.durationSec, sizeBytes: plain.sizeBytes } } };
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}
