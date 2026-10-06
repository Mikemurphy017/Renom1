import type { PlatformId, Video } from "./types";
import { TODAY } from "./utils";

export const isPublished = (v: Video) => v.status === "published";
export const inPipeline = (v: Video) => v.status !== "published";

export function videoTotals(v: Video) {
  const m = v.metrics ?? [];
  const views = m.reduce((a, x) => a + x.views, 0);
  const watch = views ? m.reduce((a, x) => a + x.watchTimeSec * x.views, 0) / views : 0;
  const eng = views ? m.reduce((a, x) => a + x.engagementRate * x.views, 0) / views : 0;
  return {
    views,
    watchTimeSec: watch,
    engagementRate: eng,
    followers: m.reduce((a, x) => a + x.followers, 0),
    linkClicks: m.reduce((a, x) => a + x.linkClicks, 0),
    inquiries: m.reduce((a, x) => a + x.inquiries, 0),
  };
}

export function platformTotals(videos: Video[]) {
  const map = new Map<PlatformId, { views: number; watchW: number; engW: number; followers: number; linkClicks: number; inquiries: number; posts: number }>();
  for (const v of videos)
    for (const m of v.metrics ?? []) {
      const cur = map.get(m.platform) ?? { views: 0, watchW: 0, engW: 0, followers: 0, linkClicks: 0, inquiries: 0, posts: 0 };
      cur.views += m.views;
      cur.watchW += m.watchTimeSec * m.views;
      cur.engW += m.engagementRate * m.views;
      cur.followers += m.followers;
      cur.linkClicks += m.linkClicks;
      cur.inquiries += m.inquiries;
      cur.posts += 1;
      map.set(m.platform, cur);
    }
  return [...map.entries()].map(([platform, c]) => ({
    platform,
    views: c.views,
    watchTimeSec: c.watchW / c.views,
    engagementRate: c.engW / c.views,
    followers: c.followers,
    linkClicks: c.linkClicks,
    inquiries: c.inquiries,
    posts: c.posts,
  }));
}

export const withinDays = (iso: string | undefined, days: number) =>
  !!iso && TODAY.getTime() - new Date(iso).getTime() <= days * 86400000 && new Date(iso) <= TODAY;
