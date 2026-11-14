"use client";

/* eslint-disable @next/next/no-img-element -- template covers and the advisor's own looks */
import * as React from "react";
import { Check, ImageOff, LoaderCircle, Monitor, Search, Smartphone, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TwinView } from "./ai-twin";

/**
 * The look gallery: ready-made templates and look packs, applied to the
 * advisor's own look. Nothing is described or invented here; the advisor
 * picks from the gallery, their starting look and a shape, and generates.
 */

export interface LookTemplate {
  id: string;
  kind: "pack" | "single";
  name: string;
  styling: "men" | "women" | null;
  count: number;
  image?: string;
}
type Aspect = "9:16" | "16:9";

// Quick filters, shown only when some template's name matches.
const TOPICS: [string, RegExp][] = [
  ["Office", /office|corporate|business|executive|meeting|professional/i],
  ["Studio", /studio|stream|podcast|broadcast/i],
  ["Presentation", /present|keynote|speaker|stage|professor|lecture/i],
  ["Home", /home|living|cozy|kitchen/i],
  ["Casual", /casual|weekend|relaxed|cafe|coffee/i],
  ["Real estate", /real estate|realtor|property/i],
  ["Outdoors", /outdoor|park|city|street|urban|nature/i],
];

let cache: LookTemplate[] | null = null;
const STYLE_KEY = "renom.lookStyling";

export function LookStudio({ open, onOpenChange, twin, busy, onGenerate }: { open: boolean; onOpenChange: (v: boolean) => void; twin: TwinView; busy: boolean; onGenerate: (o: { templateId: string; from: string; aspect: Aspect; name: string; count: number }) => void }) {
  const [templates, setTemplates] = React.useState<LookTemplate[] | null>(cache);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("All");
  const [styling, setStyling] = React.useState<"men" | "women" | "all">("all");
  const [picked, setPicked] = React.useState<LookTemplate | null>(null);
  const [aspect, setAspect] = React.useState<Aspect>("9:16");
  const [from, setFrom] = React.useState("");
  const base = from || twin.defaultLook || twin.looks[0]?.id || "";
  const ref = twin.looks.find((l) => l.id === base);
  const left = twin.limits.looksLeft;

  React.useEffect(() => {
    try {
      const s = localStorage.getItem(STYLE_KEY);
      if (s === "men" || s === "women") setStyling(s);
    } catch {}
  }, []);
  const chooseStyling = (s: typeof styling) => {
    setStyling(s);
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {}
  };

  React.useEffect(() => {
    if (!open || cache) return;
    setError("");
    fetch("/api/twin/templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) throw new Error(j?.error ?? "The templates couldn’t be loaded.");
        cache = j.templates;
        setTemplates(j.templates);
      })
      .catch((e) => setError((e as Error).message));
  }, [open]);

  const all = templates ?? [];
  const styled = all.filter((t) => styling === "all" || !t.styling || t.styling === styling);
  const topics = TOPICS.filter(([, re]) => styled.some((t) => re.test(t.name)));
  const shown = styled.filter((t) => {
    if (filter === "Look packs" && t.kind !== "pack") return false;
    if (filter === "Single looks" && t.kind !== "single") return false;
    const topic = TOPICS.find(([n]) => n === filter);
    if (topic && !topic[1].test(t.name)) return false;
    return !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase());
  });
  const tooMany = !!picked && picked.count > left;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="font-serif text-2xl">Look studio</DialogTitle>
          <DialogDescription>Pick a template and you get new looks of you in it. Same face, same voice.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[260px_1fr] md:overflow-hidden">
          {/* The look it starts from */}
          <div className="border-b border-border p-5 md:border-r md:border-b-0 md:overflow-y-auto">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Starting look</div>
            <div className="relative mx-auto mt-3 aspect-[3/4] w-40 overflow-hidden rounded-xl bg-muted md:w-full">
              {ref?.mediaId ? <img src={`/api/media/${ref.mediaId}`} alt={ref.label} className="absolute inset-0 h-full w-full object-cover" /> : <UserRound className="absolute inset-0 m-auto size-8 text-muted-foreground" />}
            </div>
            <p className="mt-2 text-center text-[12px] text-muted-foreground">New looks keep your appearance from this look.</p>
            {!twin.looks.some((l) => l.kind === "photo") && <p className="mt-2 rounded-lg bg-muted/60 p-2 text-center text-[11px] text-muted-foreground">Add photos of you in step 3 (“Photos of you”) for more starting looks.</p>}
            {twin.looks.length > 1 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {twin.looks.map((l) => (
                  <button key={l.id} type="button" onClick={() => setFrom(l.id)} aria-pressed={base === l.id} title={l.label} className={cn("relative size-11 cursor-pointer overflow-hidden rounded-lg border-2 bg-muted", base === l.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}>
                    {l.mediaId ? <img src={`/api/media/${l.mediaId}`} alt={l.label} className="absolute inset-0 h-full w-full object-cover" /> : <UserRound className="m-auto size-4 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* The gallery */}
          <div className="flex min-h-0 flex-col">
            <div className="space-y-3 border-b border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-48 flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" className="h-9 w-full rounded-full border border-border bg-background pr-8 pl-9 text-[13px] outline-none focus:border-primary" />
                  {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground"><X className="size-4" /></button>}
                </label>
                <div className="inline-flex rounded-full border border-border p-0.5" role="radiogroup" aria-label="Styling">
                  {(
                    [
                      ["all", "All"],
                      ["men", "Men’s"],
                      ["women", "Women’s"],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={styling === v} onClick={() => chooseStyling(v)} className={cn("cursor-pointer rounded-full px-3 py-1 text-[12px] transition", styling === v ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {["All", "Look packs", "Single looks", ...topics.map(([n]) => n)].map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn("shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[12px] transition", filter === f ? "border-primary bg-brass-soft/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{f}</button>
                ))}
              </div>
            </div>

            <div className="min-h-64 flex-1 p-4 md:overflow-y-auto">
              {error ? (
                <p className="rounded-xl border border-border p-6 text-center text-[13px] text-muted-foreground">{error}</p>
              ) : !templates ? (
                <div className="flex h-48 items-center justify-center"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>
              ) : !shown.length ? (
                <p className="p-6 text-center text-[13px] text-muted-foreground">No templates match. Try another search or filter.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shown.map((t) => {
                    const on = picked?.id === t.id;
                    return (
                      <button key={t.id} type="button" onClick={() => setPicked(on ? null : t)} aria-pressed={on} className={cn("group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-xl border-2 bg-muted text-left transition", on ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-primary/40")}>
                        {t.image ? <img src={t.image} alt={t.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]" /> : <ImageOff className="absolute inset-0 m-auto size-6 text-muted-foreground" />}
                        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-8 pb-2">
                          <span className="line-clamp-2 text-[12px] leading-tight font-semibold text-white">{t.name}</span>
                          {t.kind === "pack" && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Pack of {t.count}</span>}
                        </span>
                        {on && <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-[12px] text-muted-foreground">
                {picked ? (tooMany ? `${picked.name} makes ${picked.count} looks; you have ${left} left this month.` : `${picked.name}: ${picked.count} new ${picked.count === 1 ? "look" : "looks"} of you, about a minute.`) : `${left} new ${left === 1 ? "look" : "looks"} left this month.`}
              </span>
              <div className="flex items-center gap-2">
                {picked?.kind !== "single" && (
                <div className="inline-flex rounded-full border border-border p-0.5" role="radiogroup" aria-label="Shape">
                  {(
                    [
                      ["9:16", Smartphone, "Portrait"],
                      ["16:9", Monitor, "Landscape"],
                    ] as const
                  ).map(([v, Icon, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={aspect === v} onClick={() => setAspect(v)} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition", aspect === v ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <Icon className="size-3.5" /> {l}
                    </button>
                  ))}
                </div>
                )}
                <Button className="rounded-full px-5" disabled={!picked || busy || tooMany || !base} onClick={() => picked && onGenerate({ templateId: picked.id, from: base, aspect, name: picked.name, count: picked.count })}>
                  {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
