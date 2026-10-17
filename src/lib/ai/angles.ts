/**
 * The ways into a subject. The same subject (Roth conversions, RSUs, an exit)
 * can come back many times, each through an angle it hasn't had yet; the same
 * subject through the same angle never does.
 */

export interface Angle {
  label: string;
  brief: string;
}

export const ANGLES = [
  { label: "Costly mistake", brief: "The specific error people make and what it costs them." },
  { label: "Myth vs. reality", brief: "A belief most people hold, and what's actually true." },
  { label: "Client story", brief: "One anonymised client situation, told as a story with a turn." },
  { label: "Timing and deadlines", brief: "When to act and the date or age that changes everything." },
  { label: "The hidden cost", brief: "The tax, fee or risk people don't see until it's too late." },
  { label: "What I'd do", brief: "The advisor's own first-person take on the move." },
  { label: "This vs. that", brief: "Two options side by side, and how to choose." },
  { label: "The questions to ask", brief: "What to ask yourself, your employer, your CPA or your advisor." },
  { label: "Life event", brief: "The moment it matters: a vest, a liquidity event, retirement, a sale, a death, a move." },
  { label: "By the numbers", brief: "One worked example with real-feeling figures that makes it concrete." },
  { label: "Contrarian take", brief: "Push back on the usual advice, carefully and credibly." },
  { label: "Step by step", brief: "A short, ordered plan the viewer can follow." },
  { label: "Who it's for (and not)", brief: "Who should consider it, and who should leave it alone." },
  { label: "What changed", brief: "A rule, threshold or market condition that's different now, and what to do about it." },
] as const satisfies readonly Angle[];

export const ANGLE_LABELS = ANGLES.map((a) => a.label) as [string, ...string[]];

/** Subjects advisors come back to again and again; offered as one-tap topics. */
export const SUBJECTS = ["Tax exposure", "Roth conversions", "RSUs", "Stock options", "Business exit planning", "Retirement income", "Estate planning", "Charitable giving"];

export const sameAngle = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
