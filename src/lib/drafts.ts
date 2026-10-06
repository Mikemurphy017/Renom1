"use client";

import * as React from "react";

/**
 * Session-scoped scratch state for studio steps (generated ideas, copy, edits…),
 * keyed by video + step so work survives jumping between steps.
 * Swap for server persistence later.
 */
const cache = new Map<string, unknown>();

export function useDraft<T>(videoId: string, key: string, initial: T | (() => T)) {
  const k = `${videoId}:${key}`;
  const [value, setValue] = React.useState<T>(() => {
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
        return v;
      });
    },
    [k]
  );
  return [value, set] as const;
}

/** Pre-fill a draft before the studio opens (e.g. a topic typed on Home). */
export function seedDraft<T>(videoId: string, key: string, value: T) {
  cache.set(`${videoId}:${key}`, value);
}

/** Read a draft outside React (e.g. to send the advisor's choices with a job). */
export function peekDraft<T>(videoId: string, key: string): T | undefined {
  return cache.get(`${videoId}:${key}`) as T | undefined;
}
