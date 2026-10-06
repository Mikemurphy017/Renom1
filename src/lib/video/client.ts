"use client";

import * as React from "react";
import type { Take } from "@/lib/media/takes";
import type { StoredTake } from "@/lib/types";
import { ACCEPTED_VIDEO_TYPES, MAX_UPLOAD_MB, type JobEvent, type JobKind, type JobResult, type ProcessorId, type ProcessRequest, type UploadResponse } from "./types";

/**
 * Browser side of video processing: upload a take, start a job, follow its
 * progress. State lives at module level (keyed by video + job kind) so a job
 * keeps going when the advisor moves from Record to Edit.
 */
export interface PipelineState {
  kind: JobKind;
  phase: "uploading" | "processing" | "done" | "error";
  /** 0 to 1 across upload + processing */
  progress: number;
  status: string;
  processor?: ProcessorId;
  sourceId?: string;
  jobId?: string;
  result?: JobResult;
  error?: string;
}

const states = new Map<string, PipelineState>();
const listeners = new Set<() => void>();
const keyOf = (videoId: string, kind: JobKind) => `${videoId}:${kind}`;

function set(key: string, next: PipelineState) {
  states.set(key, next);
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A new take makes any earlier reading or render of the old one stale. */
export function resetPipeline(videoId: string) {
  states.delete(keyOf(videoId, "analyze"));
  states.delete(keyOf(videoId, "render"));
  listeners.forEach((l) => l());
}

export function getPipeline(videoId: string, kind: JobKind) {
  return states.get(keyOf(videoId, kind));
}

export function usePipeline(videoId: string, kind: JobKind) {
  return React.useSyncExternalStore(subscribe, () => getPipeline(videoId, kind), () => undefined);
}

/** Multipart upload with progress (fetch can't report upload progress). */
function sendTake(videoId: string, take: Take, onProgress: (p: number) => void) {
  return new Promise<UploadResponse>((resolve, reject) => {
    const type = take.mimeType.split(";")[0];
    if (!ACCEPTED_VIDEO_TYPES.includes(type)) return reject(new Error(`This browser recorded ${type}, which the editor can't take.`));
    if (take.blob.size > MAX_UPLOAD_MB * 1024 * 1024) return reject(new Error(`Takes can be up to ${MAX_UPLOAD_MB} MB.`));
    const form = new FormData();
    form.append("file", new File([take.blob], `take.${type.includes("mp4") ? "mp4" : "webm"}`, { type }));
    form.append("durationSec", String(Math.max(0.5, take.durationSec)));
    form.append("videoId", videoId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/video/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const body = xhr.response as (UploadResponse & { error?: string }) | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.ok) resolve(body);
      else reject(new Error(body?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(form);
  });
}

/** One upload per recorded take, shared by "save it" and "edit it". */
const uploads = new WeakMap<Blob, Promise<UploadResponse>>();
function uploadTake(videoId: string, take: Take, onProgress: (p: number) => void = () => {}) {
  let p = uploads.get(take.blob);
  if (!p) {
    p = sendTake(videoId, take, onProgress);
    uploads.set(take.blob, p);
    p.catch(() => uploads.delete(take.blob));
  }
  return p;
}

/** Save a fresh take to platform storage so it outlives this tab. */
export async function persistTake(videoId: string, take: Take): Promise<StoredTake> {
  const up = await uploadTake(videoId, take);
  return {
    sourceId: up.sourceId,
    url: `/api/video/files/${up.sourceId}`,
    mimeType: take.mimeType.split(";")[0],
    durationSec: take.durationSec,
    width: take.width,
    height: take.height,
    recordedAt: take.recordedAt,
  };
}

/** After a reload: put a finished analysis back so Edit shows the real transcript. */
export async function restoreAnalysis(videoId: string, jobId: string, sourceId: string): Promise<boolean> {
  const key = keyOf(videoId, "analyze");
  if (states.get(key)) return true;
  try {
    const res = await fetch(`/api/video/jobs/${jobId}/result`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return false;
    if (!states.get(key)) set(key, { kind: "analyze", phase: "done", progress: 1, status: "Done", sourceId, jobId, result: body.result as JobResult });
    return true;
  } catch {
    return false;
  }
}

async function startJob(req: ProcessRequest) {
  const res = await fetch("/api/video/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || `Couldn't start processing (${res.status})`);
  return body as { jobId: string; processor: ProcessorId };
}

/** Follow the NDJSON progress stream until the result arrives. */
async function followJob(jobId: string, onStatus: (progress: number, stage: string) => void): Promise<JobResult> {
  const res = await fetch(`/api/video/jobs/${jobId}/stream`, { cache: "no-store" });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Couldn't follow the job (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as JobEvent;
      if (ev.type === "status") onStatus(ev.status.progress, ev.status.stage);
      else if (ev.type === "error") throw new Error(ev.message);
      else if (ev.type === "result") return ev.data;
    }
  }
  throw new Error("Processing stopped without a result.");
}

type JobOptions = Omit<ProcessRequest, "kind" | "sourceId">;

/** Record → Edit: upload the take, then transcribe it and suggest cuts. */
export async function analyzeTake(videoId: string, take: Take | StoredTake, opts: JobOptions): Promise<JobResult> {
  const key = keyOf(videoId, "analyze");
  // Uploading is the first 30% of the bar, processing the rest.
  const base: PipelineState = { kind: "analyze", phase: "uploading", progress: 0, status: "Uploading your take…" };
  set(key, base);
  states.delete(keyOf(videoId, "render"));
  try {
    const up = "sourceId" in take ? { sourceId: take.sourceId, processor: undefined } : await uploadTake(videoId, take, (p) => set(key, { ...base, progress: p * 0.3 }));
    const running: PipelineState = { ...base, phase: "processing", progress: 0.3, status: "Starting…", processor: up.processor, sourceId: up.sourceId };
    set(key, running);
    const { jobId } = await startJob({ ...opts, kind: "analyze", sourceId: up.sourceId });
    const result = await followJob(jobId, (p, stage) => set(key, { ...running, jobId, progress: 0.3 + p * 0.7, status: stage }));
    set(key, { ...running, jobId, phase: "done", progress: 1, status: "Done", result });
    return result;
  } catch (e) {
    set(key, { ...(states.get(key) ?? base), phase: "error", error: (e as Error).message, status: "Something went wrong" });
    throw e;
  }
}

/** Edit → Post: render the final video with the advisor's cuts and overlays. */
export async function renderFinal(videoId: string, sourceId: string, opts: JobOptions): Promise<JobResult> {
  const key = keyOf(videoId, "render");
  const base: PipelineState = { kind: "render", phase: "processing", progress: 0, status: "Starting…", sourceId };
  set(key, base);
  try {
    const { jobId, processor } = await startJob({ ...opts, kind: "render", sourceId });
    const running = { ...base, jobId, processor };
    const result = await followJob(jobId, (p, stage) => set(key, { ...running, progress: p, status: stage }));
    set(key, { ...running, phase: "done", progress: 1, status: "Done", result });
    return result;
  } catch (e) {
    set(key, { ...(states.get(key) ?? base), phase: "error", error: (e as Error).message, status: "Something went wrong" });
    throw e;
  }
}
