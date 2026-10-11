import type { AdvisorProfile, Video } from "./types";

/**
 * The advisor's calendar link (Settings → Calendar link), added to a video's
 * post captions and end-card call to action unless they switch it off for
 * that video in the Edit step.
 */

export const DEFAULT_CTA = "Follow for more like this";
const CTA_PREFIX = "Book a time: ";

/** "https://www.calendly.com/mike/" → "calendly.com/mike", for on-screen text. */
export const shortUrl = (u: string) => u.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");

/** A usable https link from what the advisor typed ("calendly.com/mike" works), or null. */
export function normalizeUrl(input: string): string | null {
  let t = input.trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  try {
    const u = new URL(t);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, u.pathname === "/" && !u.search ? "" : "/").replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const bookingCta = (url: string) => `${CTA_PREFIX}${shortUrl(url)}`;
export const isBookingCta = (cta: string) => cta.startsWith(CTA_PREFIX);

/** On unless switched off for this video, and only when there's a link. */
export const bookingOn = (video: Pick<Video, "bookingLink">, profile: Pick<AdvisorProfile, "calendarUrl">) => !!profile.calendarUrl && video.bookingLink !== false;
export const bookingUrlFor = (video: Pick<Video, "bookingLink">, profile: Pick<AdvisorProfile, "calendarUrl">) => (bookingOn(video, profile) ? profile.calendarUrl : undefined);
