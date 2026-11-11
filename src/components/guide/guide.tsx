"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/layout/shell-context";
import { useStore } from "@/lib/store";
import { useSocialStatus } from "@/lib/social/use-social";
import type { StageId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Guidance for new advisors: a getting-started checklist on Home, the trial
 * in a slim banner, and a one-time tip on each studio step. What's dismissed
 * is remembered on this browser.
 */

const KEY = "renom.guide.v1";
function useDismissed() {
  const [set, setSet] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    try {
      setSet(new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]")));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const dismiss = React.useCallback((id: string) => {
    setSet((s) => {
      const next = new Set(s).add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  return [set, dismiss] as const;
}

// ── Getting started (Home) ──

export function GettingStarted() {
  const { videos, profile, plan } = useStore();
  const { openNewVideo } = useShell();
  const { status } = useSocialStatus();
  const [dismissed, dismiss] = useDismissed();
  const steps = [
    { id: "voice", title: "Tell us how you sound", body: "Your voice, who you serve and what you believe. Every script starts here.", done: !!profile.niche || !!profile.idealClient, href: "/settings#voice", cta: "Review your voice" },
    { id: "photos", title: "Add 2–4 headshots", body: "They go on your covers and make your AI photo set.", done: profile.headshots.some((h) => h.url), href: "/settings#covers", cta: "Add headshots" },
    { id: "plan", title: "Set your goal and plan the month", body: "Choose how many videos go out each week; Renom lines up a topic for every slot and keeps you on pace.", done: !!profile.goals && plan.length > 0, href: "/plan?goals=1", cta: "Plan my month" },
    { id: "video", title: "Start your first video", body: "Pick an idea; Renom writes the script in your voice. Or upload a video you’ve already made.", done: videos.length > 0, action: openNewVideo, cta: "Start a video" },
    { id: "record", title: "Record it", body: "Read from the teleprompter in your browser. Run the 5-second sound check first.", done: videos.some((v) => v.take), href: videos[0] ? `/studio/${videos[0].id}/record` : undefined, cta: "Go to Record" },
    { id: "edit", title: "Finish your first edit", body: "The AI cuts the pauses, adds captions and cleans up your sound. You pick the look.", done: videos.some((v) => v.output), href: videos.find((v) => v.take) ? `/studio/${videos.find((v) => v.take)!.id}/edit` : undefined, cta: "Go to Edit" },
    { id: "buffer", title: "Connect your channels", body: "Link your Buffer once to post to LinkedIn, Instagram, YouTube and more from Renom.", done: !!status?.connected, href: "/settings#publishing", cta: "Connect" },
    { id: "post", title: "Post your first video", body: "Captions for every platform, your disclosure added automatically.", done: videos.some((v) => v.status === "published" || v.status === "scheduled"), href: videos.find((v) => v.output) ? `/studio/${videos.find((v) => v.output)!.id}/post` : undefined, cta: "Go to Post" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (dismissed.has("checklist") || done === steps.length) return null;
  const next = steps.find((s) => !s.done);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Getting started</div>
          <h2 className="mt-1 font-serif text-[24px] leading-tight">Your first video, step by step</h2>
        </div>
        <button type="button" onClick={() => dismiss("checklist")} className="cursor-pointer rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Hide getting started"><X className="size-4" /></button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
        <span className="text-[12px] text-muted-foreground tnum">{done} of {steps.length}</span>
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((s) => {
          const isNext = s === next;
          return (
            <li key={s.id} className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5", isNext && "bg-brass-soft/60")}>
              <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", s.done ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{s.done && <Check className="size-3" />}</span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-[14px] font-medium", s.done && "text-muted-foreground line-through decoration-1")}>{s.title}</div>
                {isNext && <p className="mt-0.5 text-[13px] text-muted-foreground">{s.body}</p>}
              </div>
              {isNext && (s.action ? (
                <Button size="sm" className="shrink-0 rounded-full" onClick={s.action}>{s.cta} <ArrowRight /></Button>
              ) : s.href ? (
                <Button size="sm" className="shrink-0 rounded-full" asChild><Link href={s.href}>{s.cta} <ArrowRight /></Link></Button>
              ) : null)}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── Trial banner (every page while trialing) ──

export function TrialBanner() {
  const { account } = useStore();
  const b = account?.billing;
  // Not until the trial is really running (a card on file).
  if (!b?.trialing || !b.active) return null;
  const days = b.trialEnd ? Math.max(0, Math.ceil((Date.parse(b.trialEnd) - Date.now()) / 86400_000)) : null;
  const left = Math.max(0, b.trialVideos - b.trialVideosUsed);
  return (
    <div className="border-b border-primary/15 bg-brass-soft/70 px-4 py-2 text-center text-[13px]">
      <span className="font-medium">Free trial</span>
      {days !== null && <> · {days === 0 ? "ends today" : `${days} day${days === 1 ? "" : "s"} left`}</>}
      {" · "}{left === 0 ? "all trial videos used" : `${left} of ${b.trialVideos} videos left`}
      {" · "}<Link href="/billing" className="font-medium text-primary underline underline-offset-2">{left === 0 ? "Start your plan to keep going" : "See your plan"}</Link>
    </div>
  );
}

// ── One-time tips on each studio step ──

const TIPS: Partial<Record<StageId, { title: string; body: string }>> = {
  idea: { title: "Start with one sentence", body: "Type what you want to talk about, or tap a subject for fresh angles. Already have a video? Upload it from Home and skip straight to editing." },
  script: { title: "Four writers, four versions", body: "Each version takes a different approach. Pick the one that sounds most like you, then ask for changes in plain words." },
  record: { title: "Look at the line, not the words", body: "Use “Close to camera” to put the script right under your webcam, and run the 5-second sound check before your first take." },
  edit: { title: "The AI did the first pass", body: "Pauses and retakes are already cut. Trim anything else in the transcript, pick a look, then render." },
  review: { title: "Watch it once", body: "This is the finished video. If something’s off, go back to Edit; nothing is posted until you say so." },
  post: { title: "Captions for every platform", body: "Pick a version for each network. Your disclosure and booking link are added automatically." },
};

export function StepTip({ step }: { step: StageId }) {
  const [dismissed, dismiss] = useDismissed();
  const tip = TIPS[step];
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  if (!tip || !ready || dismissed.has(`tip:${step}`) || dismissed.has("tips")) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-brass-soft/50 px-4 py-3">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-[13px]">
        <span className="font-medium">{tip.title}.</span> <span className="text-muted-foreground">{tip.body}</span>
        <button type="button" onClick={() => dismiss("tips")} className="ml-2 cursor-pointer text-[12px] text-muted-foreground underline-offset-2 hover:underline">Turn off tips</button>
      </div>
      <button type="button" onClick={() => dismiss(`tip:${step}`)} className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Got it"><X className="size-3.5" /></button>
    </div>
  );
}
