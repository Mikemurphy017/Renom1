"use client";

import { streamWrite } from "@/lib/ai/writer";
import { WRITERS } from "@/lib/ai/writers";
import { estimateRuntime } from "@/lib/ai/content";
import { countWords } from "@/lib/cinematic/core";
import { uploadImage } from "@/lib/media/upload";
import { canvasBlob, drawGraphic, headlineFrom } from "@/lib/posts/graphic";
import { seedDraft } from "@/lib/drafts";
import type { AdvisorProfile, PlanItem, PlatformId, PostDraft, PostImage, PostPlatform, Script, Video } from "@/lib/types";
import type { PlatformCopy } from "@/lib/ai/content";
import { voiceProfileOf } from "@/lib/store";

/**
 * The content plan, done for the advisor. For each planned item:
 *  - a post is written, given one picture, and left on the calendar ready to
 *    review and post;
 *  - a video is scripted, then either left ready to film on its day, or made
 *    as an AI video and queued, with its captions, for the advisor's approval.
 * It runs in the browser (the writer streams to it) and keeps going while the
 * advisor moves around the app; progress is shared with any page that asks.
 */

export interface AutopilotOptions {
  /** How this batch of videos is made. */
  make: "film" | "ai";
  /** For AI videos: the setting, voice and the advisor's consent (required). */
  ai?: { settingId: string; voiceId: string; consent: boolean; aiLabel: boolean; maxWords: number };
}

export interface AutopilotApi {
  profile: AdvisorProfile;
  videos: Video[];
  posts: PostDraft[];
  addVideo: (v: Partial<Video> & Pick<Video, "title">) => Video;
  updateVideo: (id: string, patch: Partial<Video>) => void;
  addPost: (p: Pick<PostDraft, "kind"> & Partial<PostDraft>) => PostDraft;
  updatePost: (id: string, patch: Partial<PostDraft>) => void;
  updatePlanItem: (id: string, patch: Partial<PlanItem>) => void;
}

export interface AutopilotProgress {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  current?: string;
}

let progress: AutopilotProgress = { running: false, total: 0, done: 0, failed: 0 };
const listeners = new Set<() => void>();
const emit = (p: Partial<AutopilotProgress>) => {
  progress = { ...progress, ...p };
  listeners.forEach((l) => l());
};
export const autopilotProgress = () => progress;
export function subscribeAutopilot(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const POST_PLATFORMS = (kind: PostDraft["kind"]): PostPlatform[] => (kind === "image" ? ["linkedin", "facebook", "instagram"] : ["linkedin", "facebook"]);
export const VIDEO_PLATFORMS: PlatformId[] = ["youtube_shorts", "instagram", "linkedin"];
const mediaIdOf = (url?: string) => /\/api\/media\/(img[a-f0-9]{18})/.exec(url ?? "")?.[1];
/** 9:00 on the planned day, local time. */
const nineOn = (ymd: string) => new Date(`${ymd}T09:00:00`).toISOString();

/** Whether AI photos of the advisor can be made right now (and from which headshots). */
async function aiImageReady(profile: AdvisorProfile) {
  const headshots = profile.headshots.map((h) => mediaIdOf(h.url)).filter((x): x is string => !!x);
  if (!headshots.length) return null;
  const j = await fetch("/api/posts/image", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
  return j?.configured ? headshots : null;
}

/** One picture for a post: an AI photo of the advisor when possible, otherwise a headline graphic. */
async function pictureFor(post: PostDraft, headline: string, scene: string | undefined, headshots: string[] | null, profile: AdvisorProfile): Promise<PostImage> {
  if (headshots && scene && scene.length >= 8) {
    const r = await fetch("/api/posts/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ headshots: headshots.slice(0, 4), scene, aspect: "4:5" }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok && j.image) return j.image as PostImage;
    console.warn("[plan] AI picture failed, using a graphic:", j.error);
  }
  const canvas = document.createElement("canvas");
  await drawGraphic(canvas, { headline, name: profile.name, sub: [profile.credentials, profile.firm].filter(Boolean).join(" · "), aspect: "4:5", theme: "navy", place: "bottom", brand: profile.brandColors });
  const up = await uploadImage(await canvasBlob(canvas), "thumbnail", "post-graphic");
  return { id: up.id, url: up.url, source: "graphic", aspect: "4:5", headline };
}

async function preparePost(item: PlanItem, api: AutopilotApi, ctx: { openings: string[]; headshots: string[] | null }) {
  let p = item.postId ? api.posts.find((x) => x.id === item.postId) : undefined;
  const kind = item.postKind ?? "image";
  if (!p) {
    p = api.addPost({ kind, topic: item.title, platforms: POST_PLATFORMS(kind), plannedFor: nineOn(item.date) });
    api.updatePlanItem(item.id, { postId: p.id, postKind: kind });
  }
  const platforms = p.platforms.length ? p.platforms : POST_PLATFORMS(p.kind);
  let copy = p.copy;
  let headline = p.graphicHeadline;
  let scene = p.imageIdea;
  if (!copy.length) {
    const out = await streamWrite({
      task: "post",
      profile: voiceProfileOf(api.profile),
      topic: item.title,
      kind: p.kind,
      platforms,
      others: ctx.openings.slice(-20),
      instruction: item.outline?.length ? `Cover these points: ${item.outline.join("; ")}` : undefined,
    });
    copy = out.posts.filter((c) => platforms.includes(c.platform)).map((c) => ({ platform: c.platform, text: c.text, hashtags: c.hashtags.map((h) => h.replace(/^#/, "")) }));
    if (!copy.length) throw new Error("No post came back.");
    if (copy[0]?.text) ctx.openings.push(copy[0].text.split("\n")[0].slice(0, 200));
    headline = out.imageHeadline?.trim() || headline;
    scene = out.imageScene || scene;
    api.updatePost(p.id, { copy, imageIdea: scene, graphicHeadline: headline, plannedFor: p.plannedFor ?? nineOn(item.date) });
  }
  if (p.kind === "image" && !p.image) {
    const img = await pictureFor(p, headline || headlineFrom(copy[0]?.text ?? "", item.title), scene, ctx.headshots, api.profile);
    api.updatePost(p.id, { image: img, images: [img] });
  }
}

async function writeScript(item: PlanItem, v: Video, api: AutopilotApi, openings: string[], n: number): Promise<Script> {
  if (v.script) return v.script;
  const out = await streamWrite({
    task: "script",
    profile: voiceProfileOf(api.profile),
    format: v.format,
    writer: WRITERS[n % WRITERS.length].id,
    idea: { title: item.title, outline: item.outline?.length ? item.outline : [item.title], angle: item.angle },
    otherOpenings: openings.slice(-30),
  });
  openings.push(out.hook.slice(0, 240));
  return { hook: out.hook, body: out.body, cta: out.cta };
}

/** A script cut to what an AI video can say, keeping whole sentences. */
async function condensed(item: PlanItem, v: Video, script: Script, api: AutopilotApi, maxWords: number) {
  const full = [script.hook, ...script.body, script.cta].map((l) => l.trim()).filter(Boolean).join(" ");
  if (countWords(full) <= maxWords) return full;
  const out = await streamWrite({
    task: "script",
    profile: voiceProfileOf(api.profile),
    format: v.format,
    idea: { title: item.title, outline: item.outline?.length ? item.outline : [item.title], angle: item.angle },
    current: script,
    maxWords: Math.max(20, maxWords - 5),
  });
  let short = [out.hook, ...out.body, out.cta].map((l) => l.trim()).filter(Boolean).join(" ");
  if (countWords(short) > maxWords) {
    const kept: string[] = [];
    for (const s of short.split(/(?<=[.!?])\s+/)) {
      if (countWords([...kept, s].join(" ")) > maxWords) break;
      kept.push(s);
    }
    short = kept.join(" ") || short.split(/\s+/).slice(0, maxWords).join(" ");
  }
  return short;
}

async function prepareVideo(item: PlanItem, api: AutopilotApi, opts: AutopilotOptions, ctx: { openings: string[]; n: number }) {
  let v = item.videoId ? api.videos.find((x) => x.id === item.videoId) : undefined;
  if (!v) {
    v = api.addVideo({ title: item.title, format: "short", stage: "script", outline: item.outline ?? [], subject: item.subject, angle: item.angle, ...(item.category ? { category: item.category } : {}) });
    api.updatePlanItem(item.id, { videoId: v.id });
  }
  const make = item.make ?? opts.make;
  api.updatePlanItem(item.id, { make });
  const script = await writeScript(item, v, api, ctx.openings, ctx.n);
  api.updateVideo(v.id, { script, runtimeSec: estimateRuntime(script), stage: "record" });
  if (make === "film") return;

  // An AI video: the script cut to fit, then made and queued for approval.
  const ai = opts.ai;
  if (!ai?.consent) throw new Error("AI videos need your consent first.");
  const headshotIds = api.profile.headshots.map((h) => mediaIdOf(h.url)).filter((x): x is string => !!x).slice(0, 3);
  if (!headshotIds.length) throw new Error("Add a headshot in Settings: the AI video is made from it.");
  const words = await condensed(item, v, script, api, ai.maxWords);
  const r = await fetch("/api/cinematic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headshotIds, script: words, settingId: ai.settingId, voiceId: ai.voiceId, aspect: v.format === "long" ? "16:9" : "9:16", aiLabel: ai.aiLabel, consent: true, videoId: v.id, autoApprove: true }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok || !j.job) throw new Error(j?.error ?? "The AI video couldn’t be started.");
  api.updatePlanItem(item.id, { aiJobId: j.job.id });
}

/** Get these items ready, two at a time. Safe to call again: finished work is skipped. */
export async function runAutopilot(items: PlanItem[], api: AutopilotApi, opts: AutopilotOptions) {
  if (progress.running) return;
  const todo = items.filter((i) => i.prep !== "done");
  if (!todo.length) return;
  emit({ running: true, total: todo.length, done: 0, failed: 0, current: undefined });
  const headshots = todo.some((i) => i.kind === "post") ? await aiImageReady(api.profile).catch(() => null) : null;
  const postOpenings = api.posts.filter((p) => p.copy[0]?.text).slice(0, 15).map((p) => p.copy[0].text.split("\n")[0].slice(0, 200));
  const scriptOpenings = api.videos.filter((v) => v.script?.hook).slice(0, 25).map((v) => v.script!.hook.slice(0, 240));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const n = next++;
      const item = todo[n];
      emit({ current: item.title });
      api.updatePlanItem(item.id, { prep: "working", prepError: undefined });
      try {
        if (item.kind === "post") await preparePost(item, api, { openings: postOpenings, headshots });
        else await prepareVideo(item, api, opts, { openings: scriptOpenings, n });
        api.updatePlanItem(item.id, { prep: "done" });
        emit({ done: progress.done + 1 });
      } catch (e) {
        api.updatePlanItem(item.id, { prep: "error", prepError: (e as Error).message.slice(0, 240) });
        emit({ done: progress.done + 1, failed: progress.failed + 1 });
      }
    }
  };
  await Promise.all([worker(), worker()]);
  emit({ running: false, current: undefined });
}

/** When an AI video is finished: it becomes the video's final cut, with captions written, ready to approve and post. */
export async function finishAiVideo(item: PlanItem, v: Video, job: { uploadId?: string; videoUrl?: string; durationSec?: number; aspect: "9:16" | "16:9" }, api: Pick<AutopilotApi, "profile" | "updateVideo">) {
  if (!job.uploadId || !job.videoUrl) return;
  api.updateVideo(v.id, {
    output: { id: job.uploadId, url: job.videoUrl, durationSec: job.durationSec ?? 0, aspect: job.aspect, renderedAt: new Date().toISOString() },
    outputUrl: job.videoUrl,
    stage: "post",
    runtimeSec: Math.round(job.durationSec ?? v.runtimeSec),
  });
  // Captions for the usual short-form platforms, so the Post step opens ready to go.
  try {
    const out = await streamWrite({ task: "captions", profile: voiceProfileOf(api.profile), writer: "story", platforms: VIDEO_PLATFORMS, video: { title: v.title, format: v.format, script: v.script, outline: v.outline } });
    const copies: PlatformCopy[] = out.captions.map((c) => ({ platform: c.platform, title: c.title ?? undefined, description: c.description, hashtags: c.hashtags, cta: "{{BOOKING_LINK}}" }));
    seedDraft(v.id, "post.platforms", VIDEO_PLATFORMS);
    seedDraft(v.id, "desc.copies", copies);
    seedDraft(v.id, "desc.versions", { story: { copies, taglines: out.taglines.slice(0, 3), note: out.note } });
    seedDraft(v.id, "desc.writer", "story");
    seedDraft(v.id, "desc.asked", true);
    seedDraft(v.id, "post.sub", 1);
  } catch (e) {
    console.warn("[plan] captions for the AI video weren’t written:", (e as Error).message);
  }
}
