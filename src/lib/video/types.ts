/**
 * Shared types for video processing (captions, AI edit, overlays).
 * Safe to import from both the browser and the server: no provider details here.
 */

export type ProcessorId = "local" | "mock" | "mirage";

export type CaptionStyle = "classic" | "bold" | "minimal";
export type CaptionPosition = "top" | "middle" | "bottom";

/** What the advisor picks in the Edit step's "Look" panel. */
export interface OverlayOptions {
  captions: {
    enabled: boolean;
    style: CaptionStyle;
    position: CaptionPosition;
    /** Highlight color for the active word and key phrases (hex). */
    color: string;
  };
  /** Name + credentials title near the start of the video. */
  lowerThird: { enabled: boolean; name: string; credentials: string; firm: string };
  /** Emphasize the phrases that carry the point (numbers, rules, key terms). */
  keyPhrases: boolean;
  /** Closing card with the advisor's name, firm and a call to action. */
  endCard: { enabled: boolean; headline: string; cta: string };
}

/** What the AI edit is allowed to remove, plus audio cleanup. */
export interface EditOptions {
  removeSilence: boolean;
  removeBadTakes: boolean;
  removeFillers: boolean;
  enhanceAudio: boolean;
}

export type Aspect = "9:16" | "16:9";

/** A time range in seconds against the source recording. */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * "analyze" transcribes the take and suggests cuts.
 * "render" produces the final video with the advisor's chosen cuts and overlays.
 */
export type JobKind = "analyze" | "render";

export interface ProcessRequest {
  kind: JobKind;
  /** Provider id of the uploaded source (from upload). */
  sourceId: string;
  aspect: Aspect;
  edit: EditOptions;
  overlays: OverlayOptions;
  /** Script lines the advisor read from the prompter; helps transcription. */
  script?: string[];
  /** render only: ranges to remove, as finally chosen by the advisor. */
  cuts?: TimeRange[];
}

export type JobState = "queued" | "processing" | "done" | "failed";

export interface JobStatus {
  id: string;
  kind: JobKind;
  state: JobState;
  /** 0 to 1 */
  progress: number;
  /** Human status line ("Transcribing your take…"). */
  stage: string;
  error?: string;
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export type CutKind = "silence" | "retake" | "filler";

export interface SuggestedCut extends TimeRange {
  id: string;
  kind: CutKind;
}

export interface JobResult {
  jobId: string;
  kind: JobKind;
  /** Playable output. For "analyze" this may be the source itself. */
  outputUrl?: string;
  durationSec: number;
  transcript: TranscriptWord[];
  cuts: SuggestedCut[];
  /** Phrases worth emphasizing on screen, as they appear in the transcript. */
  keyPhrases: string[];
  /** analyze: loudness every 0.1 s (0–1) for the timeline waveform. */
  levels?: number[];
  /** render: the stored MP4's upload id and size. */
  outputId?: string;
  sizeBytes?: number;
}

export interface UploadResponse {
  ok: true;
  sourceId: string;
  processor: ProcessorId;
}

/** NDJSON events from GET /api/video/jobs/[id]/stream */
export type JobEvent =
  | { type: "status"; status: JobStatus }
  | { type: "result"; data: JobResult }
  | { type: "error"; message: string };

export const DEFAULT_EDIT: EditOptions = { removeSilence: true, removeBadTakes: true, removeFillers: true, enhanceAudio: true };

/** Upload limits shared by the client check and the server route. */
export const MAX_UPLOAD_MB = 500;
export const ACCEPTED_VIDEO_TYPES = ["video/webm", "video/mp4", "video/quicktime"];
