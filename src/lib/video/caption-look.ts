import type { OverlayOptions } from "./types";

/**
 * How captions read on screen, shared by the renderer (ass.ts) and the Edit
 * step's live preview so the two always match: where the line sits, the letter
 * case, and how the spoken word is highlighted.
 */

export type CaptionCase = "lower" | "natural" | "upper";
export type CaptionHighlight = "color" | "marker" | "pop" | "none";

export const CAPTION_CASES: { id: CaptionCase; label: string }[] = [
  { id: "lower", label: "lowercase" },
  { id: "natural", label: "As spoken" },
  { id: "upper", label: "ALL CAPS" },
];

export const CAPTION_HIGHLIGHTS: { id: CaptionHighlight; label: string; hint: string }[] = [
  { id: "color", label: "Color", hint: "The spoken word turns the highlight color" },
  { id: "marker", label: "Marker", hint: "A block of color behind the spoken word" },
  { id: "pop", label: "Pop", hint: "The spoken word grows, no color" },
  { id: "none", label: "None", hint: "Plain captions, no word highlight" },
];

/** Older saves were all caps; new captions default to lowercase. */
export const captionCase = (c: OverlayOptions["captions"]): CaptionCase => c.case ?? "lower";
export const captionHighlight = (c: OverlayOptions["captions"]): CaptionHighlight => c.highlight ?? "color";

export function applyCase(text: string, mode: CaptionCase) {
  return mode === "upper" ? text.toUpperCase() : mode === "lower" ? text.toLowerCase() : text;
}

/** Centre of the caption line for a preset, as a share of the frame height from the top. */
export function presetY(position: OverlayOptions["captions"]["position"], vertical: boolean, lowerThird: boolean) {
  if (position === "top") return 0.2;
  if (position === "middle") return vertical ? 0.56 : 0.5;
  // Low, but clear of the name & credentials on long form.
  return vertical ? 0.8 : lowerThird ? 0.78 : 0.87;
}

export const Y_MIN = 0.1;
export const Y_MAX = 0.93;

/** Where the captions sit: the advisor's own height when they've set one, else the preset. */
export function captionY(c: OverlayOptions["captions"], vertical: boolean, lowerThird: boolean) {
  return typeof c.y === "number" ? Math.min(Y_MAX, Math.max(Y_MIN, c.y)) : presetY(c.position, vertical, lowerThird);
}

/** Below this on a vertical video, TikTok's and Reels' buttons and caption can cover the words. */
export const SAFE_BOTTOM = 0.84;

/** Readable text on a highlight color: navy on light colors, white on dark. */
export function inkFor(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0B1F3A" : "#FFFFFF";
}
