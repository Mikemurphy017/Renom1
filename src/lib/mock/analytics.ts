import { seeded } from "./random";
import { TODAY } from "../utils";

/** Daily views across all platforms for the last 60 days. */
export const DAILY_VIEWS = (() => {
  const r = seeded(7);
  const out: { date: string; views: number }[] = [];
  const spikes: Record<number, number> = { 5: 2.4, 12: 2.9, 18: 2.6, 19: 2.2, 26: 1.9, 33: 1.6, 41: 1.7, 48: 1.5 };
  for (let i = 59; i >= 0; i--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i);
    const trend = 900 + (59 - i) * 14;
    const weekend = [0, 6].includes(d.getDay()) ? 0.82 : 1;
    const spike = spikes[i] ?? 1;
    out.push({ date: d.toISOString().slice(0, 10), views: Math.round(trend * weekend * spike * (0.85 + r() * 0.3)) });
  }
  return out;
})();

export const FOLLOWER_GROWTH = [
  { platform: "youtube", label: "YouTube", followers: 4820, growth: 6.2 },
  { platform: "instagram", label: "Instagram", followers: 3190, growth: 4.8 },
  { platform: "linkedin", label: "LinkedIn", followers: 7410, growth: 3.1 },
  { platform: "facebook", label: "Facebook", followers: 1260, growth: 1.2 },
] as const;
