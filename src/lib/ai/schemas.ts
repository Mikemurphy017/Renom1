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
  hook: z.string().describe("The opening line(s) — the first 3 seconds"),
  body: z.array(z.string()).describe("The body as short spoken paragraphs"),
  cta: z.string().describe("The closing invitation"),
  note: z.string().describe("One short sentence to the advisor about the choices you made"),
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
  note: z.string().describe("One short sentence to the advisor"),
});

export type IdeasOutput = z.infer<typeof IdeasSchema>;
export type ScriptOutput = z.infer<typeof ScriptSchema>;
export type CaptionsOutput = z.infer<typeof CaptionsSchema>;
