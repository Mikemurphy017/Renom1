import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claudeConfigured } from "@/lib/ai/claude";
import type { Beat, TimedWord } from "./ass";
import { normWord } from "./ass";

/**
 * The big moments of a video: where a keyword card, a punch-in, a b-roll
 * cutaway and a whoosh land. Claude reads the transcript and picks them; the
 * fallback picks numbers and strong words spaced through the video.
 */

const MODEL = "claude-opus-5-5";

const BeatsSchema = z.object({
  moments: z.array(
    z.object({
      word: z.number().int().describe("Index of the word where the moment lands (from the [n] markers)"),
      keyword: z.string().describe("1–3 words to put on screen, taken from what is said there (a number, the stake, the named mistake)"),
      broll: z.boolean().describe("True when a short cutaway would help the viewer picture it"),
      query: z.string().describe("Stock-footage search for that cutaway: 2–4 concrete, filmable words (e.g. 'doctor reviewing paperwork'). Empty if broll is false"),
    })
  ),
});

const STOP = new Set("a an the and or but of for to in on at by with your you my our we i it is are was be this that these those from as if so do does not no just very really".split(" "));

function spaced(beats: Beat[], minGap: number) {
  const out: Beat[] = [];
  for (const b of [...beats].sort((a, b) => a.at - b.at)) if (!out.length || b.at - out.at(-1)!.at >= minGap) out.push(b);
  return out;
}

function fallback(words: TimedWord[], dur: number): Beat[] {
  const want = Math.max(1, Math.min(6, Math.floor(dur / 8)));
  const scored = words
    .map((w, i) => {
      const n = normWord(w.text);
      const score = /[\d$%]/.test(w.text) ? 10 : STOP.has(n) ? 0 : n.length >= 7 ? n.length : 0;
      return { i, w, n, score };
    })
    .filter((x) => x.score > 0 && x.w.start > 1.2 && x.w.start < dur - 3.5)
    .sort((a, b) => b.score - a.score);
  const picked = spaced(scored.map((x) => ({ at: x.w.start, dur: 1.4, keyword: x.w.text.replace(/[^\p{L}\p{N}$%'’ -]/gu, ""), broll: false })), Math.max(4, dur / (want + 1)));
  return picked.slice(0, want);
}

export async function pickBeats(words: TimedWord[], dur: number, wantBroll: boolean): Promise<Beat[]> {
  if (words.length < 6 || dur < 6) return [];
  if (!claudeConfigured()) return withBroll(fallback(words, dur), wantBroll);
  try {
    const marked = words.map((w, i) => `[${i}]${w.text}`).join(" ");
    const want = Math.max(1, Math.min(6, Math.floor(dur / 8)));
    const client = new Anthropic();
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(BeatsSchema) },
      system:
        "You are a short-form video editor for financial advisors. You choose the few moments in a talking-head video that deserve emphasis on screen. Restrained, credible, compliant: no hype, no implied guarantees, no money-rain imagery.",
      messages: [
        {
          role: "user",
          content: `Transcript of a ${Math.round(dur)}-second video, each word marked with its index:\n\n${marked}\n\nPick about ${want} moments, spread through the video (not in the first second or the last 3 seconds), where the key point lands: a number, the stake, the named mistake, the turn. For each, the keyword to flash on screen (copied from what's said, 1–3 words). ${wantBroll ? "Mark broll true for at most half of them, only where a cutaway helps the viewer picture it, with a concrete stock-footage search." : "Set broll false for all of them."}`,
        },
      ],
    });
    const moments = res.parsed_output?.moments ?? [];
    const beats = moments
      .filter((m) => Number.isInteger(m.word) && m.word >= 0 && m.word < words.length && m.keyword.trim())
      .map((m) => ({ at: words[m.word].start, dur: m.broll && wantBroll ? 2.2 : 1.4, keyword: m.keyword.trim().slice(0, 28), broll: wantBroll && m.broll && !!m.query.trim(), query: m.query.trim().slice(0, 60) }))
      .filter((b) => b.at > 0.8 && b.at < dur - 3);
    return withBroll(beats.length ? spaced(beats, 3) : fallback(words, dur), wantBroll);
  } catch (e) {
    console.warn("[video] couldn't pick moments with Claude, using the fallback:", (e as Error).message);
    return withBroll(fallback(words, dur), wantBroll);
  }
}

/** With b-roll on, at least one moment (and up to half) gets a cutaway. */
function withBroll(beats: Beat[], wantBroll: boolean): Beat[] {
  if (!wantBroll || !beats.length || beats.some((b) => b.broll)) return beats;
  return beats.map((b, i) => (i % 2 === (beats.length > 1 ? 1 : 0) ? { ...b, broll: true, dur: 2.2, query: b.query || b.keyword } : b));
}
