import type { PlatformId, Script, VideoFormat } from "../types";
import type { VoiceProfile } from "./voice";
import type { WriterId } from "./writers";
import type { CaptionsOutput, CoversOutput, IdeasOutput, ScriptOutput } from "./schemas";

/** Requests the browser sends to /api/write. Revisions pass `current` + `instruction`. */
export type WriteRequest =
  | {
      task: "ideas";
      profile: VoiceProfile;
      mode: "evergreen" | "timely";
      format: VideoFormat;
      topic?: string;
      existingTitles: string[];
      instruction?: string;
    }
  | {
      task: "script";
      profile: VoiceProfile;
      format: VideoFormat;
      /** Which of the four writers writes this version. */
      writer?: WriterId;
      idea: { title: string; outline: string[] };
      context?: string;
      current?: Script;
      instruction?: string;
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
      task: "covers";
      profile: VoiceProfile;
      video: { title: string; format: VideoFormat; script?: Script; outline: string[] };
      instruction?: string;
    };

export type WriteResult<T extends WriteRequest["task"]> = T extends "ideas" ? IdeasOutput : T extends "script" ? ScriptOutput : T extends "captions" ? CaptionsOutput : CoversOutput;

export type WriteEvent =
  | { type: "status"; text: string }
  | { type: "result"; data: IdeasOutput | ScriptOutput | CaptionsOutput | CoversOutput; source: "claude" | "sample" }
  | { type: "error"; message: string };
