"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, Clapperboard, Image as ImageIcon, LoaderCircle, PenLine, ShieldCheck, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProBadge } from "@/components/shared/pro";
import type { AutopilotOptions } from "@/lib/autopilot";
import type { PostKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One question before Renom does the month: how the videos are made (filmed
 * by the advisor, or AI videos), and what kind of posts. Everything else is
 * written, pictured and queued for them.
 */

interface AiConfig {
  available: boolean;
  pro: boolean;
  twinReady: boolean;
  limits: { maxWords: number };
}

export interface PrepareChoice extends AutopilotOptions {
  postKind: PostKind;
}

export function PrepareDialog({
  open,
  onOpenChange,
  videos,
  posts,
  title,
  description,
  busy,
  onGo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  videos: number;
  posts: number;
  title: string;
  description: string;
  busy?: boolean;
  onGo: (c: PrepareChoice) => void;
}) {
  const [make, setMake] = React.useState<"film" | "ai">("film");
  const [postKind, setPostKind] = React.useState<PostKind>("image");
  const [cfg, setCfg] = React.useState<AiConfig | null>(null);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/aivideo", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j?.ok && setCfg({ available: j.available, pro: j.pro, twinReady: j.twinReady, limits: j.limits }))
      .catch(() => {});
  }, [open]);

  const aiOk = !!cfg?.pro && !!cfg.available && cfg.twinReady;
  const ready = make === "film" || aiOk;
  const go = () => onGo({ make, postKind, ai: make === "ai" && cfg ? { maxWords: cfg.limits.maxWords } : undefined });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {videos > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-medium">How should we make your {videos === 1 ? "video" : `${videos} videos`}?</div>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How the videos are made">
                {(
                  [
                    ["film", Camera, "I’ll film them", "We write every script. On the day, open the studio and read it from the teleprompter.", false],
                    ["ai", Clapperboard, "Make AI videos", "We write the script and your AI twin films it, in your voice. You approve it, with its post.", !aiOk],
                  ] as const
                ).map(([id, Icon, label, body, off]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={make === id}
                    disabled={off}
                    onClick={() => setMake(id)}
                    className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition", make === id ? "border-primary bg-brass-soft/50" : "border-border hover:bg-muted/50", off ? "cursor-not-allowed opacity-50" : "cursor-pointer")}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", make === id ? "text-primary" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold">{label} {id === "ai" && cfg && !cfg.pro && <ProBadge />}</span>
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">{id === "ai" && cfg && cfg.pro && !cfg.available ? "AI videos aren’t switched on for this studio yet." : id === "ai" && cfg && cfg.pro && !cfg.twinReady ? <>Set up your AI twin first: <Link href="/settings#ai-twin" className="text-primary underline underline-offset-2">Settings → Your AI twin</Link>.</> : body}</span>
                    </span>
                  </button>
                ))}
              </div>

              {make === "ai" && aiOk && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-border p-3 text-[12px] text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> Made with your AI twin, in your voice. Each one costs a little to make; nothing posts until you approve it.</p>
              )}
            </div>
          )}

          {posts > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-medium">Your {posts === 1 ? "post" : `${posts} posts`}</div>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Kind of post">
                {(
                  [
                    ["image", ImageIcon, "Text + picture", "Written in your voice, with one picture: an AI photo of you, or a headline graphic."],
                    ["text", Type, "Text only", "Written in your voice, no picture."],
                  ] as const
                ).map(([id, Icon, label, body]) => (
                  <button key={id} type="button" role="radio" aria-checked={postKind === id} onClick={() => setPostKind(id)} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition", postKind === id ? "border-primary bg-brass-soft/50" : "border-border hover:bg-muted/50")}>
                    <Icon className={cn("mt-0.5 size-4 shrink-0", postKind === id ? "text-primary" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold">{label}</span>
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">{body}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-muted/50 p-3 text-[12px] text-muted-foreground">
            <PenLine className="mr-1.5 inline size-3.5 align-[-2px]" />
            Each one lands on your calendar ready: posts to review and post, {make === "ai" ? "AI videos to approve with their captions" : "videos scripted for the day you film"}. It takes a few minutes and keeps going while you use the app.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="rounded-full px-5" onClick={go} disabled={!ready || busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Get it ready</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
