"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, CircleCheck, Copy, Download, Film, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useStore } from "@/lib/store";
import { activeDisclosure, composeCaption } from "@/lib/compose";
import { getPlatform } from "@/lib/mock/platforms";
import type { PlatformCopy } from "@/lib/ai/content";
import type { PlatformId, Video } from "@/lib/types";
import { cn, fmtDuration, fmtNumber } from "@/lib/utils";
import { downloadUrl, fileSlug } from "./review-step";

/** The square copy button: copies, flashes a check. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success(`${label} copied`);
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast.error("Couldn’t copy", { description: "Select the text and copy it instead." });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      disabled={!text}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className={cn(
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:cursor-default disabled:opacity-40",
        done ? "border-success/40 bg-success-soft text-success" : "border-border bg-background hover:border-primary/50 hover:text-primary",
        className
      )}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

/** Everything needed to post by hand (or attach in Buffer): the MP4, the covers, and each caption. */
export function ShareKit({ video, platforms, copies }: { video: Video; platforms: PlatformId[]; copies: PlatformCopy[] }) {
  const { updateVideo, profile } = useStore();
  const [posted, setPosted] = React.useState(false);
  const out = video.output;
  const slug = fileSlug(video.title);
  const captionFor = (p: PlatformId) => {
    const c = copies.find((x) => x.platform === p);
    return c ? composeCaption(c, p, profile) : "";
  };

  const markPosted = () => {
    const at = new Date().toISOString();
    updateVideo(video.id, {
      platforms,
      status: "published",
      publishedAt: at,
      posts: [
        ...(video.posts ?? []),
        ...platforms.map((p) => ({ platform: p, channel: "Posted manually", caption: captionFor(p), disclosureVersion: activeDisclosure(profile)?.version ?? "none", at, how: "manual" as const })),
      ],
    });
    setPosted(true);
    toast.success("Marked as posted", { description: "The captions and disclosure are in your archive." });
  };

  return (
    <div className="space-y-6">
      {/* The file */}
      <div className="grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex justify-center rounded-xl bg-[#06101F] p-2">
          {out ? (
            <video src={out.url} controls playsInline preload="metadata" className={cn("rounded-md bg-black", out.aspect === "9:16" ? "h-56 w-auto" : "h-40 w-auto")} style={{ aspectRatio: out.aspect === "9:16" ? "9/16" : "16/9" }} />
          ) : (
            <div className="flex h-40 w-28 items-center justify-center text-white/50"><Film className="size-6" /></div>
          )}
        </div>
        <div>
          <div className="eyebrow">Your video</div>
          {out ? (
            <>
              <h3 className="mt-1 font-serif text-xl">{video.title}</h3>
              <p className="mt-1 text-[13px] text-muted-foreground tnum">MP4 · {out.aspect} · {fmtDuration(out.durationSec)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="rounded-full px-5">
                  <a href={downloadUrl(video)} download><Download /> Download MP4</a>
                </Button>
                {(["short", "long"] as const).map((shape) =>
                  video.covers?.[shape] ? (
                    <Button key={shape} asChild variant="outline" className="rounded-full">
                      <a href={video.covers[shape]!.url} download={`${slug}-cover-${shape === "short" ? "9x16" : "16x9"}.jpg`}>
                        <ImageDown /> Cover {shape === "short" ? "9:16" : "16:9"}
                      </a>
                    </Button>
                  ) : null
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-1 font-serif text-xl">Not rendered yet</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">Finish the edit to get a downloadable MP4.</p>
              <Button asChild variant="outline" className="mt-4 rounded-full"><Link href={`/studio/${video.id}/edit`}>Go to Edit</Link></Button>
            </>
          )}
        </div>
      </div>

      {/* The words */}
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Captions</div>
            <p className="mt-1 text-[13px] text-muted-foreground">Disclosure and hashtags included. Copy, paste, attach the MP4.</p>
          </div>
        </div>
        {platforms.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-[13px] text-muted-foreground">Pick platforms in the Caption step.</p>}
        {platforms.map((p) => {
          const pl = getPlatform(p);
          const text = captionFor(p);
          const title = copies.find((x) => x.platform === p)?.title;
          return (
            <div key={p} className="rounded-2xl border border-border bg-card p-4 shadow-soft" style={{ ["--pi-bg" as string]: "var(--card)" }}>
              <div className="flex items-center gap-3">
                <PlatformIcon id={p} className="size-4" />
                <span className="flex-1 text-[14px] font-medium">{pl.label}</span>
                <span className={cn("text-[11px] tnum", text.length > pl.descLimit ? "text-destructive" : "text-muted-foreground")}>{fmtNumber(text.length)} / {fmtNumber(pl.descLimit)}</span>
                <CopyButton text={text} label={`${pl.label} caption`} />
              </div>
              {title && pl.titleLimit ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Title</span>
                  <span className="flex-1 truncate text-[13px]">{title}</span>
                  <CopyButton text={title} label={`${pl.label} title`} className="size-7" />
                </div>
              ) : null}
              {text ? (
                <p className="scrollbar-thin mt-3 max-h-48 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-line text-foreground/85">{text}</p>
              ) : (
                <p className="mt-3 text-[13px] text-muted-foreground">No caption for {pl.label} yet. Write it in the Caption step.</p>
              )}
            </div>
          );
        })}
      </div>

      {posted ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft"><CircleCheck className="size-6 text-success" /></motion.div>
          <h2 className="mt-4 font-serif text-2xl">That&rsquo;s it. You&rsquo;re done.</h2>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" className="rounded-full" asChild><Link href="/approve">See the archive</Link></Button>
            <Button className="rounded-full" asChild><Link href="/">Home</Link></Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-5 py-4">
          <p className="text-[13px] text-muted-foreground">Posted it yourself? Keep the record: the exact caption and disclosure go in your archive.</p>
          <Button variant="outline" className="rounded-full" onClick={markPosted} disabled={!platforms.length}>I posted it</Button>
        </div>
      )}
    </div>
  );
}
