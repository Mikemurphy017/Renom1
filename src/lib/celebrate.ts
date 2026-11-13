/**
 * A small celebration when something goes out: posted now, scheduled, handed
 * to the team, or marked as posted by hand. Any component can call it; the
 * <Celebration /> mounted once in the app shows it.
 */

export type CelebrateKind = "now" | "scheduled" | "team" | "manual";

export interface CelebrateDetail {
  kind: CelebrateKind;
  /** A video or a post. */
  what: "video" | "post";
  /** Where it's going ("LinkedIn, Facebook"), when known. */
  where?: string;
  /** When it goes out, for "scheduled" (already formatted for people). */
  when?: string;
}

export const CELEBRATE_EVENT = "renom:celebrate";

export function celebrate(detail: CelebrateDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail }));
}

/** The words for each moment. */
export function celebrationCopy(d: CelebrateDetail): { title: string; body: string } {
  const it = d.what === "video" ? "video" : "post";
  const on = d.where ? ` on ${d.where}` : "";
  switch (d.kind) {
    case "now":
      return { title: "It’s live!", body: `Your ${it} is going out now${on}. That’s how a pipeline gets built.` };
    case "scheduled":
      return { title: "Scheduled!", body: `Your ${it} goes out${d.when ? ` ${d.when}` : ""}${on}. One less thing on your plate.` };
    case "team":
      return { title: "Handed off!", body: `Your team will post this ${it}. You’ll see it here once it’s scheduled.` };
    default:
      return { title: "Nice work. It’s out there.", body: `Marked as posted. The ${it}, captions and disclosure are saved in your archive.` };
  }
}
