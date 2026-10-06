"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, Film, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page";
import { fmtDuration } from "@/lib/utils";
import type { Video } from "@/lib/types";
import type { StepProps } from "../studio-view";

export const fileSlug = (title: string) => title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "video";

/** Download link for the rendered MP4, named after the video. */
export const downloadUrl = (v: Video) => (v.output ? `${v.output.url}?download=${encodeURIComponent(fileSlug(v.title))}` : undefined);

const fmtSize = (b?: number) => (b ? (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(0.1, b / 1e6).toFixed(1)} MB`) : "");

export function ReviewStep({ video, complete }: StepProps) {
  const out = video.output;
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
