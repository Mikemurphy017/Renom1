/**
 * Renom's plans and prices: one source for the pricing page, the ROI
 * calculator, checkout and billing. Annual billing is two months free
 * (10× the monthly price).
 */

export type PlanId = "starter" | "pro";
export type BillingInterval = "month" | "year";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Dollars per month, billed monthly. */
  monthly: number;
  /** Dollars per year, billed annually (two months free). */
  annual: number;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For advisors getting consistent on video.",
    monthly: 297,
    annual: 2970,
    features: [
      "Ideas and scripts in your voice",
      "Teleprompter recording or upload your own",
      "AI edit: cuts, captions, studio sound",
      "Covers and AI photo set",
      "Post copy for every platform, disclosure added",
      "Post to your own channels with Buffer",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For advisors who want video to bring in clients.",
    monthly: 497,
    annual: 4970,
    highlight: true,
    features: [
      "Everything in Starter",
      "Motion graphics and b-roll",
      "Text and image posts with AI photos",
      "Compliance approval workflow",
      "4K exports",
      "Priority support",
    ],
  },
];

export const getPlan = (id: string | null | undefined) => PLANS.find((p) => p.id === id);

/** Effective monthly price on annual billing, rounded to the dollar ($248, $414). */
export const effectiveMonthly = (p: Plan) => Math.round(p.annual / 12);
/** What annual billing saves over a year of monthly ($594, $994). */
export const annualSavings = (p: Plan) => p.monthly * 12 - p.annual;
/** Dollars per month for the chosen billing. */
export const monthlyCost = (p: Plan, interval: BillingInterval) => (interval === "year" ? p.annual / 12 : p.monthly);

/** The free trial: a card up front, a few days, and a few finished videos. */
export const TRIAL_DAYS = 14;
export const TRIAL_VIDEOS = 3;

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
