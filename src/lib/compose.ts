import type { AdvisorProfile, PlatformId } from "./types";
import type { PlatformCopy } from "./ai/content";

/** The active compliance disclosure, firm line and per-platform composition of the final caption. */
export const activeDisclosure = (profile: AdvisorProfile) => profile.disclosures.find((d) => d.active) ?? profile.disclosures[0];
export const firmLine = (profile: AdvisorProfile) => [[profile.name, profile.credentials].filter(Boolean).join(", "), profile.firm, profile.city].filter(Boolean).join(" · ");
const SHORT_DISCLOSURE = "Disclosures: halewealth.example/disclosures";

export function disclosureFor(p: PlatformId, profile: AdvisorProfile) {
  const text = activeDisclosure(profile)?.text ?? "";
  if (p === "x") return text ? SHORT_DISCLOSURE : "";
  return [firmLine(profile), text].filter(Boolean).join("\n\n");
}

export function composeCaption(copy: Pick<PlatformCopy, "description" | "hashtags">, platform: PlatformId, profile: AdvisorProfile, bookingUrl?: string) {
  const desc = bookingUrl ? copy.description.replaceAll("{{BOOKING_LINK}}", bookingUrl) : copy.description;
  const tags = copy.hashtags.map((h) => `#${h}`).join(" ");
  return [desc, tags, disclosureFor(platform, profile)].filter(Boolean).join("\n\n");
}
