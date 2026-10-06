"use client";

import * as React from "react";

/**
 * Scratch state for studio steps (generated ideas, copy, edits…), keyed by
 * video + step. Saved to the signed-in advisor's account along with the rest
 * of the studio (see store.tsx), so work in progress follows them between devices.
 */
const LEGACY_KEY = "renom.drafts.v1";
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Nothing to do: drafts are loaded by the store when the account loads. */
function ensureLoaded() {}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => listeners.forEach((l) => l()), 400);
}

/** The store saves drafts with the account whenever they change. */
export function onDraftsChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const exportDrafts = () => Object.fromEntries(cache);
export function importDrafts(saved: unknown) {
  cache.clear();
  if (saved && typeof saved === "object") for (const [k, v] of Object.entries(saved as Record<string, unknown>)) cache.set(k, v);
}

/** Drafts saved in this browser before accounts existed (moved into the account once). */
export function legacyDrafts(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Forget every draft (used by "Start over" and sign-out). */
export function clearDrafts() {
  cache.clear();
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export function useDraft<T>(videoId: string, key: string, initial: T | (() => T)) {
  const k = `${videoId}:${key}`;
  const [value, setValue] = React.useState<T>(() => {
    ensureLoaded();
    if (cache.has(k)) return cache.get(k) as T;
    const v = typeof initial === "function" ? (initial as () => T)() : initial;
    cache.set(k, v);
    return v;
  });
  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        cache.set(k, v);
        scheduleSave();
        return v;
      });
    },
    [k]
  );
  return [value, set] as const;
}

/** Pre-fill a draft before the studio opens (e.g. a topic typed on Home). */
export function seedDraft<T>(videoId: string, key: string, value: T) {
  ensureLoaded();
  cache.set(`${videoId}:${key}`, value);
  scheduleSave();
}

/** Read a draft outside React (e.g. to send the advisor's choices with a job). */
export function peekDraft<T>(videoId: string, key: string): T | undefined {
  ensureLoaded();
  return cache.get(`${videoId}:${key}`) as T | undefined;
}
