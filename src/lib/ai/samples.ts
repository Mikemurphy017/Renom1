import type { ScriptOutput } from "./schemas";
import type { WriteRequest } from "./write-types";

/** A placeholder script in the house voice, used only when a video reaches Record without one. */

export function sampleScript(req: Extract<WriteRequest, { task: "script" }>): ScriptOutput {
  const title = req.idea.title.replace(/[“”"]/g, "");
  const beats = req.idea.outline;
  if (req.current && req.instruction) {
    return { ...req.current, note: `Sample mode: connect Claude to apply “${req.instruction}”.` };
  }
  if (req.format === "short") {
    return {
      hook: `${title}${/^(why|how|what|should|is|are|do|does|can|when)\b/i.test(title) && !title.endsWith("?") ? "?" : title.endsWith("?") ? "" : "."}\nThe honest answer is one most people don’t want to hear.`,
      body: [
        `Here’s what I see. ${beats[0] ?? "People treat this as a one-time choice"} — and it quietly sets the next five years.`,
        `The reframe: ${(beats[1] ?? "the safe-feeling option carries the real risk").replace(/^./, (c) => c.toLowerCase())}.`,
        `So decide the rule before the moment arrives. ${beats[2] ?? "Write it down"}. Rules don’t feel regret.`,
        "Run this test tonight: write one sentence explaining your plan without mentioning a number you saw once. If you can’t finish it, you have a hope, not a plan.",
      ],
      cta: "If that sentence was hard to write, my door’s open.",
      note: "Sample mode — connect Claude for a script written from your profile.",
    };
  }
  return {
    hook: `${title}. Most people get this wrong for a reason that has nothing to do with intelligence.`,
    body: [
      "Let’s start where you probably are. You’ve heard the standard advice, it made sense, and you followed it.",
      ...beats.map((b, i) => `${["First", "Second", "Third", "Finally"][i] ?? "Next"}: ${b}. Here’s the mechanism behind it, and the trade-off you should know about.`),
      "Illustrative numbers only — your situation will differ, and that difference is the whole point of a plan.",
    ],
    cta: "If you’d like to see how this applies to your numbers, the link below opens my calendar. No pressure either way.",
    note: "Sample mode — connect Claude for a script written from your profile.",
  };
}
