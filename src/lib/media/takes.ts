"use client";

/** Recorded takes kept in memory for this browser session, keyed by video id. */
export interface Take {
  blob: Blob;
  url: string;
  mimeType: string;
  durationSec: number;
  width: number;
  height: number;
  recordedAt: string;
}

const takes = new Map<string, Take>();
const listeners = new Set<() => void>();

export function saveTake(videoId: string, take: Omit<Take, "url">) {
  const prev = takes.get(videoId);
  if (prev) URL.revokeObjectURL(prev.url);
  takes.set(videoId, { ...take, url: URL.createObjectURL(take.blob) });
  listeners.forEach((l) => l());
}

export function getTake(videoId: string) {
  return takes.get(videoId);
}

export function subscribeTakes(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function takeExtension(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}
