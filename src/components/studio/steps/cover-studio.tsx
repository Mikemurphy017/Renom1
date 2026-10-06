"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, ImagePlus, LoaderCircle, RefreshCw, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { HeadshotPicker } from "@/components/settings/headshot-picker";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { isAbort, useWriter } from "@/lib/ai/writer";
import { getTake, subscribeTakes } from "@/lib/media/takes";
import { uploadImage } from "@/lib/media/upload";
import { framesFromVideo, stillFromImage, type Still } from "@/lib/thumbs/frames";
import { COVER_SIZE, TEMPLATES, renderCover, toJpeg, type CoverText } from "@/lib/thumbs/render";
import type { CoverImage, Video, VideoFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AskBar } from "../ask-bar";

type Lines = Record<VideoFormat, CoverText[]>;
interface Option {
  template: string;
  text: CoverText;
  stillId?: string;
}
type Options = Record<VideoFormat, Option[]>;

const SHAPES: { id: VideoFormat; label: string; where: string }[] = [
  { id: "long", label: "Long form", where: "16:9 · YouTube, LinkedIn" },
  { id: "short", label: "Short form", where: "9:16 · Reels, TikTok, Shorts" },
];

const STOP = /^(a|an|the|and|or|of|for|to|in|on|your|my|is|i|it|you|are|with|what|why|how)$/i;

/** Words from the title while Claude writes (or if writing is off). */
function fallbackLines(title: string): CoverText[] {
  const words = title.replace(/[?.!:—]/g, " ").split(/\s+/).filter(Boolean);
  const strong = words.filter((w) => !STOP.test(w));
  const pick = (ws: string[]) => ws.slice(0, 4).join(" ");
  const accentOf = (h: string) => h.split(" ").find((w) => /\d|\$|%/.test(w)) ?? h.split(" ").sort((a, b) => b.length - a.length)[0] ?? "";
  return [pick(strong), pick(strong.slice(-4)), pick(words.slice(0, 4)), pick(strong.slice(1))].map((h) => ({ headline: h || title, accent: accentOf(h || title), kicker: "" }));
}

function optionsFrom(lines: Lines, prev?: Options): Options {
  const make = (shape: VideoFormat) =>
    TEMPLATES[shape].map((t, k) => ({ template: t.id, text: lines[shape][k % lines[shape].length], stillId: prev?.[shape][k]?.stillId }));
  return { long: make("long"), short: make("short") };
}

export function CoverStudio({ video, onDone }: { video: Video; onDone: () => void }) {
  const { profile, updateVideo } = useStore();
  const memTake = React.useSyncExternalStore(subscribeTakes, () => getTake(video.id), () => undefined);
  const takeSrc = memTake?.url ?? video.take?.url;
  const takeSec = memTake?.durationSec ?? video.take?.durationSec ?? video.runtimeSec;
  const headshots = profile.headshots.filter((h) => h.url);
  const byline = [profile.name, profile.credentials].filter(Boolean).join(", ");

  const [shape, setShape] = React.useState<VideoFormat>(video.format);
  const [lines, setLines] = useDraft<Lines | null>(video.id, "cover.lines", null);
  const [options, setOptions] = useDraft<Options>(video.id, "cover.options", () => optionsFrom({ long: fallbackLines(video.title), short: fallbackLines(video.title) }));
  const [picks, setPicks] = useDraft<Record<VideoFormat, number>>(video.id, "cover.picks", { long: 0, short: 0 });
  const [note, setNote] = React.useState<string | null>(null);
  const { write, busy, status } = useWriter();

  // ── stills: best frames from the take, then uploaded headshots ──
  const [stills, setStills] = React.useState<Still[] | null>(null);
  const headshotKey = headshots.map((h) => h.id).join(",");
  React.useEffect(() => {
    let live = true;
    setStills(null);
    (async () => {
      const out: Still[] = [];
      if (takeSrc) {
        try {
          out.push(...(await framesFromVideo(takeSrc, takeSec, 4)));
        } catch (e) {
          console.warn("[covers] couldn't read frames", e);
        }
      }
      for (const h of headshots.slice(0, 4)) {
        try {
          out.push(await stillFromImage(h.url!, `h-${h.id}`));
        } catch {
          /* skip unreadable photo */
        }
      }
      if (live) setStills(out);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeSrc, headshotKey]);

  // ── words from Claude ──
  const writeLines = React.useCallback(
    async (instruction?: string) => {
      try {
        const out = await write({
          task: "covers",
          profile: voiceProfileOf(profile),
          video: { title: video.title, format: video.format, script: video.script, outline: video.outline },
          instruction,
        });
        const next = { long: out.long.slice(0, 4), short: out.short.slice(0, 4) };
        setLines(next);
        setOptions((prev) => optionsFrom(next, prev));
        if (instruction) setNote("New words on every option.");
      } catch (e) {
        if (isAbort(e)) return;
        toast.error("Couldn’t write cover words", { description: (e as Error).message });
      }
    },
    [write, profile, video, setLines, setOptions]
  );
  React.useEffect(() => {
    if (!lines && !busy) writeLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stillFor = React.useCallback(
    (o: Option, k: number) => (stills?.length ? stills.find((s) => s.id === o.stillId) ?? stills[k % stills.length] : undefined),
    [stills]
  );

  // ── previews ──
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!stills?.length) return;
    let live = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const s of ["long", "short"] as VideoFormat[]) {
        for (const [k, o] of options[s].entries()) {
          const t = TEMPLATES[s].find((x) => x.id === o.template) ?? TEMPLATES[s][k];
          const c = await renderCover(t, { ...o.text, still: stillFor(o, k)!, byline });
          next[`${s}:${k}`] = c.toDataURL("image/jpeg", 0.82);
        }
      }
      if (live) setPreviews(next);
    })();
    return () => {
      live = false;
    };
  }, [options, stills, stillFor, byline]);

  const current = options[shape];
  const sel = Math.min(picks[shape], current.length - 1);
  const selected = current[sel];
  const editSelected = (patch: { stillId?: string; text?: Partial<CoverText> }) =>
    setOptions((prev) => ({ ...prev, [shape]: prev[shape].map((o, k) => (k === sel ? { ...o, ...patch, text: { ...o.text, ...patch.text } } : o)) }));

  // ── save ──
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    if (!stills?.length) return onDone();
    setSaving(true);
    try {
      const covers: Partial<Record<VideoFormat, CoverImage>> = { ...video.covers };
      for (const s of ["long", "short"] as VideoFormat[]) {
        const k = Math.min(picks[s], options[s].length - 1);
        const o = options[s][k];
        const t = TEMPLATES[s].find((x) => x.id === o.template) ?? TEMPLATES[s][k];
        const blob = await toJpeg(await renderCover(t, { ...o.text, still: stillFor(o, k)!, byline }), 0.9);
        const up = await uploadImage(blob, "thumbnail", `${s}-cover`);
        covers[s] = { id: up.id, url: up.url, headline: o.text.headline, template: t.id, createdAt: new Date().toISOString() };
      }
      updateVideo(video.id, { covers });
      toast.success("Covers saved", { description: "Long form and short form, both in your library." });
      onDone();
    } catch (e) {
      toast.error("Couldn’t save the covers", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  // ── nothing to build from yet ──
  if (stills && !stills.length) {
    return (
      <div className="mx-auto max-w-[620px] rounded-2xl border border-border bg-card p-8 text-center">
        <ImagePlus className="mx-auto size-6 text-primary" />
        <h2 className="mt-3 font-serif text-2xl">Covers are made from you.</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
          {takeSrc ? "We couldn’t read frames from this take. " : "There’s no take saved for this video yet. "}
          Record one, or add a headshot and we’ll build the covers around it.
        </p>
        <div className="mt-6 flex justify-center">
          <HeadshotPicker compact />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" className="rounded-full" asChild>
            <Link href={`/studio/${video.id}/record`}><VideoIcon /> Record a take</Link>
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={onDone}>Skip for now <ArrowRight /></Button>
        </div>
      </div>
    );
  }

  const [W, H] = COVER_SIZE[shape];
  const vertical = shape === "short";

  return (
    <div className="space-y-6">
      <p className="text-center text-[14px] text-muted-foreground">Real frames from your take, words by {busy ? "Claude (writing…)" : "Claude"}. Pick one of each shape.</p>

      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setShape(s.id)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-[13px] transition-colors", shape === s.id ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <span className={cn("inline-block rounded-[3px] border-[1.5px] border-current", s.id === "long" ? "h-2.5 w-4" : "h-4 w-2.5")} />
              <span className="font-medium">{s.label}</span>
              <span className="hidden opacity-70 sm:inline">{s.where}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn("grid gap-4", vertical ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
        {current.map((o, k) => {
          const src = previews[`${shape}:${k}`];
          const t = TEMPLATES[shape].find((x) => x.id === o.template);
          return (
            <button key={k} onClick={() => setPicks({ ...picks, [shape]: k })} className={cn("cursor-pointer rounded-2xl p-1.5 text-left transition-all", k === sel ? "bg-brass-soft ring-2 ring-primary" : "hover:bg-card")}>
              <div className={cn("relative overflow-hidden rounded-xl bg-muted", vertical ? "aspect-[9/16]" : "aspect-video")}>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={o.text.headline} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Skeleton className="absolute inset-0 rounded-none" />
                )}
                {k === sel && (
                  <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Check className="size-3.5" /></span>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[12px] text-muted-foreground">
                <span className="truncate">{t?.label}</span>
                <span className="tnum opacity-70">{W}×{H}</span>
              </div>
            </button>
          );
        })}
      </div>
      {!stills && <p className="text-center text-[12px] text-muted-foreground"><LoaderCircle className="mr-1 inline size-3.5 animate-spin" /> Finding your best frames…</p>}

      {selected && stills && stills.length > 0 && (
        <div className="grid gap-5 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_1.1fr]">
          <div>
            <div className="eyebrow mb-2">Photo</div>
            <div className="flex flex-wrap gap-2">
              {stills.map((s, k) => {
                const on = (stillFor(selected, sel) ?? stills[0]).id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => editSelected({ stillId: s.id })}
                    title={s.source === "frame" ? `Frame at ${s.time?.toFixed(1)}s` : "Headshot"}
                    className={cn("relative h-16 cursor-pointer overflow-hidden rounded-md border-2 transition", on ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")}
                    style={{ aspectRatio: `${s.canvas.width}/${s.canvas.height}` }}
                  >
                    <StillImg still={s} />
                    {s.source === "headshot" && <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[9px] text-white">Photo</span>}
                    <span className="sr-only">Use still {k + 1}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Frames are picked for sharpness and light. <Link href="/settings#voice" className="underline underline-offset-2">Add headshots</Link> for more choice.
            </p>
          </div>
          <div className="space-y-3">
            <div className="eyebrow">Words</div>
            <Input value={selected.text.headline} onChange={(e) => editSelected({ text: { headline: e.target.value } })} className="font-semibold" aria-label="Headline" />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] text-muted-foreground">Highlight</span>
              {selected.text.headline.split(/\s+/).filter(Boolean).map((w, i) => (
                <button
                  key={i}
                  onClick={() => editSelected({ text: { accent: w } })}
                  className={cn("cursor-pointer rounded-full border px-2.5 py-0.5 text-[12px]", selected.text.accent.toLowerCase() === w.toLowerCase() ? "border-primary bg-brass-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {w}
                </button>
              ))}
            </div>
            <Input value={selected.text.kicker} onChange={(e) => editSelected({ text: { kicker: e.target.value } })} placeholder="Label above the headline (optional)" className="text-[13px]" aria-label="Label" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => writeLines("Give me four fresh options for each shape with different tactics.")}>
          <RefreshCw className={cn(busy && "animate-spin")} /> New words
        </Button>
        <div className="flex items-center gap-3">
          {video.covers?.long && video.covers?.short && <span className="hidden text-[12px] text-muted-foreground sm:inline">Saved covers will be replaced</span>}
          <Button className="rounded-full px-6" disabled={saving || !stills} onClick={save}>
            {saving ? <LoaderCircle className="animate-spin" /> : null} {saving ? "Saving covers…" : "Use these covers"} {!saving && <ArrowRight />}
          </Button>
        </div>
      </div>

      <AskBar onAsk={(t) => writeLines(t)} busy={busy} status={status} note={note} suggestions={["Use a number", "More curiosity", "Less salesy", "Name the mistake"]} placeholder="Ask Claude to change the cover words…" />
    </div>
  );
}

function StillImg({ still }: { still: Still }) {
  const [src, setSrc] = React.useState<string>();
  React.useEffect(() => {
    const s = document.createElement("canvas");
    const k = 160 / still.canvas.height;
    s.width = Math.round(still.canvas.width * k);
    s.height = 160;
    s.getContext("2d")!.drawImage(still.canvas, 0, 0, s.width, s.height);
    setSrc(s.toDataURL("image/jpeg", 0.8));
  }, [still]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null;
}
