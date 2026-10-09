"use client";

import * as React from "react";
import type { PlatformId } from "@/lib/types";
import type { SocialPost, SocialStatus } from "./types";

/** Our platform for an Ayrshare network, for its icon (networks we don't post to have none). */
export const PLATFORM_OF: Record<string, PlatformId | undefined> = { youtube: "youtube", instagram: "instagram", tiktok: "tiktok", facebook: "facebook", linkedin: "linkedin", twitter: "x" };
export const NETWORK_LABEL: Record<string, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", linkedin: "LinkedIn", twitter: "X", threads: "Threads", pinterest: "Pinterest", gmb: "Google Business", reddit: "Reddit", bluesky: "Bluesky", telegram: "Telegram" };
/** The networks advisors can post videos to from the studio, in the order we show them. */
export const NETWORKS = ["linkedin", "youtube", "instagram", "facebook", "tiktok", "twitter"];

async function json<T>(res: Response, fallback: string): Promise<T> {
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || fallback);
  return j as T;
}

/** The advisor's connected accounts; re-checked when the tab regains focus (they connect in another page). */
export function useSocialStatus() {
  const [status, setStatus] = React.useState<SocialStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    try {
      const j = await json<SocialStatus>(await fetch("/api/social", { cache: "no-store" }), "Couldn’t load your accounts.");
      setStatus({ configured: j.configured, accounts: j.accounts, unavailable: j.unavailable });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setStatus((s) => s ?? { configured: true, accounts: [], unavailable: [] });
    }
  }, []);
  React.useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  return { status, error, refresh };
}

/** Opens the page where the advisor connects accounts, coming back to `back` afterwards. */
export async function openConnect(back: string) {
  const j = await json<{ url: string }>(await fetch("/api/social/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ back }) }), "Couldn’t open the connect page.");
  window.location.assign(j.url);
}

export async function disconnect(network: string) {
  await json(await fetch(`/api/social?network=${encodeURIComponent(network)}`, { method: "DELETE" }), "Couldn’t disconnect it.");
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
  format: "short" | "long";
  outputId: string;
  covers: Partial<Record<"short" | "long", string>>;
  captions: { platform: PlatformId; text: string; title?: string }[];
  disclosureVersion: string;
  scheduleAt?: string;
}

export async function publishVideo(body: PublishBody) {
  return json<{ posts: SocialPost[]; errors: { platform: PlatformId; error: string }[] }>(
    await fetch("/api/social/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    "Couldn’t post it."
  );
}

export async function cancelScheduled(id: string) {
  return (await json<{ post: SocialPost }>(await fetch(`/api/social/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" }), "Couldn’t cancel it.")).post;
}
