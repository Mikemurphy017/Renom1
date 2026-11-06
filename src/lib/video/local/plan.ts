import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { secretsConfigured, sign } from "@/lib/secrets";
import { getJSON, putJSON } from "@/lib/storage/objects";
import { claudeConfigured } from "@/lib/ai/claude";
import { isMediaId } from "@/lib/storage/media";
import { pickBeats } from "./beats";
import { pickGraphics } from "./graphics-pick";
import { GRAPHIC_KINDS, type Graphic } from "./graphics";
import { stockFootageEnabled } from "./broll";
import type { Beat, TimedWord } from "./ass";
import { getStyle, normalizeOverlays } from "../styles";
import { endCardStart, graphicContent, newPlanId, stableStringify, type EditPlan, type PlanBeat, type PlanGraphic } from "../storyboard";
import type { OverlayOptions } from "../types";

/**
 * The planning half of the render: which moments get a keyword card, a
 * punch-in, a cutaway and a sound effect, and which motion graphics go where.
 * Runs on its own for the storyboard (no rendering), and the render reuses the
 * approved plan instead of deciding again. Server-only.
 */

/** An earlier plan and the advisor's request, for a re-plan. */
export interface PlanHint {
  instruction: string;
  previous?: string;
}

/** The earlier plan in a few lines, for the re-plan prompt. */
export function describePlan(p: Pick<EditPlan, "beats" | "graphics">): string {
  const lines = [
    ...p.beats.map((b) => `- moment at ${b.at.toFixed(1)}s: "${b.keyword}"${b.broll ? ` with a b-roll cutaway (${b.query})` : ""}`),
    ...p.graphics.map((g) => `- ${g.kind} graphic at ${g.at.toFixed(1)}s: ${graphicContent(g)}`),
  ];
  return lines.join("\n") || "- (nothing)";
}

/**
 * Plan the moments and graphics for the edited words. Moments never run into
 * the end card and make way for the graphics: no zoom, card or cutaway while
 * one is up.
 */
export async function planMoments(words: TimedWord[], outDur: number, overlays: OverlayOptions, hint?: PlanHint): Promise<{ beats: Beat[]; graphics: Graphic[] }> {
  const ov = normalizeOverlays(overlays);
  const st = getStyle(ov.captions.style);
  const ex = ov.extras;
  const wantsBeats = (ex.keywordCards && !!st.card) || ex.motion || ex.broll || ex.sfx;
  const endCardAt = endCardStart(ov, outDur);
  const [rawBeats, graphics] = await Promise.all([
    wantsBeats ? pickBeats(words, outDur, ex.broll, hint) : Promise.resolve([] as Beat[]),
    ex.graphics ? pickGraphics(words, outDur, { kinds: ex.graphicKinds?.length ? ex.graphicKinds : [...GRAPHIC_KINDS], amount: ex.graphicsAmount ?? "light", endAt: endCardAt, hint }) : Promise.resolve([] as Graphic[]),
  ]);
  const underGraphic = (a: number, b: number) => graphics.some((g) => a < g.at + g.dur + 0.3 && b > g.at - 0.3);
  const beats = rawBeats
    .filter((b) => endCardAt - b.at >= 0.8)
    .map((b) => ({ ...b, dur: Math.min(b.dur, endCardAt - b.at) }))
    .filter((b) => !underGraphic(b.at, b.at + b.dur));
  return { beats, graphics };
}

const SIG_PURPOSE = "edit-plan";
const unsigned = (p: EditPlan) => stableStringify({ ...p, sig: undefined });

/**
 * Plans are signed with SECRETS_KEY when it's set. Without it, with a random
 * key made once and kept in storage, so signatures survive a restart.
 */
let fallbackKey: Promise<string> | null = null;
function storedKey() {
  fallbackKey ??= (async () => {
    const saved = await getJSON<{ key: string }>("meta/editplankey.json");
    if (saved?.key && /^[a-f0-9]{64}$/.test(saved.key)) return saved.key;
    const key = randomBytes(32).toString("hex");
    await putJSON("meta/editplankey.json", { key });
    return key;
  })().catch((e) => {
    fallbackKey = null;
    throw e;
  });
  return fallbackKey;
}
async function hmac(data: string) {
  if (secretsConfigured()) return sign(SIG_PURPOSE, data);
  return createHmac("sha256", await storedKey()).update(`${SIG_PURPOSE}:${data}`).digest("hex");
}

export async function signPlan(p: Omit<EditPlan, "sig">): Promise<EditPlan> {
  const plan = { ...p, sig: "" } as EditPlan;
  return { ...plan, sig: await hmac(unsigned(plan)) };
}

/** True when the plan is one this server made, unchanged. */
export async function verifyPlan(p: EditPlan): Promise<boolean> {
  if (!p || typeof p !== "object" || typeof p.sig !== "string" || !/^[a-f0-9]{64}$/.test(p.sig)) return false;
  try {
    const want = Buffer.from(await hmac(unsigned(p)), "hex");
    const got = Buffer.from(p.sig, "hex");
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}

/** A full plan, signed: the moments (with where each cutaway's footage will come from) and the graphics. */
export async function makePlan(o: { key: string; words: TimedWord[]; outDur: number; overlays: OverlayOptions; hint?: PlanHint }): Promise<EditPlan> {
  const ov = normalizeOverlays(o.overlays);
  const { beats, graphics } = await planMoments(o.words, o.outDur, ov, o.hint);
  // Where the render will find footage: the advisor's library first, then stock when it's set up. Without either, no cutaway.
  const library = ov.extras.brollMedia.filter(isMediaId).length > 0;
  const source = library ? "library" : stockFootageEnabled() ? "stock" : undefined;
  const planBeats: PlanBeat[] = beats.map((b, i) => {
    const cut = ov.extras.broll && !!b.broll && !!source;
    return { id: `m${i + 1}`, at: round(b.at), dur: round(b.dur), keyword: b.keyword, ...(cut ? { broll: true, query: b.query ?? b.keyword, brollSource: source } : { broll: false }) };
  });
  const planGraphics: PlanGraphic[] = graphics.map((g, i) => ({ ...g, at: round(g.at), dur: round(g.dur), id: `g${i + 1}` }));
  return signPlan({
    v: 1,
    id: newPlanId(),
    key: o.key,
    outDur: round(o.outDur),
    beats: planBeats,
    graphics: planGraphics,
    instruction: o.hint?.instruction,
    ai: claudeConfigured(),
    createdAt: new Date().toISOString(),
  });
}

const round = (n: number) => Math.round(n * 1000) / 1000;
