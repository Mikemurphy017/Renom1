/**
 * Length rules for generated titles and cover headlines, applied after the
 * writer answers so nothing over the limit reaches the screen. Pure.
 */

export const COVER_MAX_WORDS = 3;
export const TITLE_MAX_WORDS = 10;

export const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Words a cover headline can lose without changing what it says. */
const FILLER = /^(a|an|the|your|you|this|that|these|those|of|to|on|in|for|with|about|is|are|it|its|it’s|it's|really|just|very|actually|here’s|here's|how|why|what|and|my|our)$/i;
const bare = (w: string) => w.replace(/^[“"'‘(]+|[”"'’).,!?:;]+$/g, "");

/**
 * A cover headline in three words or fewer: unchanged when it already fits,
 * otherwise with filler words taken out (last ones first, so the opening
 * survives). `ok` is false when that still wasn't enough and it had to be cut.
 */
export function shortHeadline(headline: string, max = COVER_MAX_WORDS): { text: string; ok: boolean } {
  const clean = headline.replace(/\s+/g, " ").trim();
  let words = wordsOf(clean);
  if (words.length <= max) return { text: clean, ok: true };
  const end = /[?!]$/.exec(clean)?.[0] ?? "";
  words = words.map((w, i) => (i === words.length - 1 ? w.replace(/[?!.]+$/, "") : w));
  // "Is it too late?" reads fine as "Too late?"; "Is too late?" doesn't.
  const lead = /^(is|are|was|it[’']?s|here[’']?s|this|that|there[’']?s)$/i;
  while (words.length > max && words.length > 2 && lead.test(bare(words[0])) && (lead.test(bare(words[1])) || /^(it|this|that|there|you|your)$/i.test(bare(words[1])))) words.splice(0, 2);
  if (words.length) words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  for (let i = words.length - 1; i >= 0 && words.length > max; i--) if (FILLER.test(bare(words[i]))) words.splice(i, 1);
  const ok = words.length <= max;
  if (!ok) {
    words = words.slice(0, max);
    // Don't end on a word that only points at what was cut.
    while (words.length > 1 && /^(and|or|but|of|to|on|in|for|with|a|an|the|is|are|vs\.?)$/i.test(bare(words[words.length - 1]))) words.pop();
  }
  return { text: words.join(" ").replace(/[,:;]+$/, "") + end, ok };
}

/** The accent must be a word that's still in the headline. */
export function accentIn(headline: string, accent: string) {
  const words = wordsOf(headline).map(bare);
  const want = bare(accent ?? "").toLowerCase();
  return words.find((w) => w.toLowerCase() === want) ?? words[words.length - 1] ?? "";
}

/** One short title: the first sentence only, without wrapping quotes or a trailing full stop. */
export function tidyTitle(title: string) {
  const t = title.replace(/\s+/g, " ").trim().replace(/^[“"]+|[”"]+$/g, "");
  const first = /^(.{12,}?[.!?])\s+\S/.exec(t)?.[1] ?? t;
  return first.replace(/\.$/, "");
}
export const titleFits = (title: string) => wordsOf(title).length <= TITLE_MAX_WORDS;
