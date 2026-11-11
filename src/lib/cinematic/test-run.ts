import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getJSON, putJSON } from "@/lib/storage/objects";
import { saveUpload } from "@/lib/video/storage";
import { probe } from "@/lib/video/local/ffmpeg";
import { HfError, estimateUsd, requestStatus, submit, uploadMedia } from "./higgsfield";
import { videoModels } from "./models";
import { download } from "./server";
import type { CinematicAspect } from "./core";

/**
 * Admin test runs: any still and any prompt through a chosen video model, with
 * the studio's own Higgsfield key (it never leaves the server). For comparing
 * models and prompts; nothing here is visible to advisors.
 */

export interface TestRun {
  id: string;
  createdAt: string;
  by: string;
  model: string;
  prompt: string;
  seconds: number;
  resolution: "720p" | "1080p";
  aspect: CinematicAspect;
  requestId: string;
  usd: number | null;
  status: "working" | "ready" | "failed";
  error?: string;
  videoUrl?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  finishedAt?: string;
}

const INDEX = "meta/cinematictests.json";
const key = (id: string) => `cinematictest/${id}.json`;
const isId = (id: string) => /^ct[a-f0-9]{16}$/.test(id);

export class TestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function startTest(o: { by: string; image: Uint8Array; contentType: string; prompt: string; model: string; seconds: number; resolution: string; aspect: string }): Promise<TestRun> {
  const model = videoModels().find((m) => m.id === o.model);
  if (!model) throw new TestError("Pick one of the listed models.");
  if (!/^image\/(jpeg|png|webp)$/.test(o.contentType)) throw new TestError("The still must be a JPEG, PNG or WebP image.");
  if (o.image.length > 15 * 1024 * 1024) throw new TestError("The still must be under 15 MB.");
  const prompt = o.prompt.replace(/\s+/g, " ").trim();
  if (prompt.length < 20) throw new TestError("Write the prompt (at least a sentence).");
  const seconds = Math.min(model.maxSeconds, Math.max(model.minSeconds, Math.round(Number(o.seconds) || 8)));
  const resolution = o.resolution === "720p" ? "720p" : "1080p";
  const aspect: CinematicAspect = o.aspect === "16:9" ? "16:9" : "9:16";
  const imageUrl = await uploadMedia(o.image, o.contentType as "image/jpeg");
  // The model's own inputs, with this run's resolution in place of the studio default.
  const input = { ...model.input({ prompt, imageUrl, seconds, aspect }), resolution };
  const usd = await estimateUsd(model.id, input);
  const requestId = await submit(model.id, input, randomUUID());
  const run: TestRun = { id: `ct${randomBytes(8).toString("hex")}`, createdAt: new Date().toISOString(), by: o.by, model: model.id, prompt, seconds, resolution, aspect, requestId, usd, status: "working" };
  await putJSON(key(run.id), run);
  const ids = (await getJSON<{ ids: string[] }>(INDEX).catch(() => null))?.ids ?? [];
  await putJSON(INDEX, { ids: [run.id, ...ids].slice(0, 50) });
  return run;
}

/** A run, moved along: when Higgsfield has finished, the video is copied into Renom's storage. */
async function advance(run: TestRun): Promise<TestRun> {
  if (run.status !== "working") return run;
  let r;
  try {
    r = await requestStatus(run.requestId);
  } catch (e) {
    if (e instanceof HfError && e.retryable) return run;
    run.status = "failed";
    run.error = (e as Error).message;
    await putJSON(key(run.id), run);
    return run;
  }
  if (r.state === "working") return run;
  if (r.state === "failed") {
    run.status = "failed";
    run.error = r.detail;
  } else {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-cinetest-"));
    try {
      const file = path.join(dir, "test.mp4");
      await download(r.url, file);
      const info = await probe(file);
      const up = await saveUpload({ filename: "cinematic-test.mp4", mimeType: "video/mp4", size: (await fs.stat(file)).size, durationSec: info.durationSec }, file);
      Object.assign(run, { status: "ready", videoUrl: `/api/video/files/${up.id}`, durationSec: Math.round(info.durationSec * 10) / 10, width: info.width, height: info.height });
    } catch (e) {
      // Higgsfield keeps the file for seven days: try again on the next look.
      console.warn(`[cinematic] test ${run.id} copy failed:`, (e as Error).message);
      return run;
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
  run.finishedAt = new Date().toISOString();
  await putJSON(key(run.id), run);
  return run;
}

export async function listTests(): Promise<TestRun[]> {
  const ids = ((await getJSON<{ ids: string[] }>(INDEX).catch(() => null))?.ids ?? []).filter(isId).slice(0, 20);
  const runs = (await Promise.all(ids.map((id) => getJSON<TestRun>(key(id)).catch(() => null)))).filter((r): r is TestRun => !!r);
  return Promise.all(runs.map((r) => advance(r).catch(() => r)));
}
