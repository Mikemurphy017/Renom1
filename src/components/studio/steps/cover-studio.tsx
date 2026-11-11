"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Download, ImagePlus, LoaderCircle, Plus, RefreshCw, Shuffle, Sparkles, Video as VideoIcon } from "lucide-react";
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
import { cutAll } from "@/lib/thumbs/cutout";
import { COVER_SIZE, PALETTES, TEMPLATES, isPickable, releaseCanvas, renderCover, templateOf, toJpeg, type CoverLook, type CoverTemplate, type CoverText } from "@/lib/thumbs/render";
import type { CoverImage, CoverPhotos, Video, VideoFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AskBar } from "../ask-bar";
import { CoverIntroSwitch } from "../cover-intro-note";
import { CoverStyleChooser, CoverStyleSwitch, PhotoSetPanel, useAiPhotosAvailable } from "../photo-set";
import type { useCoverIntro } from "../use-cover-intro";

type Lines = Record<VideoFormat, CoverText[]>;
interface Option {
  template: string;
  /** Palette id; "brand" is the advisor's own color. */
  palette?: string;
  text: CoverText;
  stillId?: string;
  /** Which frame to use until the advisor picks one. */
  shot?: number;
  /** Words that are the advisor's own (a saved cover reopened): automatic rewrites leave them be. */
  own?: boolean;
}
type Options = Record<VideoFormat, Option[]>;
/** A photo of the advisor in a new setting, made by the image AI (kept so a reload doesn't lose it). */
interface Scene {
  id: string;
  url: string;
  shape: VideoFormat;
  setting?: string;
  /** Where the face is (found by Gemini when the scene was made); the browser's guess is easily fooled. */
  face?: { x: number; y: number; w: number; h: number } | null;
  createdAt: string;
}

/** One connected flow: the design first, then one pick per shape, then what can be downloaded. */
const STAGES = ["Edit your cover", "1. Short-form", "2. Long-form", "Download"] as const;

/** How many options a fresh set (and each "More options") adds. */
const BATCH = 8;

const STOP = /^(a|an|the|and|or|of|for|to|in|on|your|my|is|i|it|you|are|with|what|why|how)$/i;

/** Where a title can be cut and still read as a phrase ("The $7,000 IRA mistake | most couples make"). */
const CUT = /^(most|that|which|who|when|while|because|if|so|but|and|for|before|after|without|nobody|everyone|you|we|i)$/i;

/** Words from the title while Claude writes (or if writing is off): whole phrases, never fragments. */
function fallbackLines(title: string): CoverText[] {
  const t = title.trim().replace(/\s+/g, " ");
  const words = t.split(" ").filter(Boolean);
  const accentOf = (h: string) => {
    const ws = h.split(" ");
    const word = ws.find((w) => /\d|\$|%/.test(w)) ?? [...ws].filter((w) => !STOP.test(w.replace(/[^\w]/g, ""))).sort((a, b) => b.length - a.length)[0] ?? ws[0] ?? "";
    return word.replace(/[.,:;!?]+$/, "");
  };
  const out: string[] = [];
  // Before a colon or dash, and the clause after it.
  // (No lookbehind in these regexes: Safari before 16.4 can't parse it.)
  const parts = t
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n|\s*[:—–]\s*|\s+-\s+/)
    .map((p) => p.replace(/\.$/, ""))
    .filter((p) => p.split(" ").length >= 2 && p.split(" ").length <= 8)
    .map((p) => p[0].toUpperCase() + p.slice(1));
  if (parts.length > 1 || words.length <= 8) out.push(...parts);
  // Up to a natural break.
  const cut = parts.length > 1 ? -1 : words.findIndex((w, k) => k >= 3 && CUT.test(w.replace(/[^\w]/g, "")));
  if (cut > 0) out.push(words.slice(0, cut).join(" "));
  if (words.length <= 8) out.push(t);
  // Last resort: the first few strong words.
  if (!out.length) out.push(words.filter((w) => !STOP.test(w)).slice(0, 5).join(" ") || t);
  const seen = new Set<string>();
  return out
    .map((h) => h.replace(/[,;]$/, "").trim())
    .filter((h) => h && !seen.has(h.toLowerCase()) && !!seen.add(h.toLowerCase()))
    .map((h) => ({ headline: h, accent: accentOf(h), kicker: "" }));
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

/** A word as the covers match it for highlighting (case and punctuation aside). */
const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");

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
function buildOptions(shape: VideoFormat, lines: Lines, o: { seed: number; count: number; look?: CoverLook; brand?: boolean; after?: Option[]; noPhoto?: boolean }): Option[] {
  const rand = rng(o.seed);
  const pool = poolFor(lines, shape);
  // Photo layouts, or (the "no photo" cover style) words-and-graphics ones.
  const templates = TEMPLATES[shape].filter((t) => isPickable(t) && !!t.noPhoto === !!o.noPhoto && (!o.look || t.look === o.look));
  const byLook = new Map<CoverLook, CoverTemplate[]>();
  for (const t of [...templates].sort(() => rand() - 0.5)) byLook.set(t.look, [...(byLook.get(t.look) ?? []), t]);
  // Creator layouts (the advisor cut out on a loud ground) are every other option; the rest go
  // round-robin by look, the punchier looks first and the quiet ones (Editorial, Minimal, Quote) last.
  const RANK: CoverLook[] = ["Bold", "Framed", "Number", "Text", "Editorial", "Minimal", "Quote"];
  const looks = [...byLook.keys()].filter((l) => l !== "Creator").sort(() => rand() - 0.5).sort((a, b) => Math.floor(RANK.indexOf(a) / 2) - Math.floor(RANK.indexOf(b) / 2));
  const rest: CoverTemplate[] = [];
  for (let r = 0; rest.length < templates.length - (byLook.get("Creator")?.length ?? 0); r++) for (const l of looks) if (byLook.get(l)![r]) rest.push(byLook.get(l)![r]);
  const creator = byLook.get("Creator") ?? [];
  const order: CoverTemplate[] = [];
  for (let n = 0; order.length < templates.length; n++) {
    if (creator[n]) order.push(creator[n]);
    if (rest[n]) order.push(rest[n]);
  }

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

/** New words from Claude on the same layouts, colors and photos (`all`: even the advisor's own). */
function retext(opts: Option[], shape: VideoFormat, lines: Lines, all: boolean): Option[] {
  const pool = poolFor(lines, shape);
  const used = new Map<string, number>();
  return opts.map((o, k) => {
    const t = templateOf(shape, o.template) ?? TEMPLATES[shape][0];
    if (!pool.length || (o.own && !all)) return o;
    const { own: _own, ...rest } = o;
    return { ...rest, text: lineFor(t, pool, used, opts[k - 1]?.text.headline) };
  });
}

const retextAll = (opts: Options, lines: Lines, all = false): Options => ({ long: retext(opts.long, "long", lines, all), short: retext(opts.short, "short", lines, all) });

/** The cover id of a saved cover's photo. */
const savedStill = (c: CoverImage) => c.still ?? (c.frameMs !== undefined ? `f${Math.round(c.frameMs / 100)}` : undefined);

/**
 * Reopening the step: put each saved cover back in the set (as it was saved:
 * layout, colors, words, photo) and select it, so the editor matches the
 * cover in the library. Covers saved before palettes were stored keep the
 * layout's default colors.
 */
function withSaved(opts: Options, picks: Record<VideoFormat, number>, covers: Video["covers"], noPhoto = false) {
  let options = opts;
  let picked = picks;
  for (const s of ["long", "short"] as VideoFormat[]) {
    const c = covers?.[s];
    if (!c || !templateOf(s, c.template) || !!templateOf(s, c.template)!.noPhoto !== noPhoto) continue;
    const still = savedStill(c);
    const same = (o: Option) =>
      o.template === c.template &&
      o.text.headline === c.headline &&
      (c.palette === undefined || o.palette === c.palette) &&
      (c.accent === undefined || o.text.accent === c.accent) &&
      (c.kicker === undefined || o.text.kicker === c.kicker);
    const k = options[s].findIndex(same);
    const saved: Option = k >= 0 ? { ...options[s][k], stillId: options[s][k].stillId ?? still, own: true } : { template: c.template, palette: c.palette, text: { headline: c.headline, accent: c.accent ?? "", kicker: c.kicker ?? "" }, stillId: still, shot: 0, own: true };
    options = { ...options, [s]: k >= 0 ? options[s].map((o, n) => (n === k ? saved : o)) : [saved, ...options[s]] };
    picked = { ...picked, [s]: Math.max(0, k) };
  }
  return { options, picks: picked };
}

const freshOptions = (lines: Lines, brand: boolean, seed = 1, noPhoto = false): Options => ({
  long: buildOptions("long", lines, { seed, count: BATCH, brand, noPhoto }),
  short: buildOptions("short", lines, { seed: seed + 1, count: BATCH, brand, noPhoto }),
});

/** Whether a set of options is for the "no photo" style. */
const isTextSet = (opts: Options) => [...opts.long.map((o) => templateOf("long", o.template)), ...opts.short.map((o) => templateOf("short", o.template))].some((t) => t?.noPhoto);

export function CoverStudio({ video, intro, onDone }: { video: Video; intro?: ReturnType<typeof useCoverIntro>; onDone: () => void }) {
  const { profile, updateVideo, updateProfile } = useStore();
  // What goes on covers: the AI photo set, real photos, or no photo (unset: ask first).
  const mode = profile.coverPhotos;
  const noPhoto = mode === "none";
  const aiAvailable = useAiPhotosAvailable();
  const photoSet = React.useMemo(() => profile.photoSet ?? [], [profile.photoSet]);
  const [showSet, setShowSet] = React.useState(mode === "ai" && !photoSet.length);
  const chooseMode = (m: CoverPhotos) => {
    updateProfile({ coverPhotos: m });
    setShowSet(m === "ai" && !photoSet.length);
  };
  const memTake = React.useSyncExternalStore(subscribeTakes, () => getTake(video.id), () => undefined);
  const takeSrc = memTake?.url ?? video.take?.url;
  const takeSec = memTake?.durationSec ?? video.take?.durationSec ?? video.runtimeSec;
  const headshots = profile.headshots.filter((h) => h.url);
  const byline = [profile.name, profile.credentials].filter(Boolean).join(", ");
  const brand = profile.brandColors.find((c) => /^#[0-9a-f]{3,6}$/i.test(c) && !/^#(0b1f3a|f7f5f0|fff|ffffff|000|000000)$/i.test(c));
  // Checklist covers: Claude's talking points when written, else the outline.
  const [aiPoints, setAiPoints] = useDraft<string[]>(video.id, "cover.points", []);
  const points = React.useMemo(() => (aiPoints.length ? aiPoints : video.outline?.length ? video.outline : (video.script?.body ?? [])).slice(0, 3), [aiPoints, video.outline, video.script]);

  // Where the advisor is in the flow, which shapes they skipped, and the photo and colors they chose for every option.
  const [stage, setStage] = useDraft<number>(video.id, "cover.stage", 0);
  const [skip, setSkip] = useDraft<Record<VideoFormat, boolean>>(video.id, "cover.skip", { long: false, short: false });
  const [design, setDesign] = useDraft<{ stillId?: string; palette?: string }>(video.id, "cover.design", {});
  const shape: VideoFormat = stage === 1 ? "short" : stage === 2 ? "long" : video.format;
  const [lines, setLines] = useDraft<Lines | null>(video.id, "cover.lines", null);
  const [options, setOptions] = useDraft<Options>(video.id, "cover.options", () => freshOptions(lines ?? { long: fallbackLines(video.title), short: fallbackLines(video.title) }, !!brand, 1, noPhoto));
  const [picks, setPicks] = useDraft<Record<VideoFormat, number>>(video.id, "cover.picks", { long: 0, short: 0 });
  const [note, setNote] = React.useState<string | null>(null);
  const [look] = React.useState<CoverLook | null>(null);
  const linesNow = React.useCallback((): Lines => lines ?? { long: fallbackLines(video.title), short: fallbackLines(video.title) }, [lines, video.title]);

  // On opening (and when the cover style changes): sets saved before there were palettes, or made
  // for the other style, start over with a varied set; saved covers go back in, selected, exactly as saved.
  React.useEffect(() => {
    const retired = (["long", "short"] as VideoFormat[]).some((s) => options[s].some((o) => !o.own && !isPickable(templateOf(s, o.template) ?? TEMPLATES[s][0])));
    const stale = (!options.long.some((o) => o.palette) && !options.short.some((o) => o.palette)) || isTextSet(options) !== noPhoto || retired;
    const next = withSaved(stale ? freshOptions(linesNow(), !!brand, 1, noPhoto) : options, stale ? { long: 0, short: 0 } : picks, video.covers, noPhoto);
    if (next.options !== options) setOptions(next.options);
    if (next.picks !== picks) setPicks(next.picks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noPhoto]);
  const { write, busy, status } = useWriter();

  // ── stills: the AI photo set and scenes (AI style), or frames from the take and headshots (real photos); none for "no photo" ──
  const [stills, setStills] = React.useState<Still[] | null>(null);
  const [scenes, setScenes] = useDraft<Scene[]>(video.id, "cover.scenes", []);
  const scenesRef = React.useRef(scenes);
  const headshotKey = headshots.map((h) => h.id).join(",");
  const setKey = photoSet.map((p) => p.id).join(",");
  React.useEffect(() => {
    let live = true;
    setStills(null);
    if (noPhoto || !mode) {
      setStills([]);
      return;
    }
    (async () => {
      const out: Still[] = [];
      if (mode === "ai") {
        for (const p of photoSet) {
          try {
            out.push({ ...(await stillFromImage(p.url, `p-${p.id}`, p.face ?? undefined)), source: "ai" });
          } catch {
            /* skip a photo that's gone */
          }
        }
      }
      if (takeSrc) {
        try {
          // The frames of saved covers come back too, so a reopened cover has its own photo.
          const keep = (["long", "short"] as VideoFormat[]).flatMap((s) => (video.covers?.[s]?.frameMs !== undefined && !video.covers[s]!.still?.startsWith("h-") ? [video.covers[s]!.frameMs! / 1000] : []));
          out.push(...(await framesFromVideo(takeSrc, takeSec, keep.length ? 4 + keep.length : 4, keep)));
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
      const found: Record<string, Scene["face"]> = {};
      for (const sc of mode === "ai" ? scenesRef.current.slice(-8) : []) {
        try {
          let face = sc.face;
          // Scenes made before they came with a face box: ask once, and keep the answer.
          if (face === undefined) {
            face = await fetch("/api/covers/face", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sc.id }) })
              .then((r) => r.json())
              .then((j) => (j.ok ? (j.face ?? null) : undefined))
              .catch(() => undefined);
            if (face !== undefined) found[sc.id] = face;
          }
          out.push({ ...(await stillFromImage(sc.url, `a-${sc.id}`, face)), source: "ai" });
        } catch {
          /* skip a scene that's gone */
        }
      }
      if (live && Object.keys(found).length) setScenes((prev) => prev.map((sc) => (sc.id in found ? { ...sc, face: found[sc.id] } : sc)));
      if (live) setStills(out);
      // Cut the person out of each photo (creator layouts put them on the ground as a sticker); previews redraw as each is ready.
      await cutAll(out, (id, patch) => live && setStills((prev) => prev?.map((st) => (st.id === id ? { ...st, ...patch } : st)) ?? prev), () => live);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeSrc, headshotKey, setKey, mode]);

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
        setOptions((prev) => retextAll(prev, next, !!instruction));
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
    // No-photo layouts never read the still.
    (o: Option, k: number) => ({ ...o.text, still: stillFor(o, k) as Still, byline, palette: o.palette, accentColor: o.palette === "brand" ? brand : undefined, points }),
    [stillFor, byline, brand, points]
  );

  // ── previews: small copies, drawn once per look of an option (editing one redraws only that one) ──
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const drawn = React.useRef(new Map<string, string>());
  const keyOf = React.useCallback(
    (s: VideoFormat, o: Option, k: number) => {
      const st = stillFor(o, k);
      return JSON.stringify([s, o.template, o.palette, o.text, st?.id, st?.cut === undefined ? "?" : st.cut ? "cut" : "-", byline, brand, points]);
    },
    [stillFor, byline, brand, points]
  );
  React.useEffect(() => {
    if (!stills || (!stills.length && !noPhoto)) return;
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
            releaseCanvas(c);
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
  }, [options, stills, shape, keyOf, inputFor, noPhoto]);

  const current = options[shape];
  const sel = Math.min(picks[shape], current.length - 1);
  const selected = current[sel];
  const editSelected = (patch: { stillId?: string; template?: string; palette?: string; text?: Partial<CoverText> }) =>
    setOptions((prev) => ({ ...prev, [shape]: prev[shape].map((o, k) => (k === sel ? { ...o, ...patch, text: { ...o.text, ...patch.text }, own: o.own || !!patch.text } : o)) }));

  // ── the design: one photo and one set of colors on every option, in both shapes ──
  const styled = (opts: Option[]) => opts.map((o) => ({ ...o, ...(design.stillId ? { stillId: design.stillId } : {}), ...(design.palette ? { palette: design.palette } : {}) }));
  const applyDesign = (patch: { stillId?: string; palette?: string }) => {
    setDesign((d) => ({ ...d, ...patch }));
    if ("palette" in patch && !patch.palette) {
      // Back to a mix: each option takes its layout's own colors again.
      setOptions((prev) => ({ long: prev.long.map((o) => ({ ...o, palette: templateOf("long", o.template)?.palettes[0] })), short: prev.short.map((o) => ({ ...o, palette: templateOf("short", o.template)?.palettes[0] })) }));
      return;
    }
    setOptions((prev) => ({ long: prev.long.map((o) => ({ ...o, ...patch })), short: prev.short.map((o) => ({ ...o, ...patch })) }));
  };

  // ── more, shuffle, filter ──
  const seed = () => Math.floor(Math.random() * 1e9);
  const more = (l: CoverLook | null = look) =>
    setOptions((prev) => ({ ...prev, [shape]: [...prev[shape], ...styled(buildOptions(shape, linesNow(), { seed: seed(), count: l ? 4 : BATCH, look: l ?? undefined, brand: !!brand, after: prev[shape], noPhoto }))] }));
  const shuffle = () => {
    // Keep the one they picked (with their edits) first; everything else is new.
    const keep = options[shape][sel];
    const fresh = styled(buildOptions(shape, linesNow(), { seed: seed(), count: BATCH, look: look ?? undefined, brand: !!brand, after: keep ? [keep] : [], noPhoto }));
    setOptions((prev) => ({ ...prev, [shape]: keep ? [keep, ...fresh] : fresh }));
    setPicks({ ...picks, [shape]: 0 });
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
  const save = async (skipped: Record<VideoFormat, boolean> = skip) => {
    if (!stills || (!stills.length && !noPhoto)) return onDone();
    setSaving(true);
    try {
      const covers: Partial<Record<VideoFormat, CoverImage>> = { ...video.covers };
      for (const s of ["long", "short"] as VideoFormat[]) {
        // A shape they skipped isn't made, and an older cover in that shape is dropped.
        if (skipped[s]) {
          delete covers[s];
          continue;
        }
        const k = Math.min(picks[s], options[s].length - 1);
        const o = options[s][k];
        const t = templateOf(s, o.template) ?? TEMPLATES[s][0];
        const full = await renderCover(t, inputFor(o, k));
        const blob = await toJpeg(full, 0.9);
        releaseCanvas(full);
        const up = await uploadImage(blob, "thumbnail", `${s}-cover`);
        const still = noPhoto ? undefined : stillFor(o, k);
        covers[s] = {
          id: up.id,
          url: up.url,
          headline: o.text.headline,
          template: t.id,
          palette: o.palette,
          accent: o.text.accent,
          kicker: o.text.kicker,
          still: still?.id,
          frameMs: still?.source === "frame" && still.time !== undefined ? Math.round(still.time * 1000) : undefined,
          createdAt: new Date().toISOString(),
        };
      }
      updateVideo(video.id, { covers });
      const made = (["short", "long"] as VideoFormat[]).filter((s) => covers[s]);
      if (made.length) toast.success(made.length === 2 ? "Both covers saved" : "Cover saved", { description: made.length === 2 ? "Short-form and long-form are both ready to download." : `Your ${made[0] === "short" ? "short-form" : "long-form"} cover is ready to download.` });
      setStage(3);
    } catch (e) {
      toast.error("Couldn’t save the covers", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  // ── first: what goes on covers, then (AI style) the photo set ──
  if (!mode) return <CoverStyleChooser onPick={chooseMode} aiAvailable={aiAvailable} />;
  if (mode === "ai" && showSet) {
    return (
      <div className="space-y-5">
        <CoverStyleSwitch value={mode} onChange={chooseMode} aiAvailable={aiAvailable} />
        <PhotoSetPanel onContinue={() => setShowSet(false)} onSkip={() => chooseMode("real")} />
      </div>
    );
  }

  // ── nothing to build from yet ──
  if (stills && !stills.length && !noPhoto) {
    return (
      <div className="mx-auto max-w-[620px] rounded-2xl border border-border bg-card p-8 text-center">
        <ImagePlus className="mx-auto size-6 text-primary" />
        <h2 className="mt-3 font-serif text-2xl">Covers are made from you.</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
          {takeSrc ? "We couldn’t read frames from this take. " : "There’s no take saved for this video yet. "}
          Record one, or add a headshot and we’ll build the covers around it.
        </p>
        <div className="mt-5"><CoverStyleSwitch value={mode} onChange={chooseMode} aiAvailable={aiAvailable} onManage={() => setShowSet(true)} /></div>
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
  const ready = !!stills && (stills.length > 0 || noPhoto);
  const pickOf = (s: VideoFormat) => Math.min(picks[s], options[s].length - 1);
  const slug = video.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "") || "video";
  const fileOf = (s: VideoFormat) => `${slug}-cover-${s === "short" ? "9x16" : "16x9"}.jpg`;

  const stepper = (
    <ol className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-1 gap-y-2 text-[13px]" aria-label="Cover steps">
      {STAGES.map((label, i) => (
        <li key={label} className="flex items-center gap-1">
          {i > 0 && <span className="mx-1 hidden h-px w-5 bg-border sm:block" />}
          <button
            type="button"
            onClick={() => i < stage && setStage(i)}
            aria-current={i === stage ? "step" : undefined}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors", i === stage ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : i < stage ? "cursor-pointer text-foreground hover:bg-muted" : "cursor-default text-muted-foreground")}
          >
            {i < stage ? <Check className="size-3.5 text-primary" /> : null}
            {label}
          </button>
        </li>
      ))}
    </ol>
  );

  const photoStrip = !noPhoto && stills && selected && (
    <div>
      <div className="eyebrow mb-2">Photo</div>
      <div className="flex flex-wrap gap-2">
        {stills.map((s, k) => {
          const on = (design.stillId ? design.stillId === s.id : (stillFor(selected, sel) ?? stills[0]).id === s.id);
          return (
            <button
              key={s.id}
              onClick={() => applyDesign({ stillId: s.id })}
              title={s.source === "frame" ? `Frame at ${s.time?.toFixed(1)}s` : s.source === "ai" ? "AI scene" : "Headshot"}
              aria-pressed={on}
              className={cn("relative h-16 cursor-pointer overflow-hidden rounded-md border-2 transition", on ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")}
              style={{ aspectRatio: `${s.canvas.width}/${s.canvas.height}` }}
            >
              <StillImg still={s} />
              {s.source !== "frame" && <span className={cn("absolute inset-x-0 bottom-0 text-center text-[9px] text-white", s.source === "ai" ? "bg-primary/85" : "bg-black/55")}>{s.source === "ai" ? (s.id.startsWith("p-") ? "AI photo" : "AI scene") : "Photo"}</span>}
              <span className="sr-only">Use photo {k + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        {mode === "ai" ? <>Your AI photo set comes first, then frames from your take. <button type="button" onClick={() => setShowSet(true)} className="cursor-pointer underline underline-offset-2">Manage the set</button></> : <>Frames are picked for sharpness and light. <Link href="/settings#voice" className="underline underline-offset-2">Add headshots</Link> for more choice.</>}
      </p>
      {mode === "ai" && <AiScene
        video={video}
        shape={shape}
        from={(() => {
          const cur = stillFor(selected, sel) ?? stills[0];
          return cur.source !== "ai" ? cur : (stills.find((x) => x.source === "headshot") ?? stills.find((x) => x.source === "frame") ?? cur);
        })()}
        onScene={(still, scene) => {
          setStills((prev) => [...(prev ?? []), still]);
          setScenes((prev) => [...prev, scene].slice(-12));
          // The new scene becomes the photo on every cover, in both shapes.
          applyDesign({ stillId: still.id });
        }}
      />}
    </div>
  );

  const colorRow = selected && (
    <div>
      <div className="eyebrow mb-2">Colors</div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Colors">
        <button type="button" onClick={() => applyDesign({ palette: undefined })} aria-pressed={!design.palette} className={cn("cursor-pointer rounded-full border px-3 py-1 text-[12px]", !design.palette ? "border-primary bg-brass-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>A mix</button>
        {[...(brand ? ["brand"] : []), ...PALETTES.map((p) => p.id)].map((id) => {
          const on = design.palette === id;
          return (
            <button key={id} onClick={() => applyDesign({ palette: id })} aria-pressed={on} className={cn("cursor-pointer rounded-full p-0.5 ring-offset-1 transition", on ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100")} title={paletteName(id)}>
              <Swatch id={id} brand={brand} large />
              <span className="sr-only">{paletteName(id)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{design.palette ? `Every option uses ${paletteName(design.palette).toLowerCase()}.` : "Each option comes in its own colors. Pick one to use it on all of them."}</p>
    </div>
  );

  const loading = (
    <p className="text-center text-[14px] text-muted-foreground">
      <LoaderCircle className="mr-1.5 inline size-3.5 animate-spin align-[-2px]" />
      {mode === "ai" && photoSet.length ? "Loading your photo set…" : "Finding your best frames…"}
    </p>
  );

  // ── Edit your cover: the photo and colors, shown on both shapes ──
  if (stage === 0) {
    return (
      <div className="space-y-6">
        {stepper}
        <div className="text-center">
          <h2 className="font-serif text-2xl">Edit your cover</h2>
          <p className="mx-auto mt-1 max-w-xl text-[14px] text-muted-foreground">Choose the photo and the colors. Both previews update as you go, and your choices carry into the next two steps, where you pick the short-form and the long-form cover.</p>
        </div>
        <CoverStyleSwitch value={mode} onChange={chooseMode} aiAvailable={aiAvailable} onManage={() => setShowSet(true)} />
        {!stills ? loading : (
          <div className="grid gap-6 rounded-2xl border border-border bg-card p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="flex items-end justify-center gap-4">
              {(["short", "long"] as VideoFormat[]).map((s) => {
                const k = pickOf(s);
                const src = previews[`${s}:${k}`];
                return (
                  <figure key={s} className={cn("min-w-0", s === "short" ? "w-[34%]" : "w-[62%]")}>
                    <div className={cn("relative overflow-hidden rounded-xl bg-muted shadow-soft", s === "short" ? "aspect-[9/16]" : "aspect-video")}>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={`${s === "short" ? "Short-form" : "Long-form"} preview`} className="absolute inset-0 h-full w-full object-cover" />
                      ) : <Skeleton className="absolute inset-0 rounded-none" />}
                    </div>
                    <figcaption className="mt-2 text-center text-[12px]"><span className="font-medium">{s === "short" ? "Short-form" : "Long-form"}</span> <span className="text-muted-foreground">{s === "short" ? "9:16" : "16:9"}</span></figcaption>
                  </figure>
                );
              })}
            </div>
            <div className="space-y-5">
              {photoStrip}
              {colorRow}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="rounded-full" onClick={onDone}>Skip covers <ArrowRight /></Button>
          <Button className="rounded-full px-6" disabled={!ready} onClick={() => setStage(1)}>Next: choose your short-form cover <ArrowRight /></Button>
        </div>
      </div>
    );
  }

  // ── Covers ready: what was chosen and what can be downloaded ──
  if (stage === 3) {
    const have = (["short", "long"] as VideoFormat[]).filter((s) => video.covers?.[s]);
    return (
      <div className="space-y-6">
        {stepper}
        <div className="text-center">
          <h2 className="font-serif text-2xl">{have.length === 2 ? "Both covers are ready" : have.length === 1 ? "Your cover is ready" : "No covers chosen"}</h2>
          <p className="mx-auto mt-1 max-w-xl text-[14px] text-muted-foreground">{have.length ? "Download them here, or later from the Post step. They’re saved with this video." : "You skipped both shapes. You can go back and choose one anytime."}</p>
        </div>
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          {(["short", "long"] as VideoFormat[]).map((s, n) => {
            const c = video.covers?.[s];
            const name = s === "short" ? "Short-form" : "Long-form";
            return (
              <div key={s} className="flex flex-col items-center rounded-2xl border border-border bg-card p-4 text-center">
                <div className="text-[13px] font-medium">{name} <span className="font-normal text-muted-foreground">{s === "short" ? "9:16 · Reels, TikTok, Shorts" : "16:9 · YouTube, LinkedIn"}</span></div>
                <div className={cn("relative mt-3 overflow-hidden rounded-xl bg-muted", s === "short" ? "aspect-[9/16] w-36" : "aspect-video w-full max-w-[300px]")}>
                  {c ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.url} alt={c.headline} className="absolute inset-0 h-full w-full object-cover" />
                  ) : <div className="absolute inset-0 flex items-center justify-center text-[12px] text-muted-foreground">Skipped</div>}
                </div>
                <div className="mt-auto pt-4">
                  {c ? (
                    <Button asChild variant="outline" className="rounded-full"><a href={c.url} download={fileOf(s)}><Download /> Download {s === "short" ? "9:16" : "16:9"} cover</a></Button>
                  ) : (
                    <Button variant="ghost" className="rounded-full" onClick={() => { setSkip((x) => ({ ...x, [s]: false })); setStage(n + 1); }}>Choose a {name.toLowerCase()} cover</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {intro && video.output && <CoverIntroSwitch intro={intro} />}
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="rounded-full" onClick={() => setStage(0)}><ArrowLeft /> Change the covers</Button>
          <Button className="rounded-full px-6" onClick={onDone}>Next: captions <ArrowRight /></Button>
        </div>
      </div>
    );
  }

  // ── 1. Choose your short-form cover · 2. Choose your long-form cover ──
  const name = vertical ? "short-form" : "long-form";
  const last = stage === 2;
  const next = (skipThis: boolean) => {
    const nextSkip = { ...skip, [shape]: skipThis };
    setSkip(nextSkip);
    if (last) void save(nextSkip);
    else setStage(2);
  };
  return (
    <div className="space-y-6">
      {stepper}
      <div className="text-center">
        <h2 className="font-serif text-2xl">{stage}. Choose your {name} cover</h2>
        <p className="mx-auto mt-1 max-w-xl text-[14px] text-muted-foreground">
          {vertical ? "9:16, for Reels, TikTok and Shorts." : "16:9, for YouTube and LinkedIn."} {last ? (skip.short ? "This is the one you’ll be able to download." : "Choosing this one too makes both covers available to download.") : "The long-form cover is next: choosing both makes both available to download."} Don’t need this shape? Skip it.
        </p>
      </div>
      {!stills ? loading : null}

      <div className={cn("grid gap-3 sm:gap-4", vertical ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 lg:grid-cols-3")}>
        {visible.map(({ o, k }) => {
          const src = previews[`${shape}:${k}`];
          const t = templateOf(shape, o.template);
          return (
            <button key={k} onClick={() => setPicks({ ...picks, [shape]: k })} aria-pressed={k === sel} className={cn("cursor-pointer rounded-2xl p-1 text-left transition-all sm:p-1.5", k === sel ? "bg-brass-soft ring-2 ring-primary" : "hover:bg-card")}>
              <div className={cn("relative overflow-hidden rounded-xl bg-muted", vertical ? "aspect-[9/16]" : "aspect-video")}>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={o.text.headline} className="absolute inset-0 h-full w-full animate-in object-cover duration-300 fade-in" />
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
        <Button variant="ghost" size="sm" className="rounded-full" disabled={busy} onClick={() => writeLines("Give me fresh options for each shape with different tactics.")}>
          <RefreshCw className={cn(busy && "animate-spin")} /> New words
        </Button>
        <span className="tnum text-[12px] text-muted-foreground">{W}×{H}</span>
      </div>

      {selected && ready && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="eyebrow">Words on this cover</div>
          <Input value={selected.text.headline} onChange={(e) => editSelected({ text: { headline: e.target.value } })} className="font-semibold" aria-label="Headline" />
          {selected.text.headline.trim().split(/\s+/).length > 3 && <p className="-mt-1 text-[12px] text-muted-foreground">Three words or fewer read best on a phone.</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-muted-foreground">Highlight</span>
            {selected.text.headline.split(/\s+/).filter(Boolean).map((w, i) => (
              <button
                key={i}
                onClick={() => editSelected({ text: { accent: w } })}
                className={cn("cursor-pointer rounded-full border px-2.5 py-0.5 text-[12px]", selected.text.accent.split(/\s+/).map(bare).includes(bare(w)) ? "border-primary bg-brass-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
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
                {TEMPLATES[shape].filter((t) => (isPickable(t) && !!t.noPhoto === noPhoto) || t.id === selected.template).map((t) => (
                  <option key={t.id} value={t.id}>{t.label}{isPickable(t) ? "" : " (older style)"}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setStage(0)} className="cursor-pointer text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground">Change the photo or colors</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="rounded-full" onClick={() => setStage(stage - 1)}><ArrowLeft /> {stage === 1 ? "Edit your cover" : "Short-form cover"}</Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" className="rounded-full" disabled={saving} onClick={() => next(true)}>Skip {name}</Button>
          <Button className="rounded-full px-6" disabled={saving || !ready} onClick={() => next(false)}>
            {saving ? <LoaderCircle className="animate-spin" /> : null} {saving ? "Saving covers…" : last ? `Use this ${name} cover` : "Use this cover · next: long-form"} {!saving && <ArrowRight />}
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

const SCENE_SETTINGS: [string | null, string][] = [
  [null, "Surprise me"],
  ["home", "Home office"],
  ["office", "Modern office"],
  ["study", "Study"],
  ["kitchen", "Kitchen table"],
  ["outdoors", "Outdoors"],
  ["boardroom", "Boardroom"],
];

/** The advisor's photo as a JPEG data URL, at most `max` px on the long side. */
function photoData(c: HTMLCanvasElement, max = 1280) {
  const k = Math.min(1, max / Math.max(c.width, c.height));
  const s = document.createElement("canvas");
  s.width = Math.round(c.width * k);
  s.height = Math.round(c.height * k);
  s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height);
  const url = s.toDataURL("image/jpeg", 0.9);
  s.width = s.height = 0;
  return url;
}

/** "Create an AI scene": a new photo of the advisor in a setting that fits the video, with room for the words. */
function AiScene({ video, shape, from, onScene }: { video: Video; shape: VideoFormat; from: Still; onScene: (still: Still, scene: Scene) => void }) {
  const [on, setOn] = React.useState<boolean | null>(null);
  const [setting, setSetting] = React.useState<string | null>(null);
  const [extra, setExtra] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    fetch("/api/covers/scene", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setOn(!!j.configured))
      .catch(() => setOn(false));
  }, []);
  if (!on) return null;

  const create = async () => {
    setBusy(true);
    try {
      const topic = (video.outline?.length ? video.outline : [video.script?.hook, ...(video.script?.body ?? [])]).filter(Boolean).slice(0, 4).join("; ");
      const res = await fetch("/api/covers/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photoData(from.canvas), shape, side: "right", setting, title: video.title, topic, extra: extra.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Couldn’t make the scene.");
      const still: Still = { ...(await stillFromImage(j.url, `a-${j.id}`, j.face)), source: "ai" };
      onScene(still, { id: j.id, url: j.url, shape, setting: j.setting, face: j.face ?? null, createdAt: new Date().toISOString() });
      toast.success("New scene ready", { description: "Check that it looks like you before you use it." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-dashed border-primary/50 bg-brass-soft/30 p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-medium"><Sparkles className="size-4 text-primary" /> AI scene</div>
      <p className="mt-0.5 text-[12px] text-muted-foreground">A new photo of you in a setting that fits this video, with room for the words. Made from the photo selected above.</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SCENE_SETTINGS.map(([id, l]) => (
          <button key={l} type="button" onClick={() => setSetting(id)} className={cn("cursor-pointer rounded-full border px-2.5 py-0.5 text-[12px]", setting === id ? "border-primary bg-brass-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      <Input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={200} placeholder="Anything to include? E.g. holding a tablet with a chart" className="mt-2.5 h-9 text-[13px]" aria-label="Anything to include" />
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <Button size="sm" className="rounded-full" disabled={busy} onClick={() => void create()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {busy ? "Creating… (about 15 seconds)" : `Create a ${shape === "short" ? "tall" : "wide"} scene`}
        </Button>
        <span className="text-[11px] text-muted-foreground">AI-made: check the face, hands and any chart before posting.</span>
      </div>
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
    s.width = s.height = 0;
  }, [still]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null;
}
