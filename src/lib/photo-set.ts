"use client";

import * as React from "react";
import { CLONE_LOOKS } from "./ai/clone-looks";
import { useStore } from "./store";
import type { PhotoSetItem } from "./types";

/**
 * The advisor's AI photo set (see /api/covers/clone): their headshots in, a
 * set of new photos out, one per look, two at a time. Progress lives here, not
 * in a component, so Settings and the cover step show the same run.
 */

export const PHOTO_LOOKS = CLONE_LOOKS.map(({ id, label }) => ({ id, label }));

type Run = { pending: string[]; error?: string };
let run: Run = { pending: [] };
const listeners = new Set<() => void>();
const setRun = (r: Run) => {
  run = r;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePhotoSet() {
  const { profile, editPhotoSet } = useStore();
  const state = React.useSyncExternalStore(subscribe, () => run, () => run);
  const headshots = profile.headshots.filter((h) => h.url).slice(0, 4);
  const photos = profile.photoSet ?? [];

  const makeOne = React.useCallback(
    async (look: string): Promise<boolean> => {
      const res = await fetch("/api/covers/clone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ headshots: headshots.map((h) => h.id), look }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw Object.assign(new Error(body.error || `Couldn’t make that photo (${res.status})`), { status: res.status });
      const p = body.photo as Omit<PhotoSetItem, "createdAt">;
      editPhotoSet((set) => [...set.filter((x) => x.look !== p.look), { ...p, createdAt: new Date().toISOString() }]);
      return true;
    },
    [headshots, editPhotoSet]
  );

  /** Make these looks (default: the whole set), two at a time. Stops on a limit or setup error. */
  const make = React.useCallback(
    async (looks: string[] = PHOTO_LOOKS.map((l) => l.id)) => {
      if (run.pending.length || !headshots.length) return;
      const queue = [...looks];
      setRun({ pending: [...looks] });
      let stop: string | undefined;
      const worker = async () => {
        while (queue.length && !stop) {
          const look = queue.shift()!;
          try {
            await makeOne(look);
          } catch (e) {
            const status = (e as { status?: number }).status;
            // Limits and setup problems stop the run; a single refused photo doesn't.
            if (status === 429 || status === 503 || status === 401) stop = (e as Error).message;
            else setRun({ ...run, error: (e as Error).message });
          }
          setRun({ ...run, pending: run.pending.filter((x) => x !== look) });
        }
      };
      await Promise.all([worker(), worker()]);
      setRun({ pending: [], error: stop ?? run.error });
    },
    [headshots.length, makeOne]
  );

  return {
    photos,
    headshots,
    /** Looks still being made. */
    pending: state.pending,
    busy: state.pending.length > 0,
    error: state.error,
    make,
    remove: (id: string) => editPhotoSet((set) => set.filter((p) => p.id !== id)),
    clear: () => editPhotoSet(() => []),
  };
}
