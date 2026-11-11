"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { ProUpsell } from "@/components/shared/pro";
import { JobCard, NewVideo, NotSwitchedOn, useCinematic, useHeadshots, type Job } from "@/components/cinematic/cinematic-page";
import { useStore, voiceProfileOf } from "@/lib/store";
import { streamWrite } from "@/lib/ai/writer";
import { countWords } from "@/lib/cinematic/core";
import { peekDraft, seedDraft } from "@/lib/drafts";
import type { Script, Video } from "@/lib/types";

/**
 * The Record step's second way to make the video: no camera. The advisor's
 * photo, this video's script and a setting become a cinematic video of them
 * speaking it, which then goes on to Edit like any recorded take.
 */
export function CinematicOption({ video, script, onUse, using }: { video: Video; script: Script; onUse: (job: Job) => void; using?: boolean }) {
  const { profile } = useStore();
  const { config, jobs, patch, remove } = useCinematic();
  const { headshots, add } = useHeadshots();
  const mine = jobs.filter((j) => j.videoId === video.id);
  const full = [script.hook, ...script.body, script.cta].map((l) => l.trim()).filter(Boolean).join(" ");

  // The script is written for a camera take (a minute or more); a cinematic video is seconds.
  // The condensed version is kept with the video, so it's written once per script.
  const shorten = async (text: string, maxWords: number) => {
    const isFull = text.trim() === full;
    const saved = peekDraft<{ from: string; max: number; text: string }>(video.id, "cinematic.script");
    if (isFull && saved && saved.from === full && saved.max === maxWords) return saved.text;
    const out = await streamWrite({
      task: "script",
      profile: voiceProfileOf(profile),
      format: video.format,
      idea: { title: video.title, outline: video.outline.length ? video.outline : [video.title], angle: video.angle },
      current: isFull ? script : { hook: text, body: [], cta: "" },
      // A little under the limit, so a miscount still fits.
      maxWords: Math.max(20, maxWords - 5),
    });
    let short = [out.hook, ...out.body, out.cta].map((l) => l.trim()).filter(Boolean).join(" ");
    if (countWords(short) > maxWords) {
      // Still over: keep whole sentences from the top until the limit.
      const kept: string[] = [];
      for (const sentence of short.split(/(?<=[.!?])\s+/)) {
        if (countWords([...kept, sentence].join(" ")) > maxWords) break;
        kept.push(sentence);
      }
      short = kept.length ? kept.join(" ") : short.split(/\s+/).slice(0, maxWords).join(" ");
    }
    if (isFull) seedDraft(video.id, "cinematic.script", { from: full, max: maxWords, text: short });
    return short;
  };

  if (!config) return <div className="flex justify-center rounded-2xl border border-border bg-card p-10"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!config.pro) return <ProUpsell title="Cinematic video" body="Skip the camera. A photorealistic video of you speaking this script in a corner office, a library or a rooftop at golden hour, made from one headshot." />;
  if (!config.available) return <NotSwitchedOn canConfigure={config.canConfigure} />;

  return (
    <div className="space-y-5">
      {mine.map((j) => <JobCard key={j.id} job={j} onChange={patch} onRemove={() => remove(j.id)} onUse={onUse} using={using} />)}
      {mine.length > 0 && <h2 className="pt-2 font-serif text-xl">Make another version</h2>}
      <NewVideo
        key={video.id}
        config={config}
        headshots={headshots}
        onHeadshot={add}
        onCreated={patch}
        videoId={video.id}
        initialScript={full}
        initialAspect={video.format === "short" ? "9:16" : "16:9"}
        onShorten={shorten}
      />
      <p className="text-center text-[12px] text-muted-foreground">It takes a few minutes and carries on if you leave. Come back to this step to pick it up.</p>
    </div>
  );
}
