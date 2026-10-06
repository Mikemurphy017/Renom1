import type { CaptionsOutput, IdeasOutput, ScriptOutput } from "./schemas";
import type { WriteRequest } from "./write-types";
import { PLATFORMS } from "../mock/platforms";

/**
 * Hand-written stand-ins in the house voice, used when no Claude key is
 * configured so the product still reads the way it will with Claude.
 */
type Idea = IdeasOutput["ideas"][number];

const EVERGREEN: Idea[] = [
  { title: "“I’ll sell when it gets back to where it was”", angle: "Reframe", category: "Equity Comp", outline: ["The most expensive sentence I hear from executives", "Why the old high feels like money you’re owed", "The rule that removes the decision", "A test you can run tonight"], why: "Every RSU holder has said this sentence — they’ll recognise themselves in the first line." },
  { title: "The quiet window between retirement and RMDs", angle: "Hidden Opportunity", category: "Tax Planning", outline: ["Why the years after work can be your lowest-tax years", "Filling a bracket instead of overflowing it", "The Medicare lookback nobody mentions", "What to check before December"], why: "Pre-retirees sense they’re missing something here; this names it." },
  { title: "Your company stock isn’t an investment. It’s a bet you didn’t place.", angle: "Reframe", category: "Equity Comp", outline: ["Vested shares are just cash in one company", "Would you buy it with a bonus?", "Three ways to diversify without a tax shock"], why: "Puts a frame around a decision most executives have been avoiding." },
  { title: "The 4% rule was never meant to be a plan", angle: "Myth vs. Reality", category: "Retirement", outline: ["Where the number came from", "Why real spending flexes", "Guardrails in plain English"], why: "Everyone has heard of the 4% rule; few know its limits." },
  { title: "Your beneficiary form outranks your will", angle: "Common Mistakes/Pitfalls", category: "Estate Planning", outline: ["What actually passes outside the will", "The ex-spouse problem", "A ten-minute check"], why: "Simple, surprising, and immediately actionable." },
];

const TIMELY: Idea[] = [
  { title: "Before December 31: the three Roth decisions that expire", angle: "Deadline", category: "Tax Planning", outline: ["Why the calendar matters more than the market here", "Bracket ceilings, not guesses", "The Medicare lookback", "What to check this week"], why: "Year-end creates real urgency without hype." },
  { title: "Open enrollment: the plan that was right last year may not be now", angle: "Deadline", category: "Retirement", outline: ["Formularies and networks change every year", "The two-year income lookback", "A 20-minute review"], why: "Retirees are already thinking about it this month." },
  { title: "Earnings season and the one-stock problem", angle: "Reframe", category: "Equity Comp", outline: ["One quarter can move a net worth", "Concentration is a decision, even when you don’t decide", "Rules before headlines"], why: "Ties a news cycle to a planning decision without predicting anything." },
  { title: "Rates moved. Does your cash still have a job?", angle: "News You Can Use", category: "Market Commentary", outline: ["What changes for cash when rates change", "Reserve vs. opportunity money", "The question to ask before locking anything in"], why: "Everyone holding cash is asking this; it stays educational." },
];

let rot = 0;
export function sampleIdeas(req: Extract<WriteRequest, { task: "ideas" }>): IdeasOutput {
  const pool = req.mode === "timely" ? TIMELY : EVERGREEN;
  const start = rot++ % pool.length;
  let ideas = Array.from({ length: 3 }, (_, i) => pool[(start + i) % pool.length]);
  if (req.topic) {
    const t = req.topic.trim().replace(/[.!]+$/, "");
    const title = t.charAt(0).toUpperCase() + t.slice(1);
    ideas = [
      { title, angle: "Reframe", category: ideas[0].category, outline: ["The sentence people say to themselves", "Why it feels prudent — and isn’t", "The rule that removes the decision", "One test to run tonight"], why: "Opens on a sentence the viewer has said themselves." },
      ...ideas.slice(0, 2),
    ];
  }
  return { ideas };
}

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

export function sampleCaptions(req: Extract<WriteRequest, { task: "captions" }>): CaptionsOutput {
  const hook = req.video.script?.hook.split("\n")[0] ?? req.video.title;
  const beats = req.video.outline.slice(0, 3);
  return {
    captions: req.platforms.map((id) => {
      const p = PLATFORMS.find((x) => x.id === id)!;
      const base = { platform: id, title: p.titleLimit ? req.video.title.slice(0, p.titleLimit) : null, hashtags: ["FinancialPlanning", "TaxPlanning", "Retirement"].slice(0, id === "x" ? 1 : 3) };
      switch (id) {
        case "linkedin":
          return { ...base, description: `${hook}\n\nIt sounds prudent. Often it isn’t.\n\n${beats.map((b) => `→ ${b}`).join("\n")}\n\nThe fix isn’t a prediction. It’s a rule you decide before the moment arrives.\n\n...\n\nWorth knowing which one is running your money.` };
        case "x":
          return { ...base, description: `${hook} The fix isn’t a prediction. It’s a rule.` };
        case "youtube":
          return { ...base, description: `${hook}\n\nIn this video:\n${beats.map((b) => `• ${b}`).join("\n")}\n\nWant to see how it applies to you? {{BOOKING_LINK}}` };
        default:
          return { ...base, description: `${hook}\n\n${beats[0] ?? ""} — and what to do instead.\n\nSave this for the next time you’re deciding.` };
      }
    }),
    note: "Sample mode — connect Claude for copy written from your profile.",
  };
}
