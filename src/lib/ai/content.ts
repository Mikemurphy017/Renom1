import type { Category, Platform, PlatformId, Script, ThumbnailSpec, Video, VideoFormat } from "../types";
import { sampleScript } from "./samples";

const STOP = new Set("the a an and or of for to in on your you is it what why how i my with vs before after this that are do does should can".split(" "));
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
      .map((w) => (w.length > 3 ? w.replace(/s$/, "") : w))
  );

/** Naive keyword-overlap duplicate check against existing board titles. */
export function findDuplicate(title: string, videos: Video[]): Video | undefined {
  const a = tokens(title);
  let best: { v: Video; score: number } | undefined;
  for (const v of videos) {
    const b = tokens(v.title + " " + v.outline.join(" "));
    const inter = [...a].filter((w) => b.has(w)).length;
    const score = inter / Math.max(1, a.size);
    if (score >= 0.4 && (!best || score > best.score)) best = { v, score };
  }
  return best?.v;
}

export function generateThumbnails(title: string, count: number, platform: string): (ThumbnailSpec & { id: string; size: string })[] {
  const styles = ["navy", "ivory", "brass", "slate"] as const;
  const poses = ["point", "crossed", "think", "center", "left", "right"] as const;
  const vertical = /shorts|instagram|tiktok|reels/i.test(platform);
  const trim = (ws: string[]) => {
    while (ws.length > 1 && /^(a|an|the|and|or|of|for|to|in|on|your|my|is|i)$/i.test(ws[ws.length - 1])) ws.pop();
    return ws.join(" ");
  };
  const clean = title.replace(/[?.!]/g, "").replace(/\s+—\s+/g, ": ");
  const [before, after] = clean.split(/:\s*/);
  const words = clean.replace(/:/g, "").split(/\s+/).filter(Boolean);
  const headlines = [
    trim(before.split(/\s+/).slice(0, 4)),
    after ? trim(after.split(/\s+/).slice(0, 4)) : trim(words.slice(-4)),
    trim(words.slice(0, 3)) + "?",
    trim(words.filter((w) => w.length > 3).slice(0, 3)),
  ];
  return Array.from({ length: count }, (_, i) => {
    const h = headlines[i % headlines.length] || title;
    const hw = h.split(" ");
    return {
      id: `th-${Date.now()}-${i}`,
      style: styles[i % styles.length],
      pose: poses[(i * 2 + 1) % poses.length],
      headline: h,
      accent: hw[hw.length - 1],
      size: vertical ? "768×1376" : "1376×768",
    };
  });
}

/** Fallback script in the house voice when a video has none yet (prompter, transcript, review). */
export function generateScript(title: string, format: VideoFormat): Script {
  const { hook, body, cta } = sampleScript({ task: "script", profile: {} as never, format, idea: { title, outline: [] } });
  return { hook, body, cta };
}

export const estimateRuntime = (s: Script) => {
  const words = [s.hook, ...s.body, s.cta].join(" ").split(/\s+/).length;
  return Math.round((words / 150) * 60); // ~150 wpm
};

export interface PlatformCopy {
  platform: PlatformId;
  title?: string;
  description: string;
  hashtags: string[];
  cta: string;
}

const TAGS: Record<Category, string[]> = {
  "Tax Planning": ["TaxPlanning", "RothIRA", "FinancialPlanning", "TaxTips"],
  Retirement: ["RetirementPlanning", "Retirement", "FinancialPlanner", "Medicare"],
  "Equity Comp": ["EquityCompensation", "RSU", "TechCareers", "StockOptions"],
  "Estate Planning": ["EstatePlanning", "WealthTransfer", "FinancialPlanning"],
  "Market Commentary": ["Markets", "Investing", "FederalReserve", "Economy"],
  "Charitable Giving": ["CharitableGiving", "DonorAdvisedFund", "TaxPlanning"],
  "Wealth Strategy": ["WealthManagement", "Investing", "FinancialPlanning"],
};

export function generateDescriptions(video: Pick<Video, "title" | "category" | "outline">, platforms: Platform[]): PlatformCopy[] {
  const tags = TAGS[video.category];
  return platforms.map((p) => {
    const bullets = video.outline.map((o) => `• ${o}`).join("\n");
    const base = {
      platform: p.id,
      hashtags: tags.slice(0, Math.min(p.hashtagLimit ?? 4, p.id === "x" ? 2 : 4)),
      cta: "{{BOOKING_LINK}}",
    };
    switch (p.id) {
      case "youtube":
        return { ...base, title: video.title, description: `${video.title} — explained.\n\nIn this video:\n${bullets}\n\nChapters\n0:00 Why this matters\n1:10 The core idea\n4:30 A real-world example\n7:45 Mistakes to avoid` };
      case "youtube_shorts":
        return { ...base, title: `${video.title} #shorts`, description: `${video.title} — in under a minute.\n\n${bullets}` };
      case "instagram":
        return { ...base, description: `${video.title} 👇\n\n${bullets}\n\nSave this for later and share it with someone who needs it.` };
      case "tiktok":
        return { ...base, description: `${video.title} 👇 ${video.outline.join(" · ")}` };
      case "facebook":
        return { ...base, title: video.title, description: `${video.title}\n\nA quick explainer for families planning ahead:\n${bullets}` };
      case "linkedin":
        return { ...base, title: video.title, description: `I get asked about this almost every week.\n\n${video.title} — the short version:\n${bullets}\n\nCurious how others are approaching it? Let me know in the comments.` };
      case "x":
        return { ...base, description: `${video.title}: ${video.outline[0].toLowerCase()}.` };
    }
  });
}
