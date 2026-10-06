import type { AdvisorProfile, DisclosureVersion } from "./types";

/** The signed-in advisor. Single-user for now; becomes the account id with auth. */
export const ME = "me";

export const EMPTY_PROFILE: AdvisorProfile = {
  name: "",
  credentials: "",
  firm: "",
  title: "",
  crd: "",
  email: "",
  city: "",
  bio: "",
  niche: "",
  idealClient: "",
  tone: { formalConversational: 60, cautiousBold: 45 },
  opinions: [],
  sampleWriting: "",
  brandColors: [],
  headshots: [],
  disclosures: [],
};

/** A starting point the advisor edits and their compliance team approves. */
export function disclosureTemplate(p: Pick<AdvisorProfile, "name" | "firm" | "crd">) {
  const who = p.name || "[Your name]";
  const firm = p.firm || "[Your firm]";
  return `${who} is a registered representative and investment adviser representative. Securities and advisory services offered through [Broker-dealer / RIA], Member FINRA/SIPC. ${firm} is independent of [Broker-dealer / RIA]. This content is for educational purposes only and is not individualized tax, legal, or investment advice.${p.crd ? ` CRD #${p.crd}.` : ""}`;
}

export function firstDisclosure(text: string, by: string): DisclosureVersion {
  return { id: `d${Date.now()}`, version: "v1.0", label: "Social video disclosure", text, updatedAt: new Date().toISOString(), updatedBy: by || "You", active: true };
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 2) || "·";
