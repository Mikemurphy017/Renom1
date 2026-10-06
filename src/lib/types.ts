export type StageId = "idea" | "script" | "record" | "edit" | "post";

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

export type VideoStatus = "in_progress" | "scheduled" | "published";

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
  /** Exactly what went out, kept for books-and-records. */
  posts?: PostRecord[];
}

export interface PostRecord {
  platform: PlatformId;
  channel: string;
  caption: string;
  disclosureVersion: string;
  at: string;
  how: "buffer-now" | "buffer-scheduled" | "buffer-queue" | "buffer-draft" | "manual";
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
  headshots: { id: string; label: string; pose: Pose }[];
  disclosures: DisclosureVersion[];
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
