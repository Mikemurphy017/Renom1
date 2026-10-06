import type { AdvisorProfile } from "../types";
import { daysFromToday } from "../utils";

export const ADVISOR: AdvisorProfile = {
  name: "Catherine Hale",
  credentials: "CFP®, CPA",
  firm: "Hale Wealth Partners",
  title: "Founder & Lead Advisor",
  crd: "6612047",
  email: "catherine@halewealth.example",
  city: "Charlotte, NC",
  bio: "Catherine founded Hale Wealth Partners after a decade in corporate tax. She helps tech and finance executives turn concentrated stock and complicated comp into a calm, tax-aware retirement plan. Her clients call her “the CPA who actually explains things.”",
  niche: "Tax-aware planning for executives with equity compensation",
  idealClient: "Senior tech and finance professionals, 45–60, $2M–$10M investable, holding RSUs/ISOs/ESPP, 5–10 years from retirement, who want fewer surprises in April.",
  tone: { formalConversational: 64, cautiousBold: 42 },
  opinions: [
    "Tax planning is a year-round discipline, not an April event.",
    "Concentrated stock is the biggest unmanaged risk in most executive portfolios.",
    "The 4% rule is a starting point, not a plan — spending should flex with markets.",
    "Roth conversions are underused by people in their early 60s.",
    "Most people over-insure their homes and under-insure their income.",
  ],
  sampleWriting:
    "Here's the thing nobody tells you about RSUs: the day they vest, they're just cash that happens to be invested in one company. If you wouldn't take a $200,000 bonus and buy your employer's stock with it, you probably shouldn't keep the shares either. That's not a prediction about the stock. It's a question about risk.",
  brandColors: ["#0B1F3A", "#B08D57", "#F7F5F0", "#2E7D5B"],
  headshots: [
    { id: "h1", label: "Studio — navy blazer", pose: "center" },
    { id: "h2", label: "Office — window light", pose: "left" },
    { id: "h3", label: "Outdoor — Uptown", pose: "right" },
  ],
  disclosures: [
    {
      id: "d3",
      version: "v3.2",
      label: "Standard social video disclosure",
      text: "Catherine Hale is a registered representative and investment adviser representative. Securities and advisory services offered through Meridian Securities, LLC, Member FINRA/SIPC, a registered investment adviser. Hale Wealth Partners is independent of Meridian Securities. This content is for educational purposes only and is not individualized tax, legal, or investment advice. CRD #6612047.",
      updatedAt: daysFromToday(-21),
      updatedBy: "Ruth Lindqvist (CCO)",
      active: true,
    },
    {
      id: "d2",
      version: "v3.1",
      label: "Standard social video disclosure",
      text: "Securities and advisory services offered through Meridian Securities, LLC, Member FINRA/SIPC. Hale Wealth Partners is independent of Meridian Securities. For educational purposes only; not individualized advice.",
      updatedAt: daysFromToday(-96),
      updatedBy: "Ruth Lindqvist (CCO)",
      active: false,
    },
    {
      id: "d1",
      version: "v3.0",
      label: "Standard social video disclosure",
      text: "Securities offered through Meridian Securities, LLC, Member FINRA/SIPC. Educational content only.",
      updatedAt: daysFromToday(-210),
      updatedBy: "Ruth Lindqvist (CCO)",
      active: false,
    },
  ],
};

export const TEAM = [
  { id: "u1", name: "Catherine Hale", email: "catherine@halewealth.example", role: "Advisor" as const, initials: "CH", owner: true },
  { id: "u2", name: "Jordan Ellis", email: "jordan@halewealth.example", role: "Assistant" as const, initials: "JE" },
  { id: "u3", name: "Ruth Lindqvist", email: "compliance@meridiansec.example", role: "Compliance Reviewer" as const, initials: "RL" },
];
