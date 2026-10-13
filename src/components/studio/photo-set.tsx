"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own photos */
import * as React from "react";
import { ArrowRight, Camera, ImageOff, LoaderCircle, RefreshCw, Sparkles, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeadshotPicker } from "@/components/settings/headshot-picker";
import { PHOTO_LOOKS, usePhotoSet } from "@/lib/photo-set";
import type { CoverPhotos } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Whether the studio can make AI photos (a Gemini key is set). Null while checking. */
export function useAiPhotosAvailable() {
  const [ok, setOk] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    fetch("/api/covers/clone")
      .then((r) => r.json())
      .then((j) => setOk(!!j.configured))
      .catch(() => setOk(false));
  }, []);
  return ok;
}

const STYLES: { id: CoverPhotos; title: string; body: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "ai", title: "AI photo set", body: "Gemini turns your headshots into a set of photos of you (smiling, surprised, concerned; different outfits and settings) and the covers are built from them.", icon: Sparkles },
  { id: "real", title: "Real photos only", body: "Frames from your video and the headshots you upload. No AI-made pictures of you.", icon: Camera },
  { id: "none", title: "No photo", body: "Your words, colors and graphics only. A clean, institutional look with no face on the cover.", icon: Type },
];

/** First visit to covers: which kind of picture goes on them. */
export function CoverStyleChooser({ onPick, aiAvailable }: { onPick: (m: CoverPhotos) => void; aiAvailable: boolean | null }) {
  return (
    <div className="mx-auto max-w-[860px] space-y-5">
      <div className="text-center">
        <h2 className="font-serif text-2xl">What goes on your covers?</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-[14px] text-muted-foreground">Pick once; you can change it any time here or in Settings.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {STYLES.map((s) => {
          const off = s.id === "ai" && aiAvailable === false;
          return (
            <button
              key={s.id}
              type="button"
              disabled={off}
              onClick={() => onPick(s.id)}
              className={cn("group flex cursor-pointer flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0")}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brass-soft text-primary"><s.icon className="size-5" /></span>
              <span className="mt-3 flex items-center gap-2 text-[15px] font-medium">
                {s.title}
                {s.id === "ai" && !off && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">Most clicks</span>}
              </span>
              <span className="mt-1 flex-1 text-[13px] leading-snug text-muted-foreground">{off ? "Not set up for this studio yet (it needs a Gemini key)." : s.body}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-disabled:hidden">Use this <ArrowRight className="size-3.5" /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The small switch above the covers. */
export function CoverStyleSwitch({ value, onChange, aiAvailable, onManage }: { value: CoverPhotos; onChange: (m: CoverPhotos) => void; aiAvailable: boolean | null; onManage?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="What goes on the covers">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.id === "ai" && aiAvailable === false}
            onClick={() => onChange(s.id)}
            aria-pressed={value === s.id}
            className={cn("flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40", value === s.id ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <s.icon className="size-3.5" /> {s.title}
          </button>
        ))}
      </div>
      {value === "ai" && onManage && (
        <Button variant="ghost" size="sm" className="rounded-full text-[12px]" onClick={onManage}>Manage photo set</Button>
      )}
    </div>
  );
}

/**
 * The AI photo set: headshots in, one photo per look out. Used as its own
 * step before the covers, and in Settings.
 */
export function PhotoSetPanel({ onContinue, onSkip, compact }: { onContinue?: () => void; onSkip?: () => void; compact?: boolean }) {
  const ps = usePhotoSet();
  const byLook = new Map(ps.photos.map((p) => [p.look, p]));
  const missing = PHOTO_LOOKS.filter((l) => !byLook.has(l.id)).map((l) => l.id);
  const done = ps.photos.length;
  return (
    <div className={cn("space-y-5", !compact && "mx-auto max-w-[960px] rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7")}>
      {!compact && (
        <div>
          <div className="eyebrow">Before your covers</div>
          <h2 className="mt-1 font-serif text-2xl">Your AI photo set</h2>
          <p className="mt-1.5 max-w-2xl text-[14px] text-muted-foreground">
            Gemini makes {PHOTO_LOOKS.length} new photos of you from your headshots: different expressions, outfits and settings, so every cover doesn’t use the same picture. You make the set once and every video uses it.
          </p>
        </div>
      )}

      <div>
        <div className="mb-2 text-[13px] font-medium">Your headshots <span className="font-normal text-muted-foreground">· {ps.headshots.length ? `using ${ps.headshots.length}` : "add at least one"}; 3–4 from different angles work best</span></div>
        <HeadshotPicker compact />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PHOTO_LOOKS.map((l) => {
          const p = byLook.get(l.id);
          const making = ps.pending.includes(l.id);
          return (
            <div key={l.id} className="group relative">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-muted/60">
                {p && <img src={p.url} alt={l.label} className={cn("absolute inset-0 h-full w-full object-cover", making && "opacity-40")} />}
                {making ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12px] text-muted-foreground"><LoaderCircle className="size-5 animate-spin text-primary" /> Making…</span>
                ) : !p ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center text-[12px] text-muted-foreground"><ImageOff className="size-5 opacity-60" /> Not made yet</span>
                ) : null}
                {p && !making && (
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    <button type="button" onClick={() => ps.make([l.id])} disabled={ps.busy} className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white backdrop-blur disabled:opacity-50" aria-label={`Remake ${l.label}`} title="Make a new one"><RefreshCw className="size-3.5" /></button>
                    <button type="button" onClick={() => ps.remove(p.id)} className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white backdrop-blur" aria-label={`Remove ${l.label}`} title="Remove"><X className="size-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="mt-1.5 truncate px-0.5 text-[12px] text-muted-foreground">{l.label}</div>
            </div>
          );
        })}
      </div>

      {ps.error && <p className="text-[13px] text-destructive">{ps.error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">AI-made: check that each one looks like you before it goes on a cover. Remove any that don’t.</p>
        <div className="flex flex-wrap items-center gap-2">
          {onSkip && <Button variant="ghost" className="rounded-full" onClick={onSkip}>Use real photos instead</Button>}
          <Button variant={done && !missing.length ? "outline" : "default"} className="rounded-full" disabled={ps.busy || !ps.headshots.length} onClick={() => ps.make(missing.length ? missing : undefined)}>
            {ps.busy ? <><LoaderCircle className="animate-spin" /> Making {ps.pending.length} photo{ps.pending.length === 1 ? "" : "s"}…</> : !done ? <><Sparkles /> Make my photo set</> : missing.length ? <><Sparkles /> Make the other {missing.length}</> : <><RefreshCw /> Remake all</>}
          </Button>
          {onContinue && (
            <Button className="rounded-full" disabled={!done} onClick={onContinue}>
              Build my covers <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
