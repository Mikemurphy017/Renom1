/**
 * The storyboard: what the render will put on screen, scene by scene, before
 * anything is rendered. Shared by the browser (Edit step) and the server.
 *
 * The server plans the edit once (the big moments, the motion graphics, which
 * moments cut away to b-roll) and signs that plan. The advisor reviews it as a
 * storyboard, may drop elements or ask for a re-plan, and approves it. The
 * render is then given that exact plan and reuses it instead of deciding again,
 * so the approved storyboard and the finished video match.
 */

import type { Beat, TimedWord } from "./local/ass";
import type { Graphic } from "./local/graphics";
import type { Aspect, OverlayOptions, TimeRange, TranscriptWord } from "./types";
import { getStyle, normalizeOverlays, MUSIC_CHOICES } from "./styles";
import { CAPTION_CASES, CAPTION_HIGHLIGHTS, captionCase, captionHighlight } from "./caption-look";
import { FULL_SCREEN, GRAPHIC_LABELS } from "./graphic-kinds";

// ── the plan ─────────────────────────────────────────────────────────────────

/** A big moment: where a keyword card, a punch-in, a b-roll cutaway and a sound effect land. */
export interface PlanBeat extends Beat {
  id: string;
  /** Where the cutaway's footage comes from (only set when the moment cuts away). */
  brollSource?: "library" | "stock";
}

export type PlanGraphic = Graphic & { id: string };

export interface EditPlan {
  v: 1;
  id: string;
  /** Fingerprint of what the plan was made from (take, cuts, style and extras); see planKey. */
  key: string;
  /** Length of the edited video, seconds. */
  outDur: number;
  beats: PlanBeat[];
  graphics: PlanGraphic[];
  /** The plain-words change the advisor asked for, if this plan is a re-plan. */
  instruction?: string;
  /** Whether the AI planned it (false: the built-in rules did). */
  ai: boolean;
  createdAt: string;
  /** Server signature over everything above. */
  sig: string;
}

/** What the video keeps of a plan: the plan, what the advisor switched off, and the approval. */
export interface StoredStoryboard {
  plan: EditPlan;
  /** planKey of the advisor's own choices when it was planned (before any plan-tier limits). */
  inputKey: string;
  /** Element ids (moments, graphics) the advisor removed. */
  disabled: string[];
  approval?: { at: string; lookKey: string; by: "advisor" | "auto" };
}

export type StoryboardState = "none" | "stale" | "unapproved" | "approved";

/** Sent with a render: the approved plan. */
export interface ApprovedPlan {
  plan: EditPlan;
  disabled: string[];
  approvedAt: string;
}

export const newPlanId = () => `pl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ── fingerprints ─────────────────────────────────────────────────────────────

/** JSON with sorted keys, so the same value always reads the same. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : stableStringify(x))).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}

/** Two FNV-1a passes: a short, stable fingerprint (not a security measure; the plan's signature is). */
export function fingerprint(s: string) {
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x2f9be6cc);
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Everything the plan depends on. When any of it changes, the storyboard has to be planned again. */
export function planKey(i: { sourceId: string; aspect: Aspect; cuts: TimeRange[]; overlays: OverlayOptions }) {
  const ov = normalizeOverlays(i.overlays);
  const { music: _m, musicVolume: _v, ...ex } = ov.extras;
  void _m;
  void _v;
  return fingerprint(
    stableStringify({
      s: i.sourceId,
      a: i.aspect,
      c: [...i.cuts].sort((a, b) => a.start - b.start).map((c) => [r3(c.start), r3(c.end)]),
      st: ov.captions.style,
      ex: { ...ex, graphicKinds: ex.graphicKinds ? [...ex.graphicKinds].sort() : undefined, brollMedia: [...ex.brollMedia] },
      end: ov.endCard.enabled,
    })
  );
}

/** Everything else on screen. A change here keeps the plan but needs a fresh approval. */
export function lookKey(overlays: OverlayOptions, disabled: string[]) {
  return fingerprint(stableStringify({ o: normalizeOverlays(overlays), d: [...disabled].sort() }));
}

export function storyboardState(sb: StoredStoryboard | undefined, inputKey: string, look: OverlayOptions): StoryboardState {
  if (!sb) return "none";
  if (sb.inputKey !== inputKey) return "stale";
  if (!sb.approval || sb.approval.lookKey !== lookKey(look, sb.disabled)) return "unapproved";
  return "approved";
}

// ── the edited timeline ──────────────────────────────────────────────────────

/** What stays, as ranges of the source. */
export function keepRanges(cuts: TimeRange[], dur: number): TimeRange[] {
  const sorted = cuts
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(dur, c.end) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);
  const keep: TimeRange[] = [];
  let t = 0;
  for (const c of sorted) {
    if (c.start > t) keep.push({ start: t, end: c.start });
    t = Math.max(t, c.end);
  }
  if (dur > t) keep.push({ start: t, end: dur });
  return keep.filter((k) => k.end - k.start >= 0.05);
}

/** Source time → time in the edited video (null if it was cut). */
export function remap(keep: TimeRange[], t: number): number | null {
  let acc = 0;
  for (const k of keep) {
    if (t < k.start) return null;
    if (t <= k.end) return acc + (t - k.start);
    acc += k.end - k.start;
  }
  return null;
}

/** Time in the edited video → source time (for stills from the take). */
export function toSource(keep: TimeRange[], t: number): number {
  let acc = 0;
  for (const k of keep) {
    const len = k.end - k.start;
    if (t <= acc + len) return k.start + Math.max(0, t - acc);
    acc += len;
  }
  return keep.at(-1)?.end ?? t;
}

/** Where the edit jumps: the edited-timeline time of each join between kept parts. */
export function joins(keep: TimeRange[]): number[] {
  const out: number[] = [];
  let acc = 0;
  keep.forEach((k, i) => {
    acc += k.end - k.start;
    if (i < keep.length - 1) out.push(acc);
  });
  return out;
}

/**
 * The words in the edited timeline. A word that starts a hair inside a trimmed
 * pause (recognizers stamp words a little early) starts where the kept part
 * begins instead of being dropped.
 */
export function editedWords(transcript: TranscriptWord[], keep: TimeRange[]): TimedWord[] {
  return transcript
    .map((w) => {
      const end = remap(keep, w.end);
      const start = remap(keep, w.start) ?? (end !== null ? remap(keep, keep.find((k) => k.start > w.start && k.start < w.end)?.start ?? -1) : null);
      return { text: w.text, start, end };
    })
    .filter((w): w is TimedWord => w.start !== null && w.end !== null && w.end > w.start);
}

/** When the end card comes up (the plan keeps every moment and graphic clear of it). */
export const endCardStart = (ov: OverlayOptions, outDur: number) => (ov.endCard.enabled && outDur >= 6 ? outDur - 3 : outDur);

/** The plan with the advisor's removals applied: what the render will use. */
export function activePlan(plan: Pick<EditPlan, "beats" | "graphics">, disabled: string[]) {
  const off = new Set(disabled);
  return { beats: plan.beats.filter((b) => !off.has(b.id)), graphics: plan.graphics.filter((g) => !off.has(g.id)) };
}

// ── the storyboard the advisor reads ─────────────────────────────────────────

export type ElementKind = "caption" | "card" | "zoom" | "broll" | "graphic" | "lowerThird" | "endCard" | "sfx";

export interface SceneElement {
  /** Plan element id when it can be removed on its own (moments, graphics). */
  id?: string;
  kind: ElementKind;
  /** Seconds into the edited video. */
  at: number;
  until: number;
  label: string;
  detail?: string;
  off?: boolean;
}

export interface Scene {
  n: number;
  start: number;
  end: number;
  /** Source time for a still from the take. */
  stillAt: number;
  /** What's said. */
  spoken: string;
  /** The words lit in the highlight color in this scene. */
  highlighted: string[];
  /** A full-screen graphic, b-roll or the end card covers the speaker for part of the scene. */
  covered?: string;
  elements: SceneElement[];
  transition: string;
}

export interface StoryboardSummary {
  totalSec: number;
  style: string;
  styleNote: string;
  captions: string;
  music: string;
  sound: string;
  grade: string;
  intro: string;
  counts: { moments: number; graphics: number; broll: number; zooms: number };
}

const PALETTE_NAMES = ["navy", "royal blue", "deep green", "plum", "red", "black"];
const CARD_LABEL = { headline: "Glowing headline", backdrop: "Giant word behind you", banner: "Keyword banner", chip: "Keyword chip" } as const;

/** The motion graphic's content in a line. */
export function graphicContent(g: Graphic): string {
  switch (g.kind) {
    case "stat":
      return g.number ? `${g.number.prefix ?? ""}${g.number.value.toLocaleString("en-US")}${g.number.suffix ?? ""} counts up: ${g.number.label}` : "";
    case "chart":
      return `${g.title ? `${g.title}: ` : ""}${(g.bars ?? []).map((b) => `${b.label} ${b.display ?? b.value}`).join(" · ")}${g.illustrative ? " (illustrative)" : ""}`;
    case "list":
      return `${g.title ? `${g.title}: ` : ""}${(g.items ?? []).join(" · ")}`;
    case "compare":
      return `${g.left?.label ?? ""} vs ${g.right?.label ?? ""}${g.title ? ` (${g.title})` : ""}`;
    case "timeline":
      return `${g.title ? `${g.title}: ` : ""}${(g.points ?? []).map((p) => `${p.label}${p.note ? ` ${p.note}` : ""}`).join(" → ")}`;
    case "title":
      return `${g.kicker ? `${g.kicker} · ` : ""}${g.title ?? ""}`;
    case "quote":
      return `“${g.quote ?? ""}”`;
    case "callout":
      return `${g.icon ?? ""} icon${g.label ? `: ${g.label}` : ""}`;
  }
}

const normWord = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");

/**
 * The storyboard for a plan and the current look, scene by scene. Mirrors what
 * render.ts and ass.ts do with the same plan: the same moments, graphics,
 * zooms, cutaways, captions, name title, end card, music and sound effects.
 */
export function buildStoryboard(o: {
  plan: Pick<EditPlan, "beats" | "graphics" | "outDur">;
  disabled: string[];
  overlays: OverlayOptions;
  transcript: TranscriptWord[];
  keyPhrases: string[];
  cuts: TimeRange[];
  sourceDur: number;
  enhanceAudio: boolean;
  coverIntro: boolean;
  musicName?: string;
}): { scenes: Scene[]; summary: StoryboardSummary } {
  const ov = normalizeOverlays(o.overlays);
  const st = getStyle(ov.captions.style);
  const ex = ov.extras;
  const keep = keepRanges(o.cuts, o.sourceDur);
  const outDur = keep.reduce((a, k) => a + (k.end - k.start), 0) || o.plan.outDur;
  const words = editedWords(o.transcript, keep);
  const off = new Set(o.disabled);
  const { beats, graphics } = activePlan(o.plan, o.disabled);
  const ec = ov.endCard;
  const endAt = ec.enabled && outDur >= 6 && (ec.headline.trim() || ec.cta.trim()) ? outDur - 3 : Infinity;
  const cards = ex.keywordCards && !!st.card;
  const broll = (b: PlanBeat) => ex.broll && !!b.broll && !!b.brollSource;
  const zoomed = (b: PlanBeat) => ex.motion && !broll(b);
  const keyWords = new Set([...(ov.keyPhrases ? o.keyPhrases : []), ...beats.map((b) => b.keyword)].flatMap((k) => k.split(/\s+/).map(normWord)).filter(Boolean));

  // Sound effects as the render places them: the first 8 moments, the first 10 graphics.
  const sfxAt = new Map<string, string>();
  if (ex.sfx) {
    beats.slice(0, 8).forEach((b) => sfxAt.set(b.id, broll(b) ? "whoosh" : st.card === "backdrop" ? "hit" : st.card === "headline" ? "whoosh" : "pop"));
    graphics.slice(0, 10).forEach((g) => sfxAt.set(g.id, g.kind === "callout" || g.kind === "stat" ? "pop" : "whoosh"));
  }

  // Every element on the timeline, including the ones the advisor switched off (shown struck through).
  const els: SceneElement[] = [];
  for (const b of o.plan.beats) {
    const isOff = off.has(b.id);
    const until = Math.min(b.at + b.dur, endAt);
    if (broll(b)) els.push({ id: b.id, kind: "broll", at: b.at, until, label: "B-roll cutaway", detail: b.brollSource === "library" ? "A photo or clip from your library, 0.2 s fades" : `Stock footage: “${b.query || b.keyword}”, 0.2 s fades`, off: isOff });
    if (cards) els.push({ id: b.id, kind: "card", at: b.at, until, label: CARD_LABEL[st.card!], detail: `“${b.keyword.toUpperCase()}”`, off: isOff });
    if (zoomed(b)) els.push({ id: b.id, kind: "zoom", at: b.at, until: Math.min(outDur, b.at + Math.max(1.6, b.dur + 0.4)), label: "Punch-in zoom", detail: "12% in over 0.12 s, then holds", off: isOff });
    if (!cards && !broll(b) && !zoomed(b) && ex.sfx) els.push({ id: b.id, kind: "sfx", at: b.at, until, label: "Moment", detail: `“${b.keyword}”`, off: isOff });
    const fx = sfxAt.get(b.id);
    if (fx && !isOff) els.push({ kind: "sfx", at: b.at, until: b.at + 0.5, label: `Sound: ${fx}` });
  }
  const gIndex = new Map(graphics.map((g, i) => [g.id, i]));
  for (const g of o.plan.graphics) {
    const isOff = off.has(g.id);
    const full = FULL_SCREEN.includes(g.kind);
    const i = gIndex.get(g.id);
    els.push({
      id: g.id,
      kind: "graphic",
      at: g.at,
      until: g.at + g.dur,
      label: `${GRAPHIC_LABELS[g.kind].label.replace(/s$/, "")}${full ? " (full screen)" : " (over the video)"}`,
      detail: `${graphicContent(g)}${i !== undefined ? ` · on ${PALETTE_NAMES[i % PALETTE_NAMES.length]}` : ""}`,
      off: isOff,
    });
    const fx = sfxAt.get(g.id);
    if (fx && !isOff) els.push({ kind: "sfx", at: g.at, until: g.at + 0.5, label: `Sound: ${fx}` });
  }
  const lt = ov.lowerThird;
  if (lt.enabled && lt.name.trim() && outDur > 3) {
    const who = [lt.name.trim(), lt.credentials.trim()].filter(Boolean).join(", ");
    els.push({ kind: "lowerThird", at: 0.4, until: Math.min(4.6, outDur - 0.5), label: "Name title, bottom left", detail: `${who}${lt.firm.trim() ? ` · ${lt.firm.trim()}` : ""}` });
  }

  // Scenes: what's said, sentence by sentence (3–10 s each), then the end card.
  const speechEnd = Math.min(outDur, endAt);
  const bounds: number[] = [0];
  let last = 0;
  words.forEach((w, i) => {
    const next = words[i + 1];
    if (!next || next.start >= speechEnd) return;
    const len = next.start - last;
    const sentenceEnd = /[.!?]["”]?$/.test(w.text);
    if ((sentenceEnd && len >= 3) || len >= 10) {
      bounds.push(next.start);
      last = next.start;
    }
  });
  if (speechEnd - last < 1.5 && bounds.length > 1) bounds.pop();
  bounds.push(speechEnd);
  const cutsAt = joins(keep);
  const fullWindows = graphics.filter((g) => FULL_SCREEN.includes(g.kind)).map((g) => ({ a: g.at, b: g.at + g.dur, g }));

  const capLook = `${CAPTION_CASES.find((c) => c.id === captionCase(ov.captions))?.label ?? ""} · ${CAPTION_HIGHLIGHTS.find((h) => h.id === captionHighlight(ov.captions))?.label ?? ""} highlight · ${ov.captions.position}`;
  const scenes: Scene[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    if (b - a < 0.05) continue;
    const said = words.filter((w) => w.start >= a - 0.01 && w.start < b);
    const inScene = els.filter((e) => e.at >= a - 0.01 && e.at < b).sort((x, y) => x.at - y.at);
    // The name title is part of the first scene only.
    const elements = inScene;
    if (ov.captions.enabled && said.length) {
      const hiddenUnder = fullWindows.filter((w) => w.a < b && w.b > a);
      elements.unshift({ kind: "caption", at: Math.max(a, said[0].start), until: Math.min(b, said.at(-1)!.end), label: `${st.name} captions`, detail: `${capLook}${hiddenUnder.length ? " · hidden while a full-screen graphic is up" : ""}` });
    }
    const coveredBy = [
      ...fullWindows.filter((w) => w.a < b && w.b > a).map((w) => `${GRAPHIC_LABELS[w.g.kind].label.replace(/s$/, "").toLowerCase()} ${fmt(w.a)}–${fmt(Math.min(w.b, outDur))}`),
      ...beats.filter((x) => broll(x) && x.at < b && x.at + x.dur > a).map((x) => `b-roll ${fmt(x.at)}–${fmt(x.at + x.dur)}`),
    ];
    const nextStart = b;
    const nextFull = fullWindows.find((w) => Math.abs(w.a - nextStart) < 0.6);
    const jump = cutsAt.find((c) => Math.abs(c - nextStart) < 0.35);
    const isLast = i === bounds.length - 2;
    const transition = isLast
      ? endAt !== Infinity
        ? "Fades to the end card (0.3 s)"
        : "Video ends"
      : nextFull
        ? `${nextFull.g.kind === "title" ? "Full-screen color wipe" : "Graphic slides in"} to the ${GRAPHIC_LABELS[nextFull.g.kind].label.replace(/s$/, "").toLowerCase()}`
        : jump !== undefined
          ? "Jump cut (a pause or retake removed)"
          : "Straight on (same shot)";
    const hl = [...new Set(said.filter((w) => keyWords.has(normWord(w.text))).map((w) => w.text.replace(/[.,!?;:"“”]+$/g, "")))];
    scenes.push({ n: scenes.length + 1, start: a, end: b, stillAt: toSource(keep, Math.min(b - 0.05, a + Math.min(1, (b - a) / 2))), spoken: said.map((w) => w.text).join(" "), highlighted: hl, covered: coveredBy.length ? coveredBy.join(", ") : undefined, elements, transition });
  }
  if (endAt !== Infinity) {
    scenes.push({
      n: scenes.length + 1,
      start: endAt,
      end: outDur,
      stillAt: toSource(keep, Math.max(0, outDur - 1)),
      spoken: words.filter((w) => w.start >= endAt).map((w) => w.text).join(" "),
      highlighted: [],
      covered: "end card (navy, 90% opaque over the video)",
      elements: [{ kind: "endCard", at: endAt, until: outDur, label: "End card", detail: `${ec.headline.trim()}${ec.cta.trim() ? ` · ${ec.cta.trim()}` : ""}` }],
      transition: "Video ends",
    });
  }

  const music = ex.music === "none" ? "No music" : ex.music.startsWith("media:") ? `${o.musicName ?? "Your uploaded track"}` : `${MUSIC_CHOICES.find((m) => m.id === ex.music)?.label ?? ex.music} bed`;
  return {
    scenes,
    summary: {
      totalSec: Math.round(outDur * 10) / 10,
      style: st.name,
      styleNote: st.description,
      captions: ov.captions.enabled ? `${st.name} captions, ${capLook}` : "No captions",
      music: ex.music === "none" ? music : `${music} at ${Math.round(ex.musicVolume * 100)}%, dipping under your voice, fading out over the last 1.5 s`,
      sound: `${o.enhanceAudio ? "Studio sound (noise reduction, EQ, leveled to -14 LUFS)" : "Your original sound, limited"}${ex.sfx ? ", with sound effects on the moments and graphics" : ""}`,
      grade: "Natural: the take’s own color, framed and cropped to fit. No color grade is applied.",
      intro: o.coverIntro ? "Your cover holds for half a second at the very start, once you pick one in Review." : "No cover intro.",
      counts: {
        moments: beats.length,
        graphics: graphics.length,
        broll: beats.filter(broll).length,
        zooms: beats.filter(zoomed).length,
      },
    },
  };
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
};
export const fmtStamp = fmt;
