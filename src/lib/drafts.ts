"use client";

import * as React from "react";

/**
 * Scratch state for studio steps (generated ideas, copy, edits…), keyed by
 * video + step, saved in this browser. Swap for server persistence later.
 */
const KEY = "renom.drafts.v1";
const cache = new Map<string, unknown>();
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Drafts are kept in this browser so work in progress survives a refresh. */
function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) if (!cache.has(k)) cache.set(k, v);
  } catch {
    /* unreadable: start fresh */
  }
}

function scheduleSave() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch {
      /* storage full or blocked: keep drafts in memory */
    }
  }, 300);
}

/** Forget every draft (used by "Start over"). */
export function clearDrafts() {
  cache.clear();
  try {
    localStorage.removeItem(KEY);
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
