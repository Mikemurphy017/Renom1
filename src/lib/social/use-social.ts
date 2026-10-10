"use client";

import * as React from "react";
import type { PlatformId } from "@/lib/types";
import type { SocialPost, SocialStatus } from "./types";

/** Our platform for a Buffer channel type, for its icon (channel types we don't post videos to have none). */
export const PLATFORM_OF: Record<string, PlatformId | undefined> = { youtube: "youtube", instagram: "instagram", tiktok: "tiktok", facebook: "facebook", linkedin: "linkedin", twitter: "x" };
export const SERVICE_LABEL: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", linkedin: "LinkedIn", twitter: "X", threads: "Threads", pinterest: "Pinterest", googlebusiness: "Google Business", bluesky: "Bluesky", mastodon: "Mastodon" };
/** Where advisors add or reconnect channels: in Buffer itself. */
export const BUFFER_CHANNELS_URL = "https://publish.buffer.com/channels";

async function json<T>(res: Response, fallback: string): Promise<T> {
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || fallback);
  return j as T;
}

/** The advisor's own Buffer and its channels; re-checked when the tab regains focus (they add channels in Buffer). */
export function useSocialStatus() {
  const [status, setStatus] = React.useState<SocialStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async (fresh = false) => {
    try {
      const j = await json<SocialStatus>(await fetch(`/api/social${fresh ? "?fresh" : ""}`, { cache: "no-store" }), "Couldn’t load your channels.");
      setStatus({ available: j.available, connected: j.connected, email: j.email, organization: j.organization, channels: j.channels, error: j.error });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setStatus((s) => s ?? { available: true, connected: false, channels: [] });
    }
  }, []);
  React.useEffect(() => {
    void refresh();
    const onFocus = () => void refresh(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  return { status, error, refresh };
}

/** Sends the advisor to Buffer to approve Renom, coming back to `back` afterwards. */
export function connectBuffer(back: string) {
  window.location.assign(`/api/social/connect?back=${encodeURIComponent(back)}`);
}

export async function disconnectBuffer() {
  await json(await fetch("/api/social", { method: "DELETE" }), "Couldn’t disconnect Buffer.");
}

export function useSocialPosts(videoId: string) {
  const [posts, setPosts] = React.useState<SocialPost[] | null>(null);
  const refresh = React.useCallback(async () => {
    try {
      const j = await json<{ posts: SocialPost[] }>(await fetch(`/api/social/posts?videoId=${encodeURIComponent(videoId)}`, { cache: "no-store" }), "");
      setPosts(j.posts);
    } catch {
      setPosts((p) => p ?? []);
    }
  }, [videoId]);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);
  // While something is still going out, look again every few seconds.
  const inFlight = posts?.some((p) => p.status === "posting");
  React.useEffect(() => {
    if (!inFlight) return;
    const t = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(t);
  }, [inFlight, refresh]);
  return { posts, refresh, setPosts };
}

export interface PublishBody {
  videoId: string;
  title: string;
  outputId: string;
  posts: { channelId: string; platform: PlatformId; text: string; title?: string }[];
  disclosureVersion: string;
  scheduleAt?: string;
}

export async function publishVideo(body: PublishBody) {
  return json<{ posts: SocialPost[]; errors: { platform: PlatformId; channel: string; error: string }[] }>(
    await fetch("/api/social/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    "Couldn’t post it."
  );
}

export async function cancelScheduled(id: string) {
  return (await json<{ post: SocialPost }>(await fetch(`/api/social/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" }), "Couldn’t cancel it.")).post;
}
