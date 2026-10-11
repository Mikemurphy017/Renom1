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

const BOOKING = "{{BOOKING_LINK}}";
export const BOOKING_LINE = "Book a time with me:";

/**
 * The writer marks where a link belongs with {{BOOKING_LINK}}. With a calendar
 * link it goes there (or on its own line at the end); without one, the
 * placeholder and the short "Book a call:"-style lead-in around it come out.
 */
export function withBooking(description: string, bookingUrl?: string) {
  if (bookingUrl) return description.includes(BOOKING) ? description.replaceAll(BOOKING, bookingUrl) : `${description.trimEnd()}\n\n${BOOKING_LINE} ${bookingUrl}`;
  if (!description.includes(BOOKING)) return description;
  return description
    .split("\n")
    .flatMap((line) => {
      if (!line.includes(BOOKING)) return [line];
      const rest = line.replaceAll(BOOKING, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
      // "Book a call: {{BOOKING_LINK}}" → nothing left worth keeping.
      return !rest || /[:→\-–—]$/.test(rest) || rest.length < 40 ? [] : [rest];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function composeCaption(copy: Pick<PlatformCopy, "description" | "hashtags">, platform: PlatformId, profile: AdvisorProfile, bookingUrl?: string) {
  const desc = withBooking(copy.description, bookingUrl);
  const tags = copy.hashtags.map((h) => `#${h}`).join(" ");
  return [desc, tags, disclosureFor(platform, profile)].filter(Boolean).join("\n\n");
}
