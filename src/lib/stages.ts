import { Lightbulb, ScrollText, Video, Scissors, Send, MonitorPlay, type LucideIcon } from "lucide-react";
import type { StageId } from "./types";

export interface StageDef {
  id: StageId;
  label: string;
  icon: LucideIcon;
  /** Shown under the step title in the studio. */
  prompt: string;
}

export const STAGES: StageDef[] = [
  { id: "idea", label: "Idea", icon: Lightbulb, prompt: "What do you want to talk about?" },
  { id: "script", label: "Script", icon: ScrollText, prompt: "Your words, sharpened." },
  { id: "record", label: "Record", icon: Video, prompt: "Read it like you mean it." },
  { id: "edit", label: "Edit", icon: Scissors, prompt: "Cut the pauses. Keep you." },
  { id: "review", label: "Review", icon: MonitorPlay, prompt: "Watch it once. Then post." },
  { id: "post", label: "Post", icon: Send, prompt: "Download it, copy the post, done." },
];

export const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id);
export const getStage = (id: StageId) => STAGES[stageIndex(id)];
export const isStageId = (v: string): v is StageId => STAGES.some((s) => s.id === v);
