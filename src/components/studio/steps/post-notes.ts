import type { Platform, Video } from "@/lib/types";

export type Note = { level: "info" | "warn" | "block"; text: string };

export function notesFor(p: Platform, v: Video, useThumb: boolean): Note[] {
  const n: Note[] = [];
  const sizeMB = v.format === "short" ? 48 : 420;
  if (!p.connected) n.push({ level: "block", text: `${p.label} isn't connected. Connect it in Settings to publish.` });
  if (sizeMB > p.maxFileMB) n.push({ level: "block", text: `File is ${sizeMB} MB — over the ${p.maxFileMB} MB limit.` });
  else n.push({ level: "info", text: `${sizeMB} MB MP4 · within the ${p.maxFileMB >= 1000 ? `${p.maxFileMB / 1000} GB` : `${p.maxFileMB} MB`} limit.` });
  if (useThumb && !p.customThumbnail) n.push({ level: "warn", text: `${p.label} does not support custom thumbnails — it will be ignored.` });
  if (p.id === "linkedin" && v.format === "short") n.push({ level: "warn", text: "LinkedIn recommends 16:9 — your 9:16 video will display with side bars on desktop." });
  if (p.id === "youtube" && v.format === "short") n.push({ level: "warn", text: "Vertical video under 3 minutes will be classified as a Short." });
  if ((p.id === "youtube_shorts" || p.id === "instagram" || p.id === "tiktok") && v.format === "long") n.push({ level: "block", text: `${p.label} expects 9:16 vertical video. Choose a 16:9 platform or re-record.` });
  if (p.id === "facebook") n.push({ level: "info", text: "Plays as a Reel in feed; 4:5 crop is applied automatically." });
  if (p.id === "x" && v.runtimeSec > 140) n.push({ level: "block", text: "X limits video to 2:20 for standard accounts." });
  return n;
}
