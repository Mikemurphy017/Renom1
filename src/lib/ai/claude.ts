import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { HOUSE_VOICE, advisorBlock } from "./voice";
import { getWriter } from "./writers";
import { CaptionsSchema, CoversSchema, IdeasSchema, PostSchema, ScriptSchema } from "./schemas";
import type { WriteRequest, WriteResult } from "./write-types";
import { originalIdeas, repeatsOpening } from "./originality";
import { ANGLES } from "./angles";
import { PLATFORMS } from "../mock/platforms";

/** Server-only. Uses ANTHROPIC_API_KEY (or any credential the SDK resolves). */
const MODEL = "claude-opus-5-5";

export const claudeConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const today = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/** The advisor's past videos and ideas, one per line, without repeats. */
function pastList(existing: Extract<WriteRequest, { task: "ideas" }>["existing"]) {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const x of existing) {
    const title = x.title.trim();
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const tag = [x.subject, x.angle].filter(Boolean).join(" · ");
    lines.push(`- ${title}${tag ? ` [${tag}]` : ""}`);
  }
  return lines.join("\n") || "- (none)";
}

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
Each idea is one subject seen through one angle. The angles:
${ANGLES.map((a) => `- ${a.label}: ${a.brief}`).join("\n")}
Give each of the 3 ideas a different angle${req.topic ? "" : " and, unless asked otherwise, a different subject"}.
The advisor already has, or was already offered, these (title [subject · angle]):
${pastList(req.existing)}
A subject that's already covered can come back, but only through an angle it hasn't had yet, as a genuinely different video: new question, new points. Never the same subject through the same angle again, and never a listed video reworded. Prefer angles this advisor has used least.
Each title should work as a hook on its own.${revise(undefined, req.instruction)}`;

    case "script":
      return `Write a ${req.format === "short" ? "short-form script: 60 to 90 seconds spoken, about 150 to 210 words, for a vertical video" : "long-form script: 6 to 9 minutes spoken, about 900 to 1,300 words, for a horizontal video"}.
Video: "${req.idea.title}"${req.idea.angle ? `\nAngle: ${req.idea.angle} (${ANGLES.find((a) => a.label === req.idea.angle)?.brief ?? ""}). The script is built around this angle.` : ""}
Points to cover, in whatever order serves the story:
${req.idea.outline.map((o) => `- ${o}`).join("\n")}
${req.otherOpenings?.length ? `\nThe advisor's other videos open like this. This script must be its own: don't reuse these openings, or the stories, examples, numbers and lines they use.\n${req.otherOpenings.map((o) => `- ${o}`).join("\n")}\n` : ""}${req.context ? `\nNotes from the advisor (use them; they're the advisor's own material):\n"""\n${req.context}\n"""` : ""}
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

    case "post": {
      const guide: Record<string, string> = {
        linkedin: "LinkedIn: 120 to 220 words in short paragraphs (one to three sentences each, blank line between). The first line must earn the \"see more\" click on its own. Up to 5 hashtags.",
        facebook: "Facebook: the same idea, warmer and shorter (60 to 120 words). Up to 3 hashtags.",
        instagram: "Instagram: a caption of 40 to 120 words that works under a photo. Strong first line, short lines, a gentle prompt to save or share. Up to 8 hashtags.",
        x: "X: one to three tight sentences, at most 230 characters. At most 2 hashtags.",
      };
      return `Write a social post${req.kind === "image" ? " that will go out with a photo of the advisor" : " (words only, no picture)"} about: "${req.topic}".
Write it natively for each of these platforms:
${req.platforms.map((p) => `- ${guide[p]}`).join("\n")}
It's a post in its own right, not a caption for a video: it gives the reader one useful idea, in the advisor's voice, and ends with a natural next step. Where a link to book a call belongs, use the placeholder {{BOOKING_LINK}}. Don't add disclosures — the app appends them.${req.others?.length ? `\nThe advisor's recent posts open like this; this one must open differently and make its own point:\n${req.others.map((o) => `- ${o}`).join("\n")}` : ""}
Also describe the photo that would carry it (imageScene): the advisor in a real, professional moment that fits the post (presenting to clients in a boardroom, at a kitchen table with a couple, on a call at their desk, walking through the city), so it can be generated from their headshots. No readable words or numbers in the picture.${revise(req.current, req.instruction)}`;
    }

    case "covers":
      return `Write the words for this video's thumbnails, creator-style (think the best finance YouTubers, not a company intranet). The advisor's face sits beside the words, huge and expressive, so the words carry the curiosity and the face carries the emotion.
Video: "${req.video.title}" (made as ${req.video.format === "short" ? "short-form vertical" : "long-form horizontal"}; write both shapes anyway)
${req.video.script ? `Hook: ${req.video.script.hook}\nBody:\n${req.video.script.body.join("\n")}` : `Outline:\n${req.video.outline.map((o) => `- ${o}`).join("\n")}`}

Rules for thumbnail words:
- Never repeat the title. Add what the title leaves out: the stake, the number, the enemy, the open loop.
- Two to four words is the target, five at most. Punchy and spoken, like a reaction: "I WAS WRONG", "DON'T DO THIS", "$7K MISTAKE", "TOO LATE?". Concrete nouns, numbers and verbs beat adjectives. Readable at phone size in one glance.
- No corporate phrasing ("strategies", "considerations", "overview", "insights", "planning tips"): that reads like a training video.
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

const SCHEMAS = { ideas: IdeasSchema, script: ScriptSchema, captions: CaptionsSchema, covers: CoversSchema, post: PostSchema } as const;

/** Ideas that repeat nothing the advisor has or was offered: repeats are dropped and Claude is asked again (twice at most). */
async function writeIdeas(req: Extract<WriteRequest, { task: "ideas" }>) {
  const want = 3;
  const kept: WriteResult<"ideas">["ideas"] = [];
  let avoid = [...req.existing];
  for (let round = 0; round < 3 && kept.length < want; round++) {
    const ask = round === 0 ? req : { ...req, existing: avoid, instruction: [req.instruction, `Give ${want - kept.length} more. Each must be a new subject, or a listed subject through an angle it hasn't had yet.`].filter(Boolean).join(" ") };
    const out = await writeOnce(ask);
    const { kept: fresh, dropped } = originalIdeas(out.ideas, [...req.existing, ...kept], req.topic);
    kept.push(...fresh.slice(0, want - kept.length));
    if (dropped.length) console.info(`[write] dropped ${dropped.length} repeated idea(s): ${dropped.map((d) => d.title).join(" | ")}`);
    avoid = [...avoid, ...out.ideas];
  }
  if (!kept.length) throw new Error("Every idea Claude found is one you already have. Try a different topic or angle.");
  return { ideas: kept };
}

/** A script that doesn't open like the advisor's other scripts: asked again once if it does. */
async function writeScript(req: Extract<WriteRequest, { task: "script" }>) {
  const out = await writeOnce(req);
  if (!req.otherOpenings?.length || !repeatsOpening(out.hook, req.otherOpenings)) return out;
  console.info("[write] script opening repeated another video's; writing it again");
  return writeOnce({ ...req, instruction: [req.instruction, `The opening "${out.hook}" is too close to one of the other videos. Open differently, with a different story or example.`].filter(Boolean).join(" ") });
}

export async function writeWithClaude(req: WriteRequest) {
  if (req.task === "ideas") return writeIdeas(req);
  if (req.task === "script" && !req.current) return writeScript(req);
  return writeOnce(req);
}

async function writeOnce<T extends WriteRequest["task"]>(ask: Extract<WriteRequest, { task: T }>): Promise<WriteResult<T>> {
  const req = ask as WriteRequest;
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
  return response.parsed_output as WriteResult<T>;
}
