import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claudeConfigured } from "@/lib/ai/claude";
import type { TimedWord } from "./ass";
import { FULL_SCREEN, GRAPHIC_KINDS, ICONS, durationFor, type Graphic, type GraphicKind } from "./graphics";

/**
 * Where the motion graphics go and what they say. Claude reads the transcript
 * and turns what's said into a chart, a checklist, a comparison, a timeline, a
 * section card, a quote card, a figure that counts up or an icon, spread
 * through the video so something changes on screen every few seconds. Every
 * figure comes from the video itself; charts without spoken figures are marked
 * illustrative. The fallback (no Claude) counts up the figures it hears.
 */

const MODEL = "claude-opus-5-5";

const GraphicSchema = z.object({
  kind: z.enum(GRAPHIC_KINDS),
  word: z.number().int().describe("Index of the word where the graphic starts (from the [n] markers)"),
  title: z.string().nullable().describe("Headline for the card, at most 6 words (chart, list, compare, timeline, title)"),
  kicker: z.string().nullable().describe("1–4 word label above the title, or null"),
  items: z.array(z.string()).nullable().describe("list: 2–5 points, at most 5 words each"),
  bars: z
    .array(z.object({ label: z.string().describe("At most 3 words"), value: z.number(), display: z.string().nullable().describe('How the value reads, e.g. "22%", "$7,000"') }))
    .nullable()
    .describe("chart: 2–5 bars"),
  illustrative: z.boolean().nullable().describe("chart: true when the heights show a relationship rather than figures said in the video"),
  left: z.object({ label: z.string(), items: z.array(z.string()) }).nullable().describe("compare: the first option, 1–3 short points"),
  right: z.object({ label: z.string(), items: z.array(z.string()) }).nullable().describe("compare: the second option, 1–3 short points"),
  points: z.array(z.object({ label: z.string().describe("An age, year or short date"), note: z.string().nullable().describe("At most 3 words") })).nullable().describe("timeline: 2–5 points in order"),
  number: z.object({ value: z.number(), prefix: z.string().nullable(), suffix: z.string().nullable(), label: z.string().describe("At most 6 words") }).nullable().describe("stat: a figure said in the video"),
  quote: z.string().nullable().describe("quote: the key line, close to how it was said, at most 16 words"),
  icon: z.enum(ICONS).nullable().describe("callout: the icon"),
  label: z.string().nullable().describe("callout: 1–3 words beside the icon"),
});
const GraphicsSchema = z.object({ graphics: z.array(GraphicSchema) });

export type GraphicsAmount = "light" | "rich";

const str = (v: string | null | undefined, max: number) => (v ?? "").trim().slice(0, max) || undefined;

/** Turn Claude's picks into graphics on the timeline: checked, timed and spaced. */
function place(raw: z.infer<typeof GraphicSchema>[], words: TimedWord[], dur: number, kinds: GraphicKind[], endAt: number): Graphic[] {
  const out: Graphic[] = [];
  for (const r of raw) {
    if (!kinds.includes(r.kind) || !Number.isInteger(r.word) || r.word < 0 || r.word >= words.length) continue;
    const g: Graphic = {
      kind: r.kind,
      at: words[r.word].start,
      dur: 0,
      title: str(r.title, 60),
      kicker: str(r.kicker, 32),
      items: r.items?.map((x) => x.trim().slice(0, 48)).filter(Boolean).slice(0, 5),
      bars: r.bars?.filter((b) => Number.isFinite(b.value) && b.value >= 0 && b.label.trim()).slice(0, 5).map((b) => ({ label: b.label.trim().slice(0, 24), value: b.value, display: str(b.display, 12) })),
      illustrative: !!r.illustrative,
      left: r.left ? { label: r.left.label.trim().slice(0, 24), items: r.left.items.map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 3) } : undefined,
      right: r.right ? { label: r.right.label.trim().slice(0, 24), items: r.right.items.map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 3) } : undefined,
      points: r.points?.filter((p) => p.label.trim()).slice(0, 5).map((p) => ({ label: p.label.trim().slice(0, 14), note: str(p.note, 28) })),
      number: r.number && Number.isFinite(r.number.value) ? { value: r.number.value, prefix: str(r.number.prefix, 3), suffix: str(r.number.suffix, 4), decimals: Number.isInteger(r.number.value) ? 0 : 1, label: r.number.label.trim().slice(0, 48) } : undefined,
      quote: str(r.quote, 140),
      icon: r.icon ?? undefined,
      label: str(r.label, 24),
    };
    // Each kind needs its content; drop any that came back without it.
    const ok =
      (g.kind === "title" && !!g.title) ||
      (g.kind === "quote" && !!g.quote) ||
      (g.kind === "list" && (g.items?.length ?? 0) >= 2) ||
      (g.kind === "chart" && (g.bars?.length ?? 0) >= 2) ||
      (g.kind === "compare" && !!g.left && !!g.right) ||
      (g.kind === "timeline" && (g.points?.length ?? 0) >= 2) ||
      (g.kind === "stat" && !!g.number?.label) ||
      (g.kind === "callout" && !!g.icon);
    if (!ok) continue;
    g.dur = durationFor(g);
    out.push(g);
  }
  return space(out, dur, endAt);
}

/** In order, never overlapping, clear of the start and the end card, and no more than ~40% of the video covered by cutaways. */
function space(gs: Graphic[], dur: number, endAt: number): Graphic[] {
  const out: Graphic[] = [];
  let covered = 0;
  for (const g of [...gs].sort((a, b) => a.at - b.at)) {
    const at = Math.max(g.at, 1.2, out.length ? out.at(-1)!.at + out.at(-1)!.dur + 0.8 : 0);
    const d = Math.min(g.dur, endAt - 0.3 - at);
    if (d < Math.min(1.6, g.dur)) continue;
    const full = FULL_SCREEN.includes(g.kind);
    if (full && covered + d > dur * 0.4) continue;
    if (full) covered += d;
    out.push({ ...g, at, dur: d });
  }
  return out;
}

/** Without Claude: the figures said in the video count up on a panel. */
function fallback(words: TimedWord[], dur: number, kinds: GraphicKind[], endAt: number): Graphic[] {
  if (!kinds.includes("stat")) return [];
  const gs: Graphic[] = [];
  words.forEach((w, i) => {
    const m = /^(\$)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(%|k|K)?[.,!?]?$/.exec(w.text);
    if (!m) return;
    const value = Number(m[2].replace(/,/g, ""));
    if (!Number.isFinite(value) || (value < 10 && !m[1] && !m[3])) return;
    const label = words.slice(i + 1, i + 6).map((x) => x.text).join(" ").replace(/[.,!?]+$/, "");
    gs.push({ kind: "stat", at: w.start, dur: durationFor({ kind: "stat" }), number: { value, prefix: m[1], suffix: m[3]?.toUpperCase() === "K" ? "K" : m[3], label: label.slice(0, 40) } });
  });
  return space(gs.slice(0, Math.max(1, Math.floor(dur / 12))), dur, endAt);
}

export async function pickGraphics(words: TimedWord[], dur: number, opts: { kinds: GraphicKind[]; amount: GraphicsAmount; endAt: number }): Promise<Graphic[]> {
  const kinds = opts.kinds.length ? opts.kinds : [...GRAPHIC_KINDS];
  if (words.length < 8 || dur < 8) return [];
  if (!claudeConfigured()) return fallback(words, dur, kinds, opts.endAt);
  const want = Math.max(1, Math.min(opts.amount === "rich" ? 10 : 5, Math.round(dur / (opts.amount === "rich" ? 7 : 14))));
  try {
    const marked = words.map((w, i) => `[${i}]${w.text}`).join(" ");
    const client = new Anthropic();
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 6000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(GraphicsSchema) },
      system:
        "You are a motion-graphics editor for financial advisors' social videos. You turn what the advisor says into on-screen graphics that keep viewers watching: charts, checklists, comparisons, timelines, section cards, quote cards, figures that count up and icons. Accurate and compliant: every number on screen is one the advisor said; no invented statistics, no promises of returns, no hype.",
      messages: [
        {
          role: "user",
          content: `Transcript of a ${Math.round(dur)}-second video, each word marked with its index:

${marked}

Plan about ${want} graphics, spread evenly through the video so something new appears every few seconds. Use only these kinds: ${kinds.join(", ")}. Vary them; don't use the same kind twice in a row.
- stat: a figure the advisor says (a dollar amount, a percentage, an age), counting up, with a short label of what it is.
- chart: 2–5 bars comparing figures said in the video. If no figures are said but there's a clear comparison (taxes now vs later), use relative heights and set illustrative true.
- list: steps or points the advisor walks through, at most 5 words each.
- compare: two options side by side (Roth vs traditional, now vs later), 1–3 short points each.
- timeline: ages or dates in order (59½, 65, 73…), with a short note for each.
- title: a section card at a turn in the video ("Step 2", "The mistake", "What to do"), 2–5 words.
- quote: the single most quotable line, close to how it was said.
- callout: an icon that matches the point (up, down, warning, check, calendar, dollar, clock, house, shield, idea) with 1–3 words.
Start each graphic at the word where that point begins (not in the first second, not in the last 4 seconds). Keep cutaways (chart, list, compare, timeline, title, quote) under 40% of the running time in total.`,
        },
      ],
    });
    const placed = place(res.parsed_output?.graphics ?? [], words, dur, kinds, opts.endAt);
    return placed.length ? placed : fallback(words, dur, kinds, opts.endAt);
  } catch (e) {
    console.warn("[video] couldn't plan graphics with Claude, using the fallback:", (e as Error).message);
    return fallback(words, dur, kinds, opts.endAt);
  }
}
