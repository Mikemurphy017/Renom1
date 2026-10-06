import { Lightbulb, Image, ScrollText, AlignLeft, Video, Scissors, Send, type LucideIcon } from "lucide-react";
import type { StageId } from "./types";

export interface StageDef {
  id: StageId;
  label: string;
  verb: string;
  icon: LucideIcon;
  description: string;
}

export const STAGES: StageDef[] = [
  { id: "idea", label: "Idea", verb: "Shape the idea", icon: Lightbulb, description: "Evergreen and timely ideas grounded in your niche." },
  { id: "thumbnail", label: "Thumbnail", verb: "Design the thumbnail", icon: Image, description: "One headshot, endless poses." },
  { id: "script", label: "Script", verb: "Write the script", icon: ScrollText, description: "Hook, body and CTA in your voice." },
  { id: "descriptions", label: "Descriptions", verb: "Write descriptions", icon: AlignLeft, description: "Platform-ready copy with disclosures." },
  { id: "record", label: "Record", verb: "Record", icon: Video, description: "Teleprompter studio in your browser." },
  { id: "edit", label: "Edit", verb: "Edit", icon: Scissors, description: "Text-based editing and captions." },
  { id: "post", label: "Post", verb: "Publish", icon: Send, description: "Review, schedule and publish." },
];

export const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id);
export const getStage = (id: StageId) => STAGES[stageIndex(id)];
export const isStageId = (v: string): v is StageId => STAGES.some((s) => s.id === v);
