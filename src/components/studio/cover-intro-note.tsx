"use client";

import { Check, LoaderCircle, RotateCw, TriangleAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { useCoverIntro } from "./use-cover-intro";

type Intro = ReturnType<typeof useCoverIntro>;

/** The switch for starting the video on its cover. */
export function CoverIntroSwitch({ intro, className }: { intro: Intro; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3", className)}>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">Start the video on this cover</span>
        <span className="block text-[12px] leading-snug text-muted-foreground">Shown for the first half second, so it’s the thumbnail people see in the feed. No need to download it and add it yourself.</span>
      </span>
      <Switch checked={intro.on} onCheckedChange={intro.setOn} aria-label="Start the video on this cover" />
    </label>
  );
}

/** One line on where things stand: adding, added, or what went wrong. */
export function CoverIntroStatus({ intro, className }: { intro: Intro; className?: string }) {
  if (!intro.available || !intro.on) return null;
  return (
    <p className={cn("flex items-center justify-center gap-1.5 text-[12px]", intro.error ? "text-destructive" : "text-muted-foreground", className)} aria-live="polite">
      {intro.busy ? (
        <><LoaderCircle className="size-3.5 animate-spin" /> Adding your cover to the start…</>
      ) : intro.error ? (
        <>
          <TriangleAlert className="size-3.5" /> {intro.error}
          <button type="button" onClick={intro.retry} className="ml-1 inline-flex cursor-pointer items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"><RotateCw className="size-3" /> Try again</button>
        </>
      ) : intro.added ? (
        <><Check className="size-3.5 text-primary" /> Starts on your cover</>
      ) : null}
    </p>
  );
}
