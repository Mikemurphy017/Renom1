"use client";

import * as React from "react";
import type { BufferStatus, CreateBufferPostRequest, CreateBufferPostResponse } from "./types";

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

/** Which Buffer channels post as each advisor (per browser for now). */
const MAP_KEY = "renom.buffer.channels";
export function useAdvisorChannels(advisorId: string) {
  const [ids, setIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(MAP_KEY) || "{}");
      setIds(Array.isArray(all[advisorId]) ? all[advisorId] : []);
    } catch {}
  }, [advisorId]);
  const save = React.useCallback(
    (next: string[]) => {
      setIds(next);
      try {
        const all = JSON.parse(localStorage.getItem(MAP_KEY) || "{}");
        all[advisorId] = next;
        localStorage.setItem(MAP_KEY, JSON.stringify(all));
      } catch {}
    },
    [advisorId]
  );
  return [ids, save] as const;
}
