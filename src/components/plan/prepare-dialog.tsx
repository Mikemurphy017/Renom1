"use client";

import * as React from "react";
import { Camera, Clapperboard, Image as ImageIcon, LoaderCircle, PenLine, ShieldCheck, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProBadge } from "@/components/shared/pro";
import { SETTINGS, VOICES } from "@/lib/cinematic/core";
import type { AutopilotOptions } from "@/lib/autopilot";
import type { PostKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One question before Renom does the month: how the videos are made (filmed
 * by the advisor, or AI videos), and what kind of posts. Everything else is
 * written, pictured and queued for them.
 */

interface CinematicConfig {
  available: boolean;
  pro: boolean;
  limits: { maxWords: number };
  consentText: string;
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
  const [cfg, setCfg] = React.useState<CinematicConfig | null>(null);
  const [settingId, setSettingId] = React.useState(SETTINGS[0].id);
  const [voiceId, setVoiceId] = React.useState<string>(VOICES[0].id);
  const [consent, setConsent] = React.useState(false);
  const [aiLabel, setAiLabel] = React.useState(false);

  React.useEffect(() => {
    if (!open || cfg) return;
    fetch("/api/cinematic", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j?.ok && setCfg({ available: j.available, pro: j.pro, limits: j.limits, consentText: j.consentText }))
      .catch(() => {});
  }, [open, cfg]);

  const aiOk = !!cfg?.pro && !!cfg.available;
  const ready = make === "film" || (aiOk && consent);
  const go = () => onGo({ make, postKind, ai: make === "ai" && cfg ? { settingId, voiceId, consent, aiLabel, maxWords: cfg.limits.maxWords } : undefined });

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
                    ["ai", Clapperboard, "Make AI videos", "We write a short script and make the video of you. You approve it, with its post.", !aiOk],
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
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">{id === "ai" && cfg && cfg.pro && !cfg.available ? "AI videos aren’t switched on for this studio yet." : body}</span>
                    </span>
                  </button>
                ))}
              </div>

              {make === "ai" && aiOk && cfg && (
                <div className="mt-3 space-y-3 rounded-xl border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={settingId} onValueChange={setSettingId}>
                      <SelectTrigger aria-label="Setting"><SelectValue /></SelectTrigger>
                      <SelectContent>{SETTINGS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={voiceId} onValueChange={setVoiceId}>
                      <SelectTrigger aria-label="Voice"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-[12px] text-muted-foreground">Scripts are cut to {cfg.limits.maxWords} words (about {Math.round(cfg.limits.maxWords / 2.5)} seconds) so they fit an AI video. Made from your first headshot.</p>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                    <span>{cfg.consentText}</span>
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
                    <span>Add an “AI-generated” label</span>
                    <Switch checked={aiLabel} onCheckedChange={setAiLabel} />
                  </label>
                  <p className="flex items-start gap-2 text-[12px] text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> Nothing posts until you approve it.</p>
                </div>
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
