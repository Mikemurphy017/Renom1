import type { Category, Platform, PlatformId, Script, ThumbnailSpec, Video, VideoFormat } from "../types";
import { ADVISOR } from "../mock/advisor";

export interface GeneratedIdea {
  id: string;
  title: string;
  angle: string; // e.g. "Common Mistakes/Pitfalls"
  category: Category;
  outline: string[];
  source?: string; // for timely ideas
}

const EVERGREEN: Omit<GeneratedIdea, "id">[] = [
  { title: "5 Tax Mistakes Executives Make the Year They Retire", angle: "Common Mistakes/Pitfalls", category: "Tax Planning", outline: ["Retiring in a high-income year without a plan for the bonus", "Missing the window for a final 401(k) mega-backdoor", "Taking deferred comp as a lump sum by default", "Forgetting that RSUs keep vesting after you leave (or don't)"] },
  { title: "Is Your Company Stock Too Big a Bet?", angle: "Self-Assessment", category: "Equity Comp", outline: ["The 10% rule of thumb — and when to break it", "A two-question gut check", "Three ways to diversify without a huge tax bill"] },
  { title: "Roth Conversions in Your 60s: The Quiet Window", angle: "Hidden Opportunity", category: "Tax Planning", outline: ["Why the gap between retirement and RMDs matters", "Filling the bracket, not overflowing it", "How IRMAA changes the math at 63"] },
  { title: "What I'd Do With a $250K Bonus", angle: "Personal Take", category: "Wealth Strategy", outline: ["Pay the tax you'll actually owe first", "Max the boring accounts", "Decide on the fun money before it disappears"] },
  { title: "The Retirement Paycheck Nobody Talks About", angle: "Myth vs. Reality", category: "Retirement", outline: ["Turning a portfolio into predictable income", "The bucket approach in plain English", "What to do when markets drop the year you retire"] },
  { title: "Why Your Estate Plan Is Probably Out of Date", angle: "Common Mistakes/Pitfalls", category: "Estate Planning", outline: ["Beneficiary designations override your will", "Guardians named a decade ago", "The 2026 exemption change"] },
];

const TIMELY: Omit<GeneratedIdea, "id">[] = [
  { title: "The Fed Cut Rates Again — Should You Lock In CD Yields?", angle: "Market Reaction", category: "Market Commentary", outline: ["What moved and what didn't", "Money market vs. CD vs. Treasury ladder", "The one question to ask before locking anything in"], source: "FOMC decision · 2 days ago" },
  { title: "Government Shutdown: What Actually Stops?", angle: "Explainer", category: "Market Commentary", outline: ["Social Security and Medicare keep paying", "Delayed economic data and why markets care", "Nothing to do with your portfolio (probably)"], source: "Trending · Washington budget standoff" },
  { title: "2027 IRS Limits Just Dropped — Update Your Savings", angle: "News You Can Use", category: "Tax Planning", outline: ["New 401(k) and IRA limits", "Catch-up changes for 60–63", "Adjust your payroll deferral before January"], source: "IRS release · this week" },
  { title: "Medicare Open Enrollment Starts Next Week", angle: "Deadline Reminder", category: "Retirement", outline: ["Plans change every year — yours too", "Check formularies and networks", "IRMAA appeals after a retirement"], source: "Calendar · Oct 15" },
  { title: "Big Tech Earnings: A Reminder About Concentration", angle: "Market Reaction", category: "Equity Comp", outline: ["One stock, one bad quarter", "What a 30% drop means for your plan", "Hedging vs. selling"], source: "Earnings season · this week" },
  { title: "Year-End Tax Moves Before December 31", angle: "Deadline Reminder", category: "Tax Planning", outline: ["Harvest losses (watch wash sales)", "Bunch charitable gifts into a DAF", "Finish Roth conversions"], source: "Seasonal · 12 weeks left" },
];

let ideaCounter = 0;
export function generateIdeas(mode: "evergreen" | "timely", count = 3, seedOffset = 0): GeneratedIdea[] {
  const pool = mode === "timely" ? TIMELY : EVERGREEN;
  const out: GeneratedIdea[] = [];
  for (let i = 0; i < count; i++) {
    const base = pool[(i + seedOffset) % pool.length];
    out.push({ ...base, id: `idea-${Date.now()}-${ideaCounter++}` });
  }
  return out;
}

export function regenerateIdea(idea: GeneratedIdea, mode: "evergreen" | "timely"): GeneratedIdea {
  const pool = mode === "timely" ? TIMELY : EVERGREEN;
  const others = pool.filter((p) => p.title !== idea.title);
  const pick = others[(ideaCounter + 3) % others.length];
  return { ...pick, id: `idea-${Date.now()}-${ideaCounter++}` };
}

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

export function generateScript(title: string, format: VideoFormat): Script {
  const topic = title.replace(/[?.!]$/, "");
  if (format === "short") {
    return {
      hook: `Most people get ${topic.toLowerCase()} wrong — and it's usually one decision, not ten.`,
      body: [
        `Here's what I see with clients: they treat ${topic.toLowerCase()} as a one-time event instead of a decision that echoes for years.`,
        "The fix is simple. Write down the number you're solving for, then work backward to the tax bill you're willing to pay this year.",
        "If that sounds like more math than you want to do on a Tuesday night, that's normal. It's exactly what a plan is for.",
      ],
      cta: "If this hit home, send me a message — I'll share the one-page worksheet we use with clients.",
    };
  }
  return {
    hook: `Today we're going to walk through ${topic.toLowerCase()} — the way I'd explain it to a client sitting across my desk.`,
    body: [
      "First, the big picture: what's actually at stake, in dollars, for a typical family in your position.",
      "Second, the three moving parts — taxes, timing, and risk — and how each one changes the answer.",
      "Third, a real-world example. We'll use round numbers so you can follow along without a spreadsheet.",
      "Finally, the mistakes I see most often, and the simple guardrails that prevent them.",
    ],
    cta: "If you'd like us to run these numbers for your own situation, the link to schedule a call is in the description.",
  };
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
        return { ...base, title: video.title, description: `${video.title} — explained by ${ADVISOR.name}, ${ADVISOR.credentials}.\n\nIn this video:\n${bullets}\n\nChapters\n0:00 Why this matters\n1:10 The core idea\n4:30 A real-world example\n7:45 Mistakes to avoid` };
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

export function chatReply(prompt: string, task: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("shorter") || p.includes("tighten"))
    return "Done — I trimmed about 15% by cutting the second example and merging the setup into the hook. The CTA is unchanged so it still matches your approved booking-link language.";
  if (p.includes("bold") || p.includes("punch"))
    return "I made the opening more direct and swapped the hedge words (“might”, “could”) for plain statements where it's still compliance-safe. Anything that reads as a recommendation stays framed as education.";
  if (p.includes("formal"))
    return "I nudged the tone toward formal: fewer contractions, no slang, and a clearer structure. It's still in your voice — closer to how you write client letters.";
  if (task === "thumbnails")
    return "Updated the selected thumbnail — larger headline, the accent word in brass, and a tighter crop on your headshot so your face reads at small sizes.";
  return "Got it. I've applied that change and kept your tone settings and compliance language intact. Want me to generate an alternate version for comparison?";
}
