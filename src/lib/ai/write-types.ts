import type { PlatformId, Script, VideoFormat } from "../types";
import type { VoiceProfile } from "./voice";
import type { CaptionsOutput, IdeasOutput, ScriptOutput } from "./schemas";

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
      idea: { title: string; outline: string[] };
      context?: string;
      current?: Script;
      instruction?: string;
    }
  | {
      task: "captions";
      profile: VoiceProfile;
      platforms: PlatformId[];
      video: { title: string; format: VideoFormat; script?: Script; outline: string[] };
      current?: CaptionsOutput["captions"];
      instruction?: string;
    };

export type WriteResult<T extends WriteRequest["task"]> = T extends "ideas" ? IdeasOutput : T extends "script" ? ScriptOutput : CaptionsOutput;

export type WriteEvent =
  | { type: "status"; text: string }
  | { type: "result"; data: IdeasOutput | ScriptOutput | CaptionsOutput; source: "claude" | "sample" }
  | { type: "error"; message: string };
