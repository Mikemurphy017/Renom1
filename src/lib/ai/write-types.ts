import type { PlatformId, Script, VideoFormat } from "../types";
import type { VoiceProfile } from "./voice";
import type { WriterId } from "./writers";
import type { CaptionsOutput, ClipsOutput, CoversOutput, IdeasOutput, PostOutput, ScriptOutput, TranscriptOutput } from "./schemas";
import type { PostCopy, PostKind, PostPlatform } from "../types";

/** Requests the browser sends to /api/write. Revisions pass `current` + `instruction`. */
export type WriteRequest =
  | {
      task: "ideas";
      profile: VoiceProfile;
      mode: "evergreen" | "timely";
      format: VideoFormat;
      topic?: string;
      /** Everything the advisor already has or was already offered: videos, ideas on screen, past suggestions. No new idea may repeat one. */
      existing: { title: string; outline?: string[]; subject?: string; angle?: string }[];
      instruction?: string;
      /** How many ideas (default 3, up to 16): the month planner asks for a month's worth at once. */
      count?: number;
    }
  | {
      task: "script";
      profile: VoiceProfile;
      format: VideoFormat;
      /** Which of the four writers writes this version. */
      writer?: WriterId;
      idea: { title: string; outline: string[]; angle?: string };
      context?: string;
      /** How the advisor's other scripts open, so this one doesn't reuse an opening, story or line. */
      otherOpenings?: string[];
      current?: Script;
      instruction?: string;
      /** Condense `current` to this many words at most (a cinematic video is seconds, not a minute). */
      maxWords?: number;
    }
  | {
      task: "captions";
      profile: VoiceProfile;
      /** Which of the four writers writes this version. */
      writer?: WriterId;
      platforms: PlatformId[];
      video: { title: string; format: VideoFormat; script?: Script; outline: string[] };
      current?: CaptionsOutput["captions"];
      instruction?: string;
    }
  | {
      task: "transcript";
      profile: VoiceProfile;
      format: VideoFormat;
      /** What was said in the video, as transcribed in the edit. */
      transcript: string;
    }
  | {
      task: "post";
      profile: VoiceProfile;
      topic: string;
      kind: PostKind;
      platforms: PostPlatform[];
      /** How the advisor's recent posts open, so this one doesn't repeat them. */
      others?: string[];
      /** The advisor's video this post is made from: the post carries its idea, in its own words. */
      source?: { title: string; script?: string; outline?: string[] };
      current?: PostCopy[];
      instruction?: string;
    }
  | {
      task: "clips";
      profile: VoiceProfile;
      /** The long recording, numbered sentence by sentence with times (seconds). */
      sentences: { n: number; start: number; end: number; text: string }[];
      /** How many clips to find. */
      count: number;
      instruction?: string;
    }
  | {
      task: "covers";
      profile: VoiceProfile;
      video: { title: string; format: VideoFormat; script?: Script; outline: string[] };
      instruction?: string;
    };

export type WriteResult<T extends WriteRequest["task"]> = T extends "ideas" ? IdeasOutput : T extends "script" ? ScriptOutput : T extends "captions" ? CaptionsOutput : T extends "post" ? PostOutput : T extends "transcript" ? TranscriptOutput : T extends "clips" ? ClipsOutput : CoversOutput;

export type WriteEvent =
  | { type: "status"; text: string }
  | { type: "result"; data: IdeasOutput | ScriptOutput | CaptionsOutput | CoversOutput | PostOutput | TranscriptOutput | ClipsOutput; source: "claude" | "sample" }
  | { type: "error"; message: string };
