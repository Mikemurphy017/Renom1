import type { PlatformId } from "@/lib/types";

/**
 * Advisors connect their own social accounts (through Ayrshare) and post a
 * finished video now or at a set time. These are the shapes the browser sees;
 * Ayrshare keys and profile keys never leave the server.
 */

/** The Ayrshare network behind each of our platforms (Shorts post to the same YouTube channel). */
export const NETWORK: Record<PlatformId, string> = {
  youtube: "youtube",
  youtube_shorts: "youtube",
  instagram: "instagram",
  tiktok: "tiktok",
  facebook: "facebook",
  linkedin: "linkedin",
  x: "twitter",
};

export interface ConnectedAccount {
  /** Ayrshare network id (youtube, instagram, twitter…). */
  network: string;
  name: string;
  avatar?: string;
  url?: string;
}

export interface SocialStatus {
  /** The studio has Ayrshare set up (an administrator adds the keys). */
  configured: boolean;
  accounts: ConnectedAccount[];
  /** Networks the studio can't post to yet (X needs the studio's own X app keys). */
  unavailable: string[];
}

export type SocialPostStatus = "scheduled" | "posting" | "posted" | "failed" | "cancelled";

export interface SocialPost {
  /** Ayrshare post id. */
  id: string;
  videoId: string;
  platform: PlatformId;
  caption: string;
  disclosureVersion: string;
  status: SocialPostStatus;
  createdAt: string;
  /** When it goes (or went) out. */
  scheduledFor?: string;
  postedAt?: string;
  postUrl?: string;
  error?: string;
}
