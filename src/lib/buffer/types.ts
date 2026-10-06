import type { PlatformId, VideoFormat } from "../types";

/** Shapes shared by the Buffer API routes and the client. */
export type BufferService =
  | "bluesky" | "facebook" | "googlebusiness" | "instagram" | "linkedin" | "mastodon" | "pinterest"
  | "startPage" | "substack" | "threads" | "tiktok" | "twitter" | "whatsapp" | "youtube";

export interface BufferChannel {
  id: string;
  name: string;
  displayName: string | null;
  service: BufferService;
  type: string;
  avatar: string;
  timezone: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
}

export interface BufferScheduledPost {
  id: string;
  text: string;
  status: string;
  dueAt: string | null;
  channelId: string;
  channelService: BufferService;
}

export type BufferStatus =
  | { configured: false; reason: string }
  | {
      configured: true;
      account: { name: string | null; email: string; timezone: string | null };
      organization: { id: string; name: string; channelCount: number; channelLimit: number };
      channels: BufferChannel[];
      upcoming: BufferScheduledPost[];
    }
  | { configured: true; error: string };

export type BufferMode = "now" | "schedule" | "queue";

export interface CreateBufferPostRequest {
  channelId: string;
  service: BufferService;
  text: string;
  mode: BufferMode;
  dueAt?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  /** Send to Buffer as a draft instead of scheduling it. */
  draft?: boolean;
}

export type CreateBufferPostResponse =
  | { ok: true; post: { id: string; status: string; dueAt: string | null; externalLink: string | null } }
  | { ok: false; error: string };

/** Which Renom platform a Buffer channel corresponds to. */
export function platformForService(service: BufferService, format: VideoFormat): PlatformId | null {
  switch (service) {
    case "linkedin": return "linkedin";
    case "youtube": return format === "short" ? "youtube_shorts" : "youtube";
    case "instagram": return "instagram";
    case "tiktok": return "tiktok";
    case "facebook": return "facebook";
    case "twitter": return "x";
    default: return null;
  }
}
