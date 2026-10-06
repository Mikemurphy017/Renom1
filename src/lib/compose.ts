import { ADVISOR } from "./mock/advisor";
import type { PlatformId } from "./types";
import type { PlatformCopy } from "./ai/content";

/** The active compliance disclosure, firm line and per-platform composition of the final caption. */
export const activeDisclosure = () => ADVISOR.disclosures.find((d) => d.active)!;
export const firmLine = () => `${ADVISOR.name}, ${ADVISOR.credentials} · ${ADVISOR.firm} · ${ADVISOR.city}`;
const SHORT_DISCLOSURE = "Disclosures: halewealth.example/disclosures";

export function disclosureFor(p: PlatformId) {
  return p === "x" ? SHORT_DISCLOSURE : `${firmLine()}\n\n${activeDisclosure().text}`;
}

export function composeCaption(copy: Pick<PlatformCopy, "description" | "hashtags">, platform: PlatformId, bookingUrl?: string) {
  const desc = bookingUrl ? copy.description.replaceAll("{{BOOKING_LINK}}", bookingUrl) : copy.description;
  const tags = copy.hashtags.map((h) => `#${h}`).join(" ");
  return [desc, tags, disclosureFor(platform)].filter(Boolean).join("\n\n");
}
