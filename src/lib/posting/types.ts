import type { PlatformId, VideoFormat } from "@/lib/types";

/**
 * A request from an advisor for the team to post a finished video. The
 * advisor sends the video, the captions and when they'd like it out; the team
 * posts it (through Buffer, from the admin dashboard) and the status flows
 * back to the advisor's studio.
 */

export type PostRequestStatus = "submitted" | "in_buffer" | "scheduled" | "posted" | "returned" | "cancelled";

export interface PostRequestCaption {
  platform: PlatformId;
  /** Caption with hashtags and disclosure, exactly as it should go out. */
  text: string;
  title?: string;
}

export interface PostRequestCover {
  shape: VideoFormat;
  url: string;
  frameMs?: number;
}

export interface PostRequestTiming {
  kind: "asap" | "at";
  /** ISO, when kind is "at". */
  at?: string;
}

export interface PostRequestBufferPost {
  channelId: string;
  channel: string;
  platform: PlatformId | null;
  mode: "draft" | "now" | "schedule" | "queue";
  dueAt?: string | null;
  postId?: string;
}

export interface PostRequest {
  id: string;
  userId: string;
  advisorName: string;
  advisorEmail: string;
  videoId: string;
  title: string;
  format: VideoFormat;
  /** The rendered MP4 (upload id and its app URL). */
  output: { id: string; url: string; aspect: "9:16" | "16:9"; durationSec: number };
  covers: PostRequestCover[];
  platforms: PlatformId[];
  captions: PostRequestCaption[];
  disclosureVersion: string;
  /** One-liner the advisor picked to go with the post. */
  tagline?: string;
  timing: PostRequestTiming;
  note?: string;
  status: PostRequestStatus;
  submittedAt: string;
  updatedAt: string;
  /** Message from the team (e.g. why it was sent back). */
  teamNote?: string;
  scheduledFor?: string;
  postedAt?: string;
  buffer?: PostRequestBufferPost[];
}

/** What the advisor sees of a request (no Buffer details). */
export type AdvisorPostRequest = Omit<PostRequest, "buffer">;

export const OPEN_STATUSES: PostRequestStatus[] = ["submitted", "in_buffer", "scheduled"];
