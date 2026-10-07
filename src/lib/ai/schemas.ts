import { z } from "zod";

export const CATEGORY_VALUES = ["Tax Planning", "Retirement", "Equity Comp", "Estate Planning", "Market Commentary", "Charitable Giving", "Wealth Strategy"] as const;
export const PLATFORM_VALUES = ["youtube", "youtube_shorts", "instagram", "tiktok", "facebook", "linkedin", "x"] as const;

export const IdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().describe("The video title, written as a hook"),
      angle: z.string().describe('The angle, e.g. "Common Mistakes/Pitfalls", "Reframe", "Myth vs. Reality"'),
      category: z.enum(CATEGORY_VALUES),
      outline: z.array(z.string()).describe("Three or four beats, one line each"),
      why: z.string().describe("One sentence on why this will land with the ideal client"),
    })
  ),
});

export const ScriptSchema = z.object({
  hook: z.string().describe("The opening of the narrative: one to three spoken sentences"),
  body: z.array(z.string()).describe("The body as spoken paragraphs, each two to four connected sentences, in order"),
  cta: z.string().describe("The close: one or two sentences that finish the story and invite, calmly"),
  note: z.string().describe("One short sentence to the advisor about the angle this version takes (no writer names)"),
});

export const CaptionsSchema = z.object({
  captions: z.array(
    z.object({
      platform: z.enum(PLATFORM_VALUES),
      title: z.string().nullable().describe("Title where the platform supports one, else null"),
      description: z.string().describe("The post copy, without hashtags and without any disclosure"),
      hashtags: z.array(z.string()).describe("Hashtags without the # sign"),
    })
  ),
  taglines: z.array(z.string()).describe("Exactly three taglines: one line each, at most 12 words, no hashtags, no emoji"),
  note: z.string().describe("One short sentence to the advisor"),
});

const CoverLine = z.object({
  headline: z.string().describe("2–5 words, at most 26 characters, the text burned onto the image"),
  accent: z.string().describe("The one word from the headline to color for emphasis, copied exactly"),
  kicker: z.string().describe("1–3 word label above the headline, e.g. a topic or a number (\"TAX PLANNING\", \"3 MISTAKES\")"),
  angle: z.string().describe("Two or three words naming the tactic, e.g. \"open loop\", \"specific number\", \"enemy\""),
});

export const CoversSchema = z.object({
  long: z.array(CoverLine).describe("Four lines for a 16:9 YouTube / LinkedIn thumbnail, read at a glance next to a face"),
  short: z.array(CoverLine).describe("Four lines for a 9:16 Reels / TikTok / Shorts cover, read on a grid of covers"),
});

export type IdeasOutput = z.infer<typeof IdeasSchema>;
export type ScriptOutput = z.infer<typeof ScriptSchema>;
export type CaptionsOutput = z.infer<typeof CaptionsSchema>;
export type CoversOutput = z.infer<typeof CoversSchema>;
