import { z } from "zod";

/**
 * An infographic for a post: what it shows, as data. Claude reads the post and
 * fills this in; the browser draws it (lib/posts/infographic). Shared by both.
 */

export const INFOGRAPHIC_LAYOUTS = ["stat", "bars", "donut", "compare", "line", "steps"] as const;
export type InfographicLayout = (typeof INFOGRAPHIC_LAYOUTS)[number];

export const InfographicSchema = z.object({
  layout: z.enum(INFOGRAPHIC_LAYOUTS).describe("stat: one big figure. bars: 2–6 figures compared. donut: a whole split into 2–4 parts that add up to 100. compare: two options side by side. line: a figure growing or shrinking over 3–10 points in time. steps: 3–4 numbered actions."),
  kicker: z.string().describe("2–4 words, the topic, e.g. “Retirement math”."),
  headline: z.string().describe("The point of the graphic, 4–10 words."),
  stat: z.object({ value: z.string().describe("Short: “73%”, “$1.2M”, “10 yrs”, “59½”."), label: z.string().describe("What the figure is, 3–12 words.") }).nullable().describe("For stat; null otherwise."),
  series: z
    .array(z.object({ label: z.string().describe("1–4 words."), value: z.number().describe("The number itself, for drawing."), display: z.string().describe("How it's shown: “$420K”, “24%”, “Age 65”.") }))
    .describe("For bars (2–6), donut (2–4, values adding to 100) and line (3–10 points in time order, label = the year or age). Empty otherwise."),
  compare: z
    .object({
      left: z.object({ title: z.string(), value: z.string().describe("A short figure or word, e.g. “Taxed now”, “$0 tax”."), points: z.array(z.string()).describe("1–3 points, 2–6 words each.") }),
      right: z.object({ title: z.string(), value: z.string(), points: z.array(z.string()) }),
    })
    .nullable()
    .describe("For compare; null otherwise."),
  steps: z.array(z.string()).describe("For steps: 3–4 actions, 3–8 words each. Empty otherwise."),
  takeaway: z.string().describe("One line under the chart, 5–14 words: what it means for the reader."),
  hypothetical: z.boolean().describe("True when the figures are an illustration you built (not stated in the post)."),
  source: z.string().describe("Where the figures come from if the post names it, else empty."),
});
export type Infographic = z.infer<typeof InfographicSchema>;

export const InfographicSetSchema = z.object({ options: z.array(InfographicSchema).describe("Three options, each a different layout.") });

export const HYPOTHETICAL_NOTE = "Hypothetical example for illustration only. Not a guarantee of future results.";

/** Keeps a spec drawable: trims text and lists to what the layouts have room for, and drops what a layout can't use. */
export function tidyInfographic(i: Infographic): Infographic | null {
  const t = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const series = (i.series ?? []).filter((s) => Number.isFinite(s.value)).map((s) => ({ label: t(s.label, 28), value: s.value, display: t(s.display || String(s.value), 14) }));
  const out: Infographic = {
    layout: i.layout,
    kicker: t(i.kicker, 32),
    headline: t(i.headline, 90),
    stat: i.stat ? { value: t(i.stat.value, 10), label: t(i.stat.label, 90) } : null,
    series: i.layout === "bars" ? series.slice(0, 6) : i.layout === "donut" ? series.filter((s) => s.value > 0).slice(0, 4) : i.layout === "line" ? series.slice(0, 10) : [],
    compare: i.compare ? { left: { title: t(i.compare.left.title, 22), value: t(i.compare.left.value, 14), points: i.compare.left.points.slice(0, 3).map((p) => t(p, 40)) }, right: { title: t(i.compare.right.title, 22), value: t(i.compare.right.value, 14), points: i.compare.right.points.slice(0, 3).map((p) => t(p, 40)) } } : null,
    steps: i.layout === "steps" ? i.steps.slice(0, 4).map((s) => t(s, 60)).filter(Boolean) : [],
    takeaway: t(i.takeaway, 110),
    hypothetical: !!i.hypothetical,
    source: t(i.source, 80),
  };
  const ok =
    (out.layout === "stat" && !!out.stat?.value) ||
    (out.layout === "bars" && out.series.length >= 2) ||
    (out.layout === "donut" && out.series.length >= 2) ||
    (out.layout === "line" && out.series.length >= 3) ||
    (out.layout === "compare" && !!out.compare) ||
    (out.layout === "steps" && out.steps.length >= 2);
  return ok && out.headline ? out : null;
}
