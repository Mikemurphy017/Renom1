"use client";

import * as React from "react";
import Link from "next/link";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProBadge } from "@/components/shared/pro";
import { useVoiceStatus } from "@/components/settings/ai-voice";
import { usePro, useStore } from "@/lib/store";
import type { StoredTake } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Make the take without filming: the script in the advisor's AI voice over
 * their photos (AI photo set and headshots). The result goes to the AI edit
 * like any other take.
 */

const MAX = 6;
const mediaIdOf = (url?: string) => /\/api\/media\/([A-Za-z0-9_-]+)/.exec(url ?? "")?.[1];

export function AvatarDialog({ open, onOpenChange, videoId, text, vertical, onTake }: { open: boolean; onOpenChange: (v: boolean) => void; videoId: string; text: string; vertical: boolean; onTake: (take: StoredTake) => void }) {
  const { profile } = useStore();
  const { isPro } = usePro();
  const { status } = useVoiceStatus();
  const photos = React.useMemo(() => {
    const out: { id: string; url: string; label: string }[] = [];
    for (const p of profile.photoSet ?? []) if (p.url && p.id) out.push({ id: p.id, url: p.url, label: p.label });
    for (const h of profile.headshots) {
      const id = mediaIdOf(h.url);
      if (h.url && id && !out.some((o) => o.id === id)) out.push({ id, url: h.url, label: h.label || "Headshot" });
    }
    return out;
  }, [profile.photoSet, profile.headshots]);
  const [picked, setPicked] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (open && !picked.length) setPicked(photos.slice(0, 4).map((p) => p.id));
  }, [open, photos, picked.length]);
  const [making, setMaking] = React.useState(false);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const estSec = Math.round((words / 150) * 60);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));

  const make = async () => {
    setMaking(true);
    try {
      const r = await fetch("/api/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, photoIds: picked, vertical, videoId }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; take?: StoredTake } | null;
      if (!r.ok || !j?.ok || !j.take) throw new Error(j?.error ?? "Couldn’t make the avatar video.");
      onOpenChange(false);
      onTake(j.take);
      toast.success("Your avatar video is ready", { description: "The AI edit is adding captions and graphics now." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMaking(false);
    }
  };

  let body: React.ReactNode;
  if (!isPro)
    body = (
      <div className="rounded-xl border border-primary/30 bg-brass-soft/50 p-4 text-[13px]">
        <div className="flex items-center gap-1.5 font-medium">AI avatar videos are part of Pro <ProBadge /></div>
        <p className="mt-1 text-muted-foreground">Turn any script into a video of your photos with your own AI voice narrating. <Link href="/billing" className="text-primary underline underline-offset-2">See plans</Link></p>
      </div>
    );
  else if (!status) body = <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Checking your AI voice…</div>;
  else if (!status.configured) body = <p className="text-[13px] text-muted-foreground">AI voice isn’t switched on for this studio yet. Your administrator can turn it on.</p>;
  else if (!status.voice)
    body = (
      <div className="rounded-xl border border-border bg-card p-4 text-[13px]">
        <div className="font-medium">First, create your AI voice</div>
        <p className="mt-1 text-muted-foreground">Read a short passage out loud once (about 90 seconds) and your AI voice can read every script after that.</p>
        <Button asChild size="sm" className="mt-3"><Link href="/settings#ai-voice">Create my AI voice</Link></Button>
      </div>
    );
  else if (!photos.length)
    body = (
      <div className="rounded-xl border border-border bg-card p-4 text-[13px]">
        <div className="font-medium">Add photos of you first</div>
        <p className="mt-1 text-muted-foreground">Upload 2–4 headshots, or make your AI photo set; the avatar video moves through them as your voice reads.</p>
        <Button asChild size="sm" className="mt-3"><Link href="/settings#covers">Add photos</Link></Button>
      </div>
    );
  else
    body = (
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-[13px] font-medium">Pick the photos <span className="text-[12px] font-normal text-muted-foreground">{picked.length} of up to {MAX}</span></div>
          <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {photos.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggle(p.id)} disabled={making} className={cn("relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg border-2 transition", on ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")} aria-pressed={on} title={p.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} className="size-full object-cover" loading="lazy" />
                  {on && <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg bg-muted/60 p-3 text-[12px] text-muted-foreground">
          Your AI voice reads this video’s script ({words} words, about {Math.max(1, Math.round(estSec / 60))} min). Each photo holds for a few seconds with a slow zoom, then the AI edit adds your captions, graphics and cover. {vertical ? "Vertical (9:16)." : "Wide (16:9)."}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={make} disabled={making || !picked.length || words < 5}>{making ? <><LoaderCircle className="animate-spin" /> Making your video…</> : <><Sparkles /> Make the video</>}</Button>
          {making && <span className="text-[12px] text-muted-foreground">This takes a minute or two. Keep this tab open.</span>}
        </div>
      </div>
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !making && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Make it with your AI avatar</DialogTitle>
          <DialogDescription>No camera needed: your photos, your voice, your script.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
