import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { HOUSE_VOICE, advisorBlock } from "./voice";
import { CaptionsSchema, CoversSchema, IdeasSchema, ScriptSchema } from "./schemas";
import type { WriteRequest } from "./write-types";
import { PLATFORMS } from "../mock/platforms";

/** Server-only. Uses ANTHROPIC_API_KEY (or any credential the SDK resolves). */
const MODEL = "claude-opus-5-5";

export const claudeConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const today = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function userPrompt(req: WriteRequest): string {
  const revise = (current: unknown, instruction?: string) =>
    current && instruction
      ? `\n\nHere is the current version:\n${JSON.stringify(current, null, 2)}\n\nThe advisor asked: "${instruction}"\nRevise it to do exactly that. Keep everything else that already works.`
      : instruction
        ? `\n\nThe advisor added: "${instruction}"`
        : "";

  switch (req.task) {
    case "ideas":
      return `Today is ${today()}.
Suggest 3 ${req.format === "short" ? "short-form (under 60 seconds, vertical)" : "long-form (6–12 minutes)"} video ideas.
${req.mode === "timely"
  ? "Make them timely: tie each to something happening in the next few weeks — the season, tax and enrollment deadlines, year-end planning, or market themes advisors are being asked about now. Don't invent specific news events, quotes or numbers."
  : "Make them evergreen: questions the ideal client will still be asking a year from now."}
${req.topic ? `The advisor wants to talk about: "${req.topic}". Every idea should serve that topic.` : "Pick the topics most likely to bring the ideal client in the door."}
Avoid repeating these videos the advisor already has:
${req.existingTitles.map((t) => `- ${t}`).join("\n") || "- (none)"}
Each title should work as a hook on its own.${revise(undefined, req.instruction)}`;

    case "script":
      return `Write a ${req.format === "short" ? "short-form script: 45–60 seconds spoken, about 110–150 words total, vertical video" : "long-form script: 6–9 minutes spoken, about 900–1300 words, horizontal video"}.
Video: "${req.idea.title}"
Beats to cover:
${req.idea.outline.map((o) => `- ${o}`).join("\n")}
${req.context ? `\nNotes from the advisor (voice memo or files):\n"""\n${req.context}\n"""` : ""}
The hook must land in the first three seconds. The body is what the advisor will read on a teleprompter, so write for the ear. Close with a calm invitation, not a plea.${revise(req.current, req.instruction)}`;

    case "captions": {
      const specs = req.platforms
        .map((id) => {
          const p = PLATFORMS.find((x) => x.id === id)!;
          return `- ${id}: ${p.label}. ${p.titleLimit ? `Title up to ${p.titleLimit} characters.` : "No separate title (set title to null)."} Description must stay under ${descBudget(id, p.descLimit)} characters (the disclosure is appended after it). ${p.hashtagLimit ? `At most ${Math.min(p.hashtagLimit, 5)} hashtags.` : "At most 3 hashtags."}`;
        })
        .join("\n");
      return `Write the post copy for this video on each platform.
Video: "${req.video.title}" (${req.video.format === "short" ? "short-form vertical" : "long-form horizontal"})
${req.video.script ? `Script hook: ${req.video.script.hook}\nScript body:\n${req.video.script.body.join("\n")}\nClose: ${req.video.script.cta}` : `Outline:\n${req.video.outline.map((o) => `- ${o}`).join("\n")}`}

Platforms:
${specs}

Write natively for each platform: LinkedIn reads like a short post a professional would write; Instagram and TikTok are tighter; YouTube descriptions can carry a few lines of context. Where a link belongs, use the placeholder {{BOOKING_LINK}}. Don't add disclosures — the app appends them.${revise(req.current, req.instruction)}`;
    }

    case "covers":
      return `Write the words for this video's thumbnails. The advisor's face from the video sits beside the words, so the words carry the curiosity and the face carries the trust.
Video: "${req.video.title}" (made as ${req.video.format === "short" ? "short-form vertical" : "long-form horizontal"}; write both shapes anyway)
${req.video.script ? `Hook: ${req.video.script.hook}\nBody:\n${req.video.script.body.join("\n")}` : `Outline:\n${req.video.outline.map((o) => `- ${o}`).join("\n")}`}

Rules for thumbnail words:
- Never repeat the title. Add what the title leaves out: the stake, the number, the enemy, the open loop.
- Two to five words. Concrete nouns and numbers beat adjectives. Readable at phone size in one glance.
- Each of the four options in a shape uses a different tactic (specific number, open loop, named mistake, contrarian claim, plain question).
- Short-form covers read on a grid next to other covers: punchier, more personal ("I'd skip this IRA move").
- No promises of returns, no "guaranteed", "safe", "best", "free money", no superlatives about results, no fear-mongering about markets. Curiosity, not hype.
- The accent is the single word that carries the punch, copied exactly from the headline.${req.instruction ? `\n\nThe advisor asked: "${req.instruction}"` : ""}`;
  }
}

/** Room left for copy once the ~650-character disclosure and firm line are appended (X uses a short link instead). */
function descBudget(id: string, limit: number) {
  return id === "x" ? 200 : Math.min(limit, 3000) - 650;
}

const SCHEMAS = { ideas: IdeasSchema, script: ScriptSchema, captions: CaptionsSchema, covers: CoversSchema } as const;

export async function writeWithClaude(req: WriteRequest) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: req.task === "script" ? "high" : "medium",
      format: betaZodOutputFormat(SCHEMAS[req.task]),
    },
    system: [
      { type: "text", text: HOUSE_VOICE, cache_control: { type: "ephemeral" } },
      { type: "text", text: advisorBlock(req.profile) },
    ],
    messages: [{ role: "user", content: userPrompt(req) }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined this request. Try rephrasing the topic.");
  if (response.stop_reason === "max_tokens") throw new Error("The response was cut off. Try a shorter request.");
  if (!response.parsed_output) throw new Error("Claude's response couldn't be read. Please try again.");
  return response.parsed_output;
}
