import { ADVISOR } from "./mock/advisor";
import type { AdvisorProfile, PlatformId } from "./types";
import type { PlatformCopy } from "./ai/content";

/** The active compliance disclosure, firm line and per-platform composition of the final caption. */
export const activeDisclosure = (profile: AdvisorProfile = ADVISOR) => profile.disclosures.find((d) => d.active) ?? profile.disclosures[0];
export const firmLine = (profile: AdvisorProfile = ADVISOR) => `${profile.name}, ${profile.credentials} · ${profile.firm} · ${profile.city}`;
const SHORT_DISCLOSURE = "Disclosures: halewealth.example/disclosures";

export function disclosureFor(p: PlatformId, profile: AdvisorProfile = ADVISOR) {
  return p === "x" ? SHORT_DISCLOSURE : `${firmLine(profile)}\n\n${activeDisclosure(profile).text}`;
}

export function composeCaption(copy: Pick<PlatformCopy, "description" | "hashtags">, platform: PlatformId, profile: AdvisorProfile = ADVISOR, bookingUrl?: string) {
  const desc = bookingUrl ? copy.description.replaceAll("{{BOOKING_LINK}}", bookingUrl) : copy.description;
  const tags = copy.hashtags.map((h) => `#${h}`).join(" ");
  return [desc, tags, disclosureFor(platform, profile)].filter(Boolean).join("\n\n");
}
