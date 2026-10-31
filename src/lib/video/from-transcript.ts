"use client";

import { streamWrite } from "@/lib/ai/writer";
import type { VoiceProfile } from "@/lib/ai/voice";
import type { Category, Video } from "@/lib/types";
import type { JobResult } from "./types";

/**
 * A finished video brought in without a script: once the edit has transcribed
 * it, its words become the title, outline and script that captions, covers and
 * posts are written from.
 */

/** What was said, leaving out what the edit cut (pauses, retakes, fillers). */
export function spokenText(r: JobResult) {
  const cut = (t: number) => r.cuts.some((c) => t >= c.start && t < c.end);
  return r.transcript
    .filter((w) => !cut(w.start))
    .map((w) => w.text)
    .join(" ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

/** Without the writer: the first sentence is the hook, the last the close, the rest in paragraphs of three. */
export function plainScript(text: string): Pick<Video, "title" | "outline" | "script"> {
  const sentences = text.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const hook = sentences[0] ?? "";
  const cta = sentences.length > 2 ? sentences.at(-1)! : "";
  const middle = sentences.slice(1, cta ? -1 : undefined);
  const body: string[] = [];
  for (let i = 0; i < middle.length; i += 3) body.push(middle.slice(i, i + 3).join(" "));
  const first = hook.replace(/[.!?"”]+$/, "");
  return {
    title: first.length > 70 ? `${first.slice(0, 67).replace(/\s+\S*$/, "")}…` : first || "Uploaded video",
    outline: body.slice(0, 4).map((p) => (p.length > 90 ? `${p.slice(0, 87).replace(/\s+\S*$/, "")}…` : p)),
    script: { hook, body: body.length ? body : [hook], cta },
  };
}

export async function scriptFromTranscript(result: JobResult, profile: VoiceProfile, format: Video["format"]): Promise<Partial<Video>> {
  const text = spokenText(result);
  try {
    const out = await streamWrite({ task: "transcript", profile, format, transcript: text });
    return {
      title: out.title,
      subject: out.subject,
      category: out.category as Category,
      outline: out.outline,
      script: { hook: out.hook, body: out.body.length ? out.body : [out.hook], cta: out.cta },
    };
  } catch {
    return plainScript(text);
  }
}
