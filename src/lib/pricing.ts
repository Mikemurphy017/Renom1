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
      "Cinematic AI videos of you, from one headshot",
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
export const TRIAL_DAYS = 7;
export const TRIAL_VIDEOS = 3;

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Stripe Payment Links, one per plan and billing (the trial, card requirement
 * and after-payment redirect are set on each link in Stripe). The server can
 * override each with STRIPE_LINK_<PLAN>_<INTERVAL>, e.g. STRIPE_LINK_PRO_YEAR.
 */
export const PAYMENT_LINKS: Record<PlanId, Record<BillingInterval, string>> = {
  starter: {
    month: "https://buy.stripe.com/4gM00k5M83jE4LO3n2bwk2D",
    year: "https://buy.stripe.com/14A6oIb6s07scegaPubwk2E",
  },
  pro: {
    month: "https://buy.stripe.com/5kQfZib6sdYi1zC6zebwk2F",
    year: "https://buy.stripe.com/cNieVe8YkbQaemo6zebwk2G",
  },
};

/** The plan a Stripe price is for, from its amount (cents) and interval: how payment-link subscriptions are recognised. */
export function planForPrice(unitAmount: number | null | undefined, interval: string | null | undefined): { plan: PlanId; interval: BillingInterval } | null {
  if (interval !== "month" && interval !== "year") return null;
  const p = PLANS.find((x) => (interval === "year" ? x.annual : x.monthly) * 100 === unitAmount);
  return p ? { plan: p.id, interval } : null;
}
