import type { BufferService } from "@/lib/buffer/types";
import type { PlatformId } from "@/lib/types";

/**
 * Advisors post from their own Buffer: they connect their social accounts in
 * Buffer, paste their Buffer API key here once, and post a finished video now
 * or at a set time. Each advisor's key only ever sees their own Buffer, and it
 * never leaves the server.
 */

/** The Buffer channel type behind each of our platforms (Shorts post to the same YouTube channel). */
export const SERVICE_OF: Record<PlatformId, BufferService> = {
  youtube: "youtube",
  youtube_shorts: "youtube",
  instagram: "instagram",
  tiktok: "tiktok",
  facebook: "facebook",
  linkedin: "linkedin",
  x: "twitter",
};

export interface OwnChannel {
  id: string;
  service: string;
  name: string;
  avatar?: string;
  /** Needs reconnecting in Buffer. */
  disconnected?: boolean;
}

export interface SocialStatus {
  /** The studio can store keys (SECRETS_KEY is set). */
  available: boolean;
  connected: boolean;
  /** The Buffer account and organization the key belongs to. */
  email?: string;
  organization?: string;
  channels: OwnChannel[];
  /** The key stopped working (revoked, say). */
  error?: string;
}

export type SocialPostStatus = "scheduled" | "posting" | "posted" | "failed" | "cancelled";

export interface SocialPost {
  /** Buffer post id. */
  id: string;
  videoId: string;
  platform: PlatformId;
  channelId: string;
  channelName: string;
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
