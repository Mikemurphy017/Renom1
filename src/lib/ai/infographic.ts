import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claudeConfigured } from "./claude";
import { InfographicSetSchema, tidyInfographic, type Infographic } from "@/lib/posts/infographic-spec";

/** Server-only. Reads a post and plans three infographics for it. */
const MODEL = "claude-opus-5-5";

const SYSTEM = `You design bold, colourful social infographics for financial advisors' posts: one clear idea per graphic, shown with a big number, a chart or a simple diagram, so it stops the scroll and is understood in two seconds.

Accuracy and compliance come first:
- Use figures that appear in the post. Never invent statistics, survey results, studies or sources.
- If the post has no figures, you may build a simple worked example with round numbers (e.g. $100,000 growing at 6% a year, or a tax bracket comparison) and set hypothetical to true. Never present an example as fact.
- No promises or projections of returns, no "guaranteed", no hype, no product names.
- Keep every text short; it's read on a phone.`;

export async function planInfographics(post: { text: string; topic: string }): Promise<Infographic[]> {
  if (!claudeConfigured()) throw new Error("Infographics aren’t switched on for this studio yet.");
  const client = new Anthropic();
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(InfographicSetSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Topic: ${post.topic}\n\nThe post:\n"""\n${post.text.slice(0, 6000)}\n"""\n\nPlan three infographics for this post, each with a different layout. Pick the layouts that fit what the post actually says: a figure it states (stat), figures to compare (bars), a split of a whole (donut), two choices (compare), change over time (line), or actions to take (steps). At least one should be a chart (bars, donut or line) when the post's ideas allow it.`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("That post couldn’t be turned into an infographic. Try rewording it.");
  const options = (res.parsed_output?.options ?? []).map(tidyInfographic).filter((x): x is Infographic => !!x);
  if (!options.length) throw new Error("No infographic came back. Try again.");
  return options.slice(0, 3);
}
