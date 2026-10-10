"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, Film, Scissors, Smartphone, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page";
import { cn, fmtDuration } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { composeCaption } from "@/lib/compose";
import type { PlatformCopy } from "@/lib/ai/content";
import type { PlatformId, Video } from "@/lib/types";
import { PhonePreview } from "../phone-preview";
import type { StepProps } from "../studio-view";

export const fileSlug = (title: string) => title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "video";

/** Download link for the rendered MP4, named after the video. */
export const downloadUrl = (v: Video) => (v.output ? `${v.output.url}?download=${encodeURIComponent(fileSlug(v.title))}` : undefined);

const fmtSize = (b?: number) => (b ? (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(0.1, b / 1e6).toFixed(1)} MB`) : "");

/** The caption a feed would show: the vertical platforms' first, else the title. */
export function feedCaption(copies: PlatformCopy[], profile: Parameters<typeof composeCaption>[2], title: string) {
  const order: PlatformId[] = ["tiktok", "instagram", "youtube_shorts", "facebook", "linkedin", "youtube", "x"];
  const c = order.map((p) => copies.find((x) => x.platform === p)).find(Boolean);
  return c ? composeCaption(c, c.platform, profile) : title;
}

export function ReviewStep({ video, complete }: StepProps) {
  const { profile } = useStore();
  const [copies] = useDraft<PlatformCopy[]>(video.id, "desc.copies", []);
  const out = video.output;
  const [view, setView] = React.useState<"phone" | "full">(out?.aspect === "16:9" ? "full" : "phone");
  if (!out) {
    return (
      <div className="py-16">
        <EmptyState
          icon={Film}
          title="Nothing rendered yet"
          description="Finish the edit and your final video shows up here to watch and download."
          action={<Button asChild className="rounded-full"><Link href={`/studio/${video.id}/edit`}><Scissors /> Go to Edit</Link></Button>}
        />
      </div>
    );
  }
  const vertical = out.aspect === "9:16";
  const [w, h] = vertical ? [1080, 1920] : [1920, 1080];

  return (
    <div className="mx-auto max-w-[1100px] space-y-8 pb-16">
      <div className="text-center">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">Watch it once.</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">This is the exact file that goes out: your cuts, captions and titles, with the audio cleaned up.</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="How to show it">
              {([["phone", Smartphone, "On a phone"], ["full", Square, "Full size"]] as const).map(([k, Icon, l]) => (
                <button key={k} onClick={() => setView(k)} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] transition-colors", view === k ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  <Icon className="size-3.5" /> {l}
                </button>
              ))}
            </div>
          </div>
          {view === "phone" ? (
            <div className="flex justify-center rounded-2xl bg-gradient-to-b from-muted/70 to-muted/20 px-4 py-8">
              <PhonePreview key={out.id} src={out.url} aspect={out.aspect} seed={video.id} name={profile.name} avatar={profile.headshots.find((x) => x.url)?.url} caption={feedCaption(copies, profile, video.title)} />
            </div>
          ) : (
            <div className="flex justify-center rounded-2xl bg-[#06101F] p-4 sm:p-6">
              <video
                key={out.id}
                src={out.url}
                controls
                playsInline
                preload="metadata"
                className={vertical ? "h-[min(64vh,720px)] w-auto rounded-lg bg-black" : "w-full rounded-lg bg-black"}
                style={{ aspectRatio: `${w}/${h}` }}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="eyebrow">Final video</div>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[
                ["Length", fmtDuration(out.durationSec)],
                ["Size", `${w}×${h} · ${vertical ? "9:16" : "16:9"}`],
                ["File", `MP4 (H.264)${out.sizeBytes ? ` · ${fmtSize(out.sizeBytes)}` : ""}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="tnum">{v}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="outline" className="mt-5 w-full rounded-full">
              <a href={downloadUrl(video)} download>
                <Download /> Download MP4
              </a>
            </Button>
          </div>

          <Button className="w-full rounded-full" size="lg" onClick={() => complete()}>
            Looks good <ArrowRight />
          </Button>
          <Button variant="ghost" className="w-full rounded-full" asChild>
            <Link href={`/studio/${video.id}/edit`}><ArrowLeft /> Make changes</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
