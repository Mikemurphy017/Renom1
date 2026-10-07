"use client";

import * as React from "react";
import type {
  BufferApi,
  BufferIdea,
  BufferMetricsResult,
  BufferPost,
  BufferQueuePosition,
  BufferStatus,
  CreateBufferIdeaRequest,
  CreateBufferPostRequest,
  CreateBufferPostResponse,
  EditBufferPostRequest,
} from "./types";

let cache: BufferStatus | null = null;
let inflight: Promise<BufferStatus> | null = null;
const listeners = new Set<(s: BufferStatus) => void>();

async function load(force = false): Promise<BufferStatus> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = fetch("/api/buffer/status", { cache: "no-store" })
    .then((r) => r.json() as Promise<BufferStatus>)
    .catch((e): BufferStatus => ({ configured: true, error: (e as Error).message }))
    .then((s) => {
      cache = s;
      inflight = null;
      listeners.forEach((l) => l(s));
      return s;
    });
  return inflight;
}

/** Buffer connection status, channels and upcoming posts (shared across components). */
export function useBuffer() {
  const [status, setStatus] = React.useState<BufferStatus | null>(cache);
  React.useEffect(() => {
    listeners.add(setStatus);
    load().then(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  const refresh = React.useCallback(() => load(true), []);
  const connected = !!status && status.configured && !("error" in status);
  return { status, connected, loading: !status, refresh };
}

export async function createBufferPost(req: CreateBufferPostRequest): Promise<CreateBufferPostResponse> {
  try {
    const res = await fetch("/api/buffer/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
    return (await res.json()) as CreateBufferPostResponse;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<BufferApi<T>> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
    return (await res.json()) as BufferApi<T>;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Reschedule a post to a set time and refresh the shared status (Coming up, Settings). */
export async function rescheduleBufferPost(id: string, dueAt: Date) {
  const body: EditBufferPostRequest = { dueAt: dueAt.toISOString() };
  const r = await call<{ post: BufferPost }>(`/api/buffer/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (r.ok) load(true);
  return r;
}

export async function moveBufferPost(id: string, position: BufferQueuePosition) {
  const r = await call<{ post: BufferPost }>(`/api/buffer/posts/${id}/queue`, { method: "POST", body: JSON.stringify({ position }) });
  if (r.ok) load(true);
  return r;
}

export async function deleteBufferPost(id: string) {
  const r = await call<{ id: string }>(`/api/buffer/posts/${id}`, { method: "DELETE" });
  if (r.ok) load(true);
  return r;
}

export const createBufferIdea = (req: CreateBufferIdeaRequest) =>
  call<{ idea: BufferIdea }>("/api/buffer/ideas", { method: "POST", body: JSON.stringify(req) });

/** Aggregated Buffer metrics for the last `days` days (only fetched while `enabled`). */
export function useBufferMetrics(days: number, enabled: boolean) {
  const [state, setState] = React.useState<{ days: number; result: BufferApi<BufferMetricsResult> } | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let live = true;
    call<BufferMetricsResult>(`/api/buffer/metrics?days=${days}`).then((result) => live && setState({ days, result }));
    return () => {
      live = false;
    };
  }, [days, enabled]);
  const current = state?.days === days ? state.result : null;
  return { data: current?.ok ? current : null, error: current && !current.ok ? current.error : null, loading: enabled && !current };
}
