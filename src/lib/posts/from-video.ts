import type { Video } from "@/lib/types";

/** What the post writer gets from a video: its title and the script (or outline), as plain text. */
export function postSourceOf(v: Video | undefined) {
  if (!v) return undefined;
  const s = v.script;
  const script = s ? [s.hook, ...s.body, s.cta].map((l) => l.trim()).filter(Boolean).join("\n\n") : undefined;
  return { title: v.title, script, outline: script ? undefined : v.outline.slice(0, 8) };
}

/** Videos worth turning into posts: anything with a script or an outline, newest first. */
export const postableVideos = (videos: Video[]) => videos.filter((v) => v.script || v.outline.length).sort((a, b) => b.lastEdited.localeCompare(a.lastEdited));
