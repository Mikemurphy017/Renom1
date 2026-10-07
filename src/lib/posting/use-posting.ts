"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import type { Video } from "@/lib/types";
import type { AdvisorPostRequest, PostRequest } from "./types";

/** The advisor's own posting requests. */
export function usePostRequests(videoId?: string) {
  const [requests, setRequests] = React.useState<AdvisorPostRequest[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/posting${videoId ? `?videoId=${encodeURIComponent(videoId)}` : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setRequests(j.requests);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [videoId]);
  React.useEffect(() => void load(), [load]);
  return { requests, error, refresh: load };
}

export type SubmitInput = Omit<PostRequest, "id" | "userId" | "advisorEmail" | "status" | "submittedAt" | "updatedAt" | "teamNote" | "scheduledFor" | "postedAt" | "buffer">;

export async function submitPostRequest(input: SubmitInput): Promise<AdvisorPostRequest> {
  const res = await fetch("/api/posting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || "Couldn’t send it to the team.");
  return j.request;
}

export async function cancelPostRequest(id: string) {
  const res = await fetch(`/api/posting?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || "Couldn’t withdraw it.");
}

/** What a request means for the video record in the advisor's studio. */
export function videoPatchFor(v: Video, r: AdvisorPostRequest): Partial<Video> | null {
  const teamPost = { id: r.id, status: r.status, at: r.status === "posted" ? r.postedAt : r.scheduledFor, note: r.teamNote };
  const patch: Partial<Video> = {};
  if (JSON.stringify(v.teamPost ?? null) !== JSON.stringify(teamPost)) patch.teamPost = teamPost;
  if (r.status === "scheduled" && (v.status !== "scheduled" || v.scheduledFor !== r.scheduledFor) && v.status !== "published") {
    patch.status = "scheduled";
    patch.scheduledFor = r.scheduledFor;
    patch.platforms = r.platforms;
  }
  if (r.status === "posted" && v.status !== "published") {
    const at = r.postedAt ?? new Date().toISOString();
    patch.status = "published";
    patch.publishedAt = at;
    patch.platforms = r.platforms;
    patch.posts = [
      ...(v.posts ?? []),
      ...r.captions.map((c) => ({ platform: c.platform, channel: "Posted by your team", caption: c.text, disclosureVersion: r.disclosureVersion, at, how: "team" as const })),
    ];
  }
  return Object.keys(patch).length ? patch : null;
}

/** Keeps each video's status in step with what the team has done (on load and when the tab regains focus). */
export function usePostingSync() {
  const { hydrated, account, videos, updateVideo } = useStore();
  const videosRef = React.useRef(videos);
  videosRef.current = videos;
  const updateRef = React.useRef(updateVideo);
  updateRef.current = updateVideo;
  const accountId = account?.id;
  React.useEffect(() => {
    if (!hydrated || !accountId) return;
    let live = true;
    const sync = async () => {
      const res = await fetch("/api/posting", { cache: "no-store" }).catch(() => null);
      const j = res?.ok ? await res.json().catch(() => null) : null;
      if (!live || !j?.ok) return;
      // Latest request per video wins.
      const latest = new Map<string, AdvisorPostRequest>();
      for (const r of j.requests as AdvisorPostRequest[]) {
        const cur = latest.get(r.videoId);
        if (!cur || r.updatedAt > cur.updatedAt) latest.set(r.videoId, r);
      }
      for (const v of videosRef.current) {
        const r = latest.get(v.id);
        const patch = r && videoPatchFor(v, r);
        if (patch) updateRef.current(v.id, patch);
      }
    };
    void sync();
    const onFocus = () => document.visibilityState === "visible" && void sync();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [hydrated, accountId]);
}
