/**
 * Keeps ideas and scripts original: a new idea mustn't be the same video as
 * one the advisor already has (or was already offered), and a new script
 * mustn't open the way another of their scripts does. Plain word overlap,
 * shared by the browser and the server.
 */

const STOP = new Set(
  "the a an and or of for to in on at by from your you yours is it its what why how when who i me my we our with vs versus before after this that these those are was were be do does did should can could will would not no just about into than then so if".split(" ")
);

export function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
      .map((w) => (w.length > 4 ? w.replace(/(ies|es|s|ing|ed)$/, "") : w))
  );
}

/** Share of the smaller set that's in the other: 1 when one contains the other. */
function overlap(a: Set<string>, b: Set<string>) {
  return shared(a, b) / Math.max(1, Math.min(a.size, b.size));
}

function shared(a: Set<string>, b: Set<string>) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

const without = (s: Set<string>, drop: Set<string>) => (drop.size ? new Set([...s].filter((w) => !drop.has(w))) : s);

const norm = (s: string) => [...words(s)].sort().join(" ");

export interface IdeaLike {
  title: string;
  outline?: string[];
}

/**
 * Whether `idea` is the same video as one in `past`; returns the one it
 * repeats. Words of the advisor's chosen topic don't count as overlap, or
 * every idea on "Roth conversions" would repeat every other.
 */
export function repeatOf<T extends IdeaLike>(idea: IdeaLike, past: T[], topic = ""): T | undefined {
  const skip = words(topic);
  const t = without(words(idea.title), skip);
  const key = norm(idea.title);
  const beats = without(words([idea.title, ...(idea.outline ?? [])].join(" ")), skip);
  let best: { p: T; score: number } | undefined;
  for (const p of past) {
    if (!p.title) continue;
    if (key && key === norm(p.title)) return p;
    const pt = without(words(p.title), skip);
    const n = shared(t, pt);
    const titles = overlap(t, pt);
    // The same question in other words, or the same beats under a new title.
    const both = p.outline?.length && idea.outline?.length ? overlap(beats, without(words([p.title, ...p.outline].join(" ")), skip)) : 0;
    const sameTitle = (n >= 3 && titles >= 0.6) || (n >= 2 && titles >= 0.8);
    const score = Math.max(sameTitle ? titles : 0, both >= 0.55 ? both : 0);
    if (score && (!best || score > best.score)) best = { p, score };
  }
  return best?.p;
}

/** Ideas from `fresh` that repeat nothing in `past` or each other, in order. */
export function originalIdeas<T extends IdeaLike>(fresh: T[], past: IdeaLike[], topic = ""): { kept: T[]; dropped: T[] } {
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const idea of fresh) (repeatOf(idea, [...past, ...kept], topic) ? dropped : kept).push(idea);
  return { kept, dropped };
}

/** Whether a script's opening is close to one of the advisor's other openings. */
export function repeatsOpening(hook: string, others: string[]): boolean {
  const h = words(hook);
  if (h.size < 4) return false;
  return others.some((o) => {
    const w = words(o);
    return w.size >= 4 && overlap(h, w) >= 0.6;
  });
}
