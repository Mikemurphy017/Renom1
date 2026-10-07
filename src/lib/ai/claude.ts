import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { HOUSE_VOICE, advisorBlock } from "./voice";
import { getWriter } from "./writers";
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
      return `Write a ${req.format === "short" ? "short-form script: 60 to 90 seconds spoken, about 150 to 210 words, for a vertical video" : "long-form script: 6 to 9 minutes spoken, about 900 to 1,300 words, for a horizontal video"}.
Video: "${req.idea.title}"
Points to cover, in whatever order serves the story:
${req.idea.outline.map((o) => `- ${o}`).join("\n")}
${req.context ? `\nNotes from the advisor (use them; they're the advisor's own material):\n"""\n${req.context}\n"""` : ""}
Write it as one connected narrative the advisor will read on a teleprompter:
- A through-line from the first sentence to the last. Each paragraph picks up where the last one left off. Someone hearing it once should be able to retell it.
- The hook is the natural opening of that narrative (one to three sentences), not a slogan.
- The body is ${req.format === "short" ? "four to six" : "eight to fourteen"} short spoken paragraphs, each two to four full sentences, that develop the single idea step by step.
- The close follows from the story and ends on a calm invitation.
- Write for the ear: sentences that are easy to say in one breath, no lists, no headings, no stage directions.${revise(req.current, req.instruction)}`;

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

Write natively for each platform:
- LinkedIn: a real post, not a caption. 120 to 220 words in short paragraphs (one to three sentences each, blank line between). The first line must earn the "see more" click on its own. It stands alone for someone who never watches the video, then points to the video.
- Facebook: the same idea, warmer and shorter (60 to 120 words).
- Instagram: a caption of 40 to 100 words. Strong first line, short lines, a gentle prompt to watch or save.
- TikTok: one to three short sentences.
- YouTube and YouTube Shorts: a description that opens with the hook in one line, then two to four lines of context on what the viewer will learn.
- X: one or two tight sentences.
Where a link belongs, use the placeholder {{BOOKING_LINK}}. Don't add disclosures — the app appends them.

Also write three taglines for the video: standalone one-liners (at most 12 words) the advisor can use as a post's opening line, a pinned comment, on-screen text or a headline. Each takes a different angle, all in your voice.${revise(req.current, req.instruction)}`;
    }

    case "covers":
      return `Write the words for this video's thumbnails. The advisor's face from the video sits beside the words, so the words carry the curiosity and the face carries the trust.
Video: "${req.video.title}" (made as ${req.video.format === "short" ? "short-form vertical" : "long-form horizontal"}; write both shapes anyway)
${req.video.script ? `Hook: ${req.video.script.hook}\nBody:\n${req.video.script.body.join("\n")}` : `Outline:\n${req.video.outline.map((o) => `- ${o}`).join("\n")}`}

Rules for thumbnail words:
- Never repeat the title. Add what the title leaves out: the stake, the number, the enemy, the open loop.
- Two to five words. Concrete nouns and numbers beat adjectives. Readable at phone size in one glance.
- Write six options per shape, each with a different tactic. In every shape include:
  1. one that starts with a specific figure from the video ("$7,000 IRA mistake", "3 Roth moves", "73: the age that matters");
  2. one plain question ending in "?";
  3. one first-person line that reads like something the advisor would say ("I'd wait on this Roth move");
  and the rest from: open loop, named mistake, contrarian claim, the stake.
- Only use figures that are in the script or that you're certain are accurate; never invent statistics.
- Also give three talking points (at most five words each) that summarize what the video covers, for a checklist-style cover.
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
      // Scripts are written by one writer, in one voice, start to finish.
      ...(req.task === "script" ? [{ type: "text" as const, text: `## Your craft for this script\n${getWriter(req.writer).brief}\n\nNever name this writer or any technique in the script.` }] : []),
      // Post copy too: each version in one writer's voice.
      ...(req.task === "captions" && req.writer ? [{ type: "text" as const, text: `## Your craft for this post copy\n${getWriter(req.writer).postBrief}\n\nNever name this writer or any technique in the copy.` }] : []),
      { type: "text", text: advisorBlock(req.profile) },
    ],
    messages: [{ role: "user", content: userPrompt(req) }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined this request. Try rephrasing the topic.");
  if (response.stop_reason === "max_tokens") throw new Error("The response was cut off. Try a shorter request.");
  if (!response.parsed_output) throw new Error("Claude's response couldn't be read. Please try again.");
  return response.parsed_output;
}
