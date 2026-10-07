export type StageId = "idea" | "script" | "record" | "edit" | "review" | "post";

export type VideoFormat = "short" | "long";

export type PlatformId = "youtube" | "youtube_shorts" | "instagram" | "tiktok" | "facebook" | "linkedin" | "x";

export type Category =
  | "Tax Planning"
  | "Retirement"
  | "Equity Comp"
  | "Estate Planning"
  | "Market Commentary"
  | "Charitable Giving"
  | "Wealth Strategy";

export type ComplianceStatus = "draft" | "submitted" | "changes_requested" | "approved";

/** "draft": finished and saved, not posted anywhere yet. */
export type VideoStatus = "in_progress" | "draft" | "scheduled" | "published";

export type ThumbStyle = "navy" | "ivory" | "brass" | "slate";
export type Pose = "center" | "left" | "right" | "point" | "think" | "crossed";

export interface ThumbnailSpec {
  style: ThumbStyle;
  pose: Pose;
  headline: string;
  /** word(s) in the headline drawn in the accent color */
  accent?: string;
}

export interface Script {
  hook: string;
  body: string[];
  cta: string;
}

export interface PlatformMetrics {
  platform: PlatformId;
  views: number;
  watchTimeSec: number; // avg view duration
  engagementRate: number; // %
  followers: number; // net new
  linkClicks: number;
  inquiries: number;
}

export interface Video {
  id: string;
  title: string;
  category: Category;
  format: VideoFormat;
  stage: StageId;
  status: VideoStatus;
  mode: "evergreen" | "timely";
  lastEdited: string; // ISO
  createdAt: string;
  outline: string[];
  thumbnail?: ThumbnailSpec;
  script?: Script;
  runtimeSec: number;
  platforms: PlatformId[];
  scheduledFor?: string;
  publishedAt?: string;
  compliance: ComplianceStatus;
  metrics?: PlatformMetrics[];
  /** Final rendered video from the AI edit (see src/lib/video). */
  outputUrl?: string;
  /** The rendered MP4 in platform storage. */
  output?: RenderedVideo;
  /** Exactly what went out, kept for books-and-records. */
  posts?: PostRecord[];
  /** The recorded take, saved to platform storage. */
  take?: StoredTake;
  /** Last finished AI Edit analysis, so the transcript survives a reload. */
  analysisJobId?: string;
  /** Rendered cover images, one per shape. */
  covers?: Partial<Record<VideoFormat, CoverImage>>;
  /** The latest request for the team to post this video (mirrors the server). */
  teamPost?: { id: string; status: "submitted" | "in_buffer" | "scheduled" | "posted" | "returned" | "cancelled"; at?: string; note?: string };
}

export interface RenderedVideo {
  id: string;
  url: string;
  durationSec: number;
  sizeBytes?: number;
  aspect: "9:16" | "16:9";
  renderedAt: string;
}

export interface StoredTake {
  sourceId: string;
  url: string;
  mimeType: string;
  durationSec: number;
  width: number;
  height: number;
  recordedAt: string;
}

export interface CoverImage {
  /** Media id in platform storage. */
  id: string;
  url: string;
  headline: string;
  template: string;
  /** When the photo is a frame of the take: where it is, so networks that pick a frame can match. */
  frameMs?: number;
  createdAt: string;
}

export interface PostRecord {
  platform: PlatformId;
  channel: string;
  caption: string;
  disclosureVersion: string;
  at: string;
  how: "buffer-now" | "buffer-scheduled" | "buffer-queue" | "buffer-draft" | "manual" | "team";
}

export interface Platform {
  id: PlatformId;
  label: string;
  short: string;
  aspect: "9:16" | "16:9" | "1:1 / 4:5";
  preferredFormat: VideoFormat;
  titleLimit?: number;
  descLimit: number;
  hashtagLimit?: number;
  maxFileMB: number;
  customThumbnail: boolean;
  connected: boolean;
  handle?: string;
}

export interface AdvisorProfile {
  name: string;
  credentials: string;
  firm: string;
  title: string;
  crd: string;
  email: string;
  city: string;
  bio: string;
  niche: string;
  idealClient: string;
  tone: { formalConversational: number; cautiousBold: number };
  opinions: string[];
  sampleWriting: string;
  brandColors: string[];
  /** Uploaded photos (url set) are used on covers; pose-only entries are legacy placeholders. */
  headshots: { id: string; label: string; pose: Pose; url?: string }[];
  /** The advisor's own b-roll (photos, clips) and music, used by edit styles. */
  library?: LibraryItem[];
  disclosures: DisclosureVersion[];
}

export interface LibraryItem {
  id: string;
  url: string;
  kind: "broll" | "music";
  /** MIME type, e.g. video/mp4, image/jpeg, audio/mpeg */
  type: string;
  label: string;
  addedAt: string;
}

export interface DisclosureVersion {
  id: string;
  version: string;
  label: string;
  text: string;
  updatedAt: string;
  updatedBy: string;
  active: boolean;
}
