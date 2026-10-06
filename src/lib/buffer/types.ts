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
  /** How the post was scheduled: a set time (customScheduled) or a queue slot (addToQueue / shareNext). */
  shareMode?: BufferShareMode;
  /** What Buffer lets this account do with the post (e.g. updatePostSchedule, deletePost). */
  allowedActions?: string[];
}

/* ---------- Posts, metrics, ideas, tags (Buffer GraphQL schema names) ---------- */

export const BUFFER_POST_STATUSES = ["draft", "error", "needs_approval", "scheduled", "sending", "sent"] as const;
export type BufferPostStatus = (typeof BUFFER_POST_STATUSES)[number];
export type BufferShareMode = "addToQueue" | "customScheduled" | "shareNext" | "shareNow";
export type BufferQueuePosition = "top" | "bottom";
export type BufferSortField = "dueAt" | "createdAt";
export type BufferSortDirection = "asc" | "desc";

/** One metric as Buffer reports it. `unit: "percentage"` values are already percents (0.33 = 0.33%). */
export interface BufferMetric {
  type: string;
  name: string;
  value: number;
  unit: "count" | "percentage";
  description?: string;
}

export interface BufferTag {
  id: string;
  name: string;
  color: string;
}

export interface BufferPost {
  id: string;
  text: string;
  status: BufferPostStatus;
  dueAt: string | null;
  sentAt: string | null;
  createdAt: string;
  channelId: string;
  channelService: BufferService;
  externalLink: string | null;
  shareMode: BufferShareMode;
  allowedActions: string[];
  error: { message: string } | null;
  tags: BufferTag[];
  metrics: BufferMetric[] | null;
}

export interface BufferPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ListBufferPostsParams {
  status?: BufferPostStatus[];
  channelIds?: string[];
  tagIds?: string[];
  /** ISO date-times bounding dueAt. */
  dueFrom?: string;
  dueTo?: string;
  sort?: BufferSortField;
  direction?: BufferSortDirection;
  first?: number;
  after?: string;
}

export interface EditBufferPostRequest {
  text?: string;
  /** New time (ISO). Sets the post to a custom scheduled time. */
  dueAt?: string;
}

export interface BufferMetricsRange {
  start: string;
  end: string;
  channelIds?: string[];
}

export interface BufferMetricsResult {
  organization: { id: string; name: string };
  range: { start: string; end: string };
  metrics: BufferMetric[];
  metricsUpdatedAt: string | null;
}

export interface BufferIdea {
  id: string;
  groupId: string | null;
  createdAt: number;
  updatedAt: number;
  content: { title: string | null; text: string | null; services: BufferService[]; date: string | null; tags: BufferTag[] };
}

export interface BufferIdeaGroup {
  id: string;
  name: string;
  isLocked: boolean;
}

export interface CreateBufferIdeaRequest {
  title: string;
  text?: string;
  services?: BufferService[];
  /** Target date for the idea (ISO). */
  date?: string;
  groupId?: string;
  aiAssisted?: boolean;
}

/** Every JSON route answers `{ ok: true, ... }` or `{ ok: false, error }`. */
export type BufferApi<T> = ({ ok: true } & T) | { ok: false; error: string };

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
