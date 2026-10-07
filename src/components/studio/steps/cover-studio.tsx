"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, ImagePlus, LoaderCircle, Plus, RefreshCw, Shuffle, Video as VideoIcon } from "lucide-react";
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
import { COVER_SIZE, LOOKS, PALETTES, TEMPLATES, renderCover, templateOf, toJpeg, type CoverLook, type CoverTemplate, type CoverText } from "@/lib/thumbs/render";
import type { CoverImage, Video, VideoFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AskBar } from "../ask-bar";

type Lines = Record<VideoFormat, CoverText[]>;
interface Option {
  template: string;
  /** Palette id; "brand" is the advisor's own color. */
  palette?: string;
  text: CoverText;
  stillId?: string;
  /** Which frame to use until the advisor picks one. */
  shot?: number;
}
type Options = Record<VideoFormat, Option[]>;

const SHAPES: { id: VideoFormat; label: string; where: string }[] = [
  { id: "long", label: "Long form", where: "16:9 · YouTube, LinkedIn" },
  { id: "short", label: "Short form", where: "9:16 · Reels, TikTok, Shorts" },
];

/** How many options a fresh set (and each "More options") adds. */
const BATCH = 8;

const STOP = /^(a|an|the|and|or|of|for|to|in|on|your|my|is|i|it|you|are|with|what|why|how)$/i;

/** Words from the title while Claude writes (or if writing is off). */
function fallbackLines(title: string): CoverText[] {
  const words = title.replace(/[?.!:—]/g, " ").split(/\s+/).filter(Boolean);
  const strong = words.filter((w) => !STOP.test(w));
  const pick = (ws: string[]) => ws.slice(0, 4).join(" ");
  const accentOf = (h: string) => h.split(" ").find((w) => /\d|\$|%/.test(w)) ?? h.split(" ").sort((a, b) => b.length - a.length)[0] ?? "";
  const lines = [pick(strong), pick(strong.slice(-4)), pick(words.slice(0, 4)), pick(strong.slice(1))].map((h) => ({ headline: h || title, accent: accentOf(h || title), kicker: "" }));
  if (/\?\s*$/.test(title.trim())) lines.push({ headline: title.trim(), accent: accentOf(title), kicker: "" });
  return lines;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hasNumber = (t: CoverText) => /\d/.test(t.headline);
const isQuestion = (t: CoverText) => /\?\s*$/.test(t.headline.trim());

/** Lines for a shape: its own first, then the other shape's for extra variety. */
const poolFor = (lines: Lines, shape: VideoFormat) => {
  const seen = new Set<string>();
  return [...lines[shape], ...lines[shape === "long" ? "short" : "long"]].filter((l) => l.headline.trim() && !seen.has(l.headline.toLowerCase()) && seen.add(l.headline.toLowerCase()));
};

/** The line that suits a layout best (a number for Big number, a question for Question), spreading use across lines. */
function lineFor(t: CoverTemplate, pool: CoverText[], used: Map<string, number>, prev?: string) {
  const want = t.look === "Number" && t.id !== "checklist" ? hasNumber : t.id === "question" ? isQuestion : null;
  let suits = want ? pool.filter(want) : [];
  // Big number reads best when the figure leads ("$7,000 IRA mistake").
  if (want === hasNumber && suits.some((l) => /^\S*\d/.test(l.headline))) suits = suits.filter((l) => /^\S*\d/.test(l.headline));
  const cands = suits.length ? suits : pool;
  const pick = [...cands].sort((a, b) => (used.get(a.headline) ?? 0) - (used.get(b.headline) ?? 0) || +(a.headline === prev) - +(b.headline === prev))[0] ?? pool[0];
  used.set(pick.headline, (used.get(pick.headline) ?? 0) + 1);
  return pick;
}

/**
 * A varied set: layouts dealt round-robin across looks so neighbours differ,
 * each with one of the palettes that suits it (never the same twice in a row),
 * the line that fits it, and frames in rotation.
 */
function buildOptions(shape: VideoFormat, lines: Lines, o: { seed: number; count: number; look?: CoverLook; brand?: boolean; after?: Option[] }): Option[] {
  const rand = rng(o.seed);
  const pool = poolFor(lines, shape);
  const templates = TEMPLATES[shape].filter((t) => !o.look || t.look === o.look);
  const byLook = new Map<CoverLook, CoverTemplate[]>();
  for (const t of [...templates].sort(() => rand() - 0.5)) byLook.set(t.look, [...(byLook.get(t.look) ?? []), t]);
  const looks = [...byLook.keys()].sort(() => rand() - 0.5);
  const order: CoverTemplate[] = [];
  for (let r = 0; order.length < templates.length; r++) for (const l of looks) if (byLook.get(l)![r]) order.push(byLook.get(l)![r]);

  const before = o.after ?? [];
  const used = new Map<string, number>();
  for (const b of before) used.set(b.text.headline, (used.get(b.text.headline) ?? 0) + 1);
  const shown = new Set(before.map((b) => `${b.template}:${b.palette}`));
  // Start "More options" with layouts the advisor has seen least.
  const seenCount = (t: CoverTemplate) => before.filter((b) => b.template === t.id).length;
  order.sort((a, b) => seenCount(a) - seenCount(b));

  const out: Option[] = [];
  for (let k = 0; k < o.count && pool.length; k++) {
    const t = order[k % order.length];
    const prev = out[k - 1] ?? before[before.length - 1];
    const palettes = [...(o.brand ? ["brand"] : []), ...t.palettes];
    const start = Math.floor(rand() * palettes.length);
    let palette = palettes[start];
    for (let n = 0; n < palettes.length; n++) {
      const p = palettes[(start + n) % palettes.length];
      if (p !== prev?.palette && !shown.has(`${t.id}:${p}`)) {
        palette = p;
        break;
      }
    }
    if (o.brand && !before.length && k === 0) palette = "brand";
    shown.add(`${t.id}:${palette}`);
    out.push({ template: t.id, palette, text: lineFor(t, pool, used, prev?.text.headline), shot: before.length + k });
  }
  return out;
}

/** New words from Claude on the same layouts, colors and photos. */
function retext(opts: Option[], shape: VideoFormat, lines: Lines): Option[] {
  const pool = poolFor(lines, shape);
  const used = new Map<string, number>();
  return opts.map((o, k) => {
    const t = templateOf(shape, o.template) ?? TEMPLATES[shape][0];
    return pool.length ? { ...o, text: lineFor(t, pool, used, opts[k - 1]?.text.headline) } : o;
  });
}

const retextAll = (opts: Options, lines: Lines): Options => ({ long: retext(opts.long, "long", lines), short: retext(opts.short, "short", lines) });

const freshOptions = (lines: Lines, brand: boolean, seed = 1): Options => ({
  long: buildOptions("long", lines, { seed, count: BATCH, brand }),
  short: buildOptions("short", lines, { seed: seed + 1, count: BATCH, brand }),
});

export function CoverStudio({ video, onDone }: { video: Video; onDone: () => void }) {
  const { profile, updateVideo } = useStore();
  const memTake = React.useSyncExternalStore(subscribeTakes, () => getTake(video.id), () => undefined);
  const takeSrc = memTake?.url ?? video.take?.url;
  const takeSec = memTake?.durationSec ?? video.take?.durationSec ?? video.runtimeSec;
  const headshots = profile.headshots.filter((h) => h.url);
  const byline = [profile.name, profile.credentials].filter(Boolean).join(", ");
  const brand = profile.brandColors.find((c) => /^#[0-9a-f]{3,6}$/i.test(c) && !/^#(0b1f3a|f7f5f0|fff|ffffff|000|000000)$/i.test(c));
  // Checklist covers: Claude's talking points when written, else the outline.
  const [aiPoints, setAiPoints] = useDraft<string[]>(video.id, "cover.points", []);
  const points = React.useMemo(() => (aiPoints.length ? aiPoints : video.outline?.length ? video.outline : (video.script?.body ?? [])).slice(0, 3), [aiPoints, video.outline, video.script]);

  const [shape, setShape] = React.useState<VideoFormat>(video.format);
  const [lines, setLines] = useDraft<Lines | null>(video.id, "cover.lines", null);
  const [options, setOptions] = useDraft<Options>(video.id, "cover.options", () => freshOptions({ long: fallbackLines(video.title), short: fallbackLines(video.title) }, !!brand));
  const [picks, setPicks] = useDraft<Record<VideoFormat, number>>(video.id, "cover.picks", { long: 0, short: 0 });
  const [note, setNote] = React.useState<string | null>(null);
  const [look, setLook] = React.useState<CoverLook | null>(null);
  const linesNow = React.useCallback((): Lines => lines ?? { long: fallbackLines(video.title), short: fallbackLines(video.title) }, [lines, video.title]);

  // Sets saved before there were palettes (four options, one per layout): start over with a varied set.
  React.useEffect(() => {
    if (!options.long.some((o) => o.palette) && !options.short.some((o) => o.palette)) {
      setOptions(freshOptions(linesNow(), !!brand));
      setPicks({ long: 0, short: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        const next = { long: out.long.slice(0, 6), short: out.short.slice(0, 6) };
        setLines(next);
        if (out.points?.length) setAiPoints(out.points.slice(0, 3));
        setOptions((prev) => retextAll(prev, next));
        if (instruction) setNote("New words on every option.");
      } catch (e) {
        if (isAbort(e)) return;
        toast.error("Couldn’t write cover words", { description: (e as Error).message });
      }
    },
    [write, profile, video, setLines, setOptions, setAiPoints]
  );
  React.useEffect(() => {
    if (!lines && !busy) writeLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stillFor = React.useCallback(
    (o: Option, k: number) => (stills?.length ? stills.find((s) => s.id === o.stillId) ?? stills[(o.shot ?? k) % stills.length] : undefined),
    [stills]
  );
  const inputFor = React.useCallback(
    (o: Option, k: number) => ({ ...o.text, still: stillFor(o, k)!, byline, palette: o.palette, accentColor: o.palette === "brand" ? brand : undefined, points }),
    [stillFor, byline, brand, points]
  );

  // ── previews: small copies, drawn once per look of an option (editing one redraws only that one) ──
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const drawn = React.useRef(new Map<string, string>());
  const keyOf = React.useCallback((s: VideoFormat, o: Option, k: number) => JSON.stringify([s, o.template, o.palette, o.text, stillFor(o, k)?.id, byline, brand, points]), [stillFor, byline, brand, points]);
  React.useEffect(() => {
    if (!stills?.length) return;
    let live = true;
    (async () => {
      // The shape on screen first, then the other one.
      for (const s of [shape, shape === "long" ? "short" : "long"] as VideoFormat[]) {
        for (const [k, o] of options[s].entries()) {
          const key = keyOf(s, o, k);
          if (!drawn.current.has(key)) {
            const t = templateOf(s, o.template) ?? TEMPLATES[s][0];
            const c = await renderCover(t, inputFor(o, k), s === "long" ? 0.5 : 0.4);
            drawn.current.set(key, c.toDataURL("image/jpeg", 0.82));
            // Typing redraws an option per keystroke; keep only the recent ones.
            if (drawn.current.size > 120) drawn.current.delete(drawn.current.keys().next().value!);
          }
          if (!live) return;
          const url = drawn.current.get(key)!;
          setPreviews((prev) => (prev[`${s}:${k}`] === url ? prev : { ...prev, [`${s}:${k}`]: url }));
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [options, stills, shape, keyOf, inputFor]);

  const current = options[shape];
  const sel = Math.min(picks[shape], current.length - 1);
  const selected = current[sel];
  const editSelected = (patch: { stillId?: string; template?: string; palette?: string; text?: Partial<CoverText> }) =>
    setOptions((prev) => ({ ...prev, [shape]: prev[shape].map((o, k) => (k === sel ? { ...o, ...patch, text: { ...o.text, ...patch.text } } : o)) }));

  // ── more, shuffle, filter ──
  const seed = () => Math.floor(Math.random() * 1e9);
  const more = (l: CoverLook | null = look) =>
    setOptions((prev) => ({ ...prev, [shape]: [...prev[shape], ...buildOptions(shape, linesNow(), { seed: seed(), count: l ? 4 : BATCH, look: l ?? undefined, brand: !!brand, after: prev[shape] })] }));
  const shuffle = () => {
    // Keep the one they picked (with their edits) first; everything else is new.
    const keep = options[shape][sel];
    const fresh = buildOptions(shape, linesNow(), { seed: seed(), count: BATCH, look: look ?? undefined, brand: !!brand, after: keep ? [keep] : [] });
    setOptions((prev) => ({ ...prev, [shape]: keep ? [keep, ...fresh] : fresh }));
    setPicks({ ...picks, [shape]: 0 });
  };
  const filterTo = (l: CoverLook | null) => {
    setLook(l);
    if (l && options[shape].filter((o) => templateOf(shape, o.template)?.look === l).length < 4) more(l);
  };
  const visible = current.map((o, k) => ({ o, k })).filter(({ o }) => !look || templateOf(shape, o.template)?.look === look);
  // Keep the pick among what's on screen when filtering.
  const firstVisible = visible[0]?.k;
  const pickHidden = !!look && !!selected && templateOf(shape, selected.template)?.look !== look;
  React.useEffect(() => {
    if (pickHidden && firstVisible !== undefined) setPicks((prev) => ({ ...prev, [shape]: firstVisible }));
  }, [pickHidden, firstVisible, shape, setPicks]);

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
        const t = templateOf(s, o.template) ?? TEMPLATES[s][0];
        const blob = await toJpeg(await renderCover(t, inputFor(o, k)), 0.9);
        const up = await uploadImage(blob, "thumbnail", `${s}-cover`);
        const still = stillFor(o, k)!;
        covers[s] = {
          id: up.id,
          url: up.url,
          headline: o.text.headline,
          template: t.id,
          frameMs: still.source === "frame" && still.time !== undefined ? Math.round(still.time * 1000) : undefined,
          createdAt: new Date().toISOString(),
        };
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

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0" role="group" aria-label="Filter by look">
        {[null, ...LOOKS].map((l) => (
          <button
            key={l ?? "all"}
            onClick={() => filterTo(l)}
            className={cn("shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[12px] transition-colors", look === l ? "border-primary bg-brass-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {l ?? "All looks"}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-3 sm:gap-4", vertical ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 lg:grid-cols-3")}>
        {visible.map(({ o, k }) => {
          const src = previews[`${shape}:${k}`];
          const t = templateOf(shape, o.template);
          return (
            <button key={k} onClick={() => setPicks({ ...picks, [shape]: k })} className={cn("cursor-pointer rounded-2xl p-1 text-left transition-all sm:p-1.5", k === sel ? "bg-brass-soft ring-2 ring-primary" : "hover:bg-card")}>
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
                <Swatch id={o.palette ?? t?.palettes[0]} brand={brand} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => more()}>
          <Plus /> More options
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" onClick={shuffle}>
          <Shuffle /> Shuffle
        </Button>
        <span className="tnum text-[12px] text-muted-foreground">{W}×{H}</span>
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                Layout
                <select
                  value={selected.template}
                  onChange={(e) => editSelected({ template: e.target.value })}
                  className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-[13px] text-foreground"
                >
                  {LOOKS.map((l) => (
                    <optgroup key={l} label={l}>
                      {TEMPLATES[shape].filter((t) => t.look === l).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1.5" role="group" aria-label="Colors">
                <span className="mr-0.5 text-[12px] text-muted-foreground">Colors</span>
                {[...(brand ? ["brand"] : []), ...PALETTES.map((p) => p.id)].map((id) => {
                  const on = (selected.palette ?? templateOf(shape, selected.template)?.palettes[0]) === id;
                  return (
                    <button key={id} onClick={() => editSelected({ palette: id })} className={cn("cursor-pointer rounded-full p-0.5 ring-offset-1 transition", on ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100")} title={paletteName(id)}>
                      <Swatch id={id} brand={brand} large />
                      <span className="sr-only">{paletteName(id)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => writeLines("Give me fresh options for each shape with different tactics.")}>
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

const paletteName = (id: string) => (id === "brand" ? "Your brand color" : (PALETTES.find((p) => p.id === id)?.label ?? id));

/** Two dots: the palette's deep color and its highlight. */
function Swatch({ id, brand, large }: { id?: string; brand?: string; large?: boolean }) {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];
  const accent = id === "brand" && brand ? brand : p.accent;
  return (
    <span className={cn("relative inline-flex shrink-0", large ? "h-6 w-6" : "h-3.5 w-5")} aria-hidden>
      <span className={cn("absolute top-0 left-0 rounded-full border border-black/10", large ? "size-6" : "size-3.5")} style={{ background: p.bg }} />
      <span className={cn("absolute rounded-full border border-white/60", large ? "right-0 bottom-0 size-3" : "top-0 right-0 size-3.5")} style={{ background: accent }} />
    </span>
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
