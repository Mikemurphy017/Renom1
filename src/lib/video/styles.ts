/**
 * Edit styles: one pick sets the whole look of a video. Each style bundles a
 * caption design with how the video moves (punch-in zooms), keyword cards on
 * the big moments, b-roll, sound effects and a music bed. Every extra can be
 * switched off per video. Shared by the browser preview and the renderer.
 */

import type { OverlayOptions, StyleExtras } from "./types";

export type StyleId = "impact" | "ignite" | "focus" | "duo" | "volt" | "nova" | "karaoke" | "clarity" | "minimal";
export type MusicMood = "calm" | "uplift" | "pulse" | "cinematic";
export type StyleCategory = "Bold" | "Polished" | "Minimal";

export interface StyleDef {
  id: StyleId;
  name: string;
  category: StyleCategory;
  description: string;
  /** Caption type. `family` is the font's name in assets/fonts (ffmpeg) and public/fonts (browser). */
  font: { family: string; weight: number; italic?: boolean; upper: boolean; size: number; tracking?: number };
  /** Emphasis words use this type instead (Duo, Volt, Nova). */
  emphasisFont?: { family: string; weight: number; italic?: boolean; upper?: boolean; scale: number };
  /** Words on screen at once (vertical / horizontal). */
  words: [number, number];
  /** Base text color and the default highlight (the advisor's color overrides the highlight). */
  text: string;
  accent: string;
  outline: { width: number; color: string };
  /** Soft glow in the highlight color around emphasized words. */
  glow?: boolean;
  /** Active word sits on a solid box. */
  activeBox?: boolean;
  /** How words appear. */
  animation: "pop" | "fade" | "karaoke" | "slide" | "none";
  /** Emphasis words: the spoken word, or only the key words. */
  highlight: "spoken" | "key";
  /** Keyword card on the big moments. */
  card: "headline" | "backdrop" | "banner" | "chip" | null;
  defaults: { motion: boolean; keywordCards: boolean; broll: boolean; sfx: boolean; music: MusicMood | "none" };
}

export const STYLES: StyleDef[] = [
  {
    id: "impact",
    name: "Impact",
    category: "Bold",
    description: "Tall condensed caps, the spoken word lit and glowing, punch-in zooms.",
    font: { family: "Anton", weight: 400, upper: true, size: 1.45, tracking: 1 },
    words: [2, 4],
    text: "#FFFFFF",
    accent: "#3CF2B4",
    outline: { width: 6, color: "#000000" },
    glow: true,
    animation: "pop",
    highlight: "spoken",
    card: "headline",
    defaults: { motion: true, keywordCards: true, broll: true, sfx: true, music: "pulse" },
  },
  {
    id: "ignite",
    name: "Ignite",
    category: "Bold",
    description: "A quiet lead-in, then the key words big in red with a glow and a giant word behind.",
    font: { family: "Montserrat Black", weight: 900, upper: false, size: 0.9 },
    emphasisFont: { family: "Montserrat Black", weight: 900, scale: 1.55 },
    words: [4, 6],
    text: "#FFFFFF",
    accent: "#FF2D2D",
    outline: { width: 3, color: "#000000" },
    glow: true,
    animation: "pop",
    highlight: "key",
    card: "backdrop",
    defaults: { motion: true, keywordCards: true, broll: false, sfx: true, music: "cinematic" },
  },
  {
    id: "focus",
    name: "Focus",
    category: "Polished",
    description: "The spoken word on a white block, big keyword banners on the moments that matter.",
    font: { family: "Montserrat ExtraBold", weight: 800, upper: false, size: 0.95 },
    words: [3, 5],
    text: "#FFFFFF",
    accent: "#FFFFFF",
    outline: { width: 3, color: "#000000" },
    activeBox: true,
    animation: "none",
    highlight: "spoken",
    card: "banner",
    defaults: { motion: false, keywordCards: true, broll: true, sfx: true, music: "uplift" },
  },
  {
    id: "duo",
    name: "Duo",
    category: "Polished",
    description: "Two sizes: the word that matters big and gold, the rest small and calm.",
    font: { family: "Montserrat ExtraBold", weight: 800, upper: false, size: 0.72 },
    emphasisFont: { family: "Montserrat Black", weight: 900, scale: 1.7 },
    words: [3, 5],
    text: "#FFFFFF",
    accent: "#F5C542",
    outline: { width: 3, color: "#000000" },
    animation: "fade",
    highlight: "key",
    card: null,
    defaults: { motion: false, keywordCards: false, broll: false, sfx: false, music: "calm" },
  },
  {
    id: "volt",
    name: "Volt",
    category: "Bold",
    description: "Lower-case lead words with one electric italic word that hits.",
    font: { family: "Montserrat ExtraBold", weight: 800, upper: false, size: 0.8 },
    emphasisFont: { family: "Montserrat Black", weight: 900, italic: true, scale: 1.6 },
    words: [3, 5],
    text: "#FFFFFF",
    accent: "#C6FF3D",
    outline: { width: 3, color: "#000000" },
    glow: true,
    animation: "slide",
    highlight: "key",
    card: "headline",
    defaults: { motion: true, keywordCards: true, broll: true, sfx: true, music: "pulse" },
  },
  {
    id: "nova",
    name: "Nova",
    category: "Polished",
    description: "Clean small caps with the lead word set large. Quietly confident.",
    font: { family: "Montserrat ExtraBold", weight: 800, upper: true, size: 0.62, tracking: 2 },
    emphasisFont: { family: "Montserrat Black", weight: 900, upper: true, scale: 1.6 },
    words: [3, 5],
    text: "#FFFFFF",
    accent: "#FFFFFF",
    outline: { width: 2, color: "#000000" },
    animation: "fade",
    highlight: "key",
    card: null,
    defaults: { motion: false, keywordCards: false, broll: false, sfx: false, music: "calm" },
  },
  {
    id: "karaoke",
    name: "Karaoke",
    category: "Bold",
    description: "Every word fills with color the moment it's said.",
    font: { family: "Montserrat Black", weight: 900, upper: true, size: 0.95 },
    words: [3, 5],
    text: "#FFFFFF",
    accent: "#FFD400",
    outline: { width: 5, color: "#000000" },
    animation: "karaoke",
    highlight: "spoken",
    card: "chip",
    defaults: { motion: true, keywordCards: false, broll: false, sfx: false, music: "uplift" },
  },
  {
    id: "clarity",
    name: "Clarity",
    category: "Polished",
    description: "Sentence case on a soft dark band. The private-bank default.",
    font: { family: "Montserrat SemiBold", weight: 600, upper: false, size: 0.72 },
    words: [5, 8],
    text: "#FFFFFF",
    accent: "#D9B97E",
    outline: { width: 0, color: "#000000" },
    animation: "fade",
    highlight: "spoken",
    card: "chip",
    defaults: { motion: false, keywordCards: false, broll: false, sfx: false, music: "none" },
  },
  {
    id: "minimal",
    name: "Minimal",
    category: "Minimal",
    description: "Small, clean, out of the way. Nothing else added.",
    font: { family: "Montserrat SemiBold", weight: 600, upper: false, size: 0.58 },
    words: [5, 8],
    text: "#FFFFFF",
    accent: "#FFFFFF",
    outline: { width: 2, color: "#000000" },
    animation: "none",
    highlight: "spoken",
    card: null,
    defaults: { motion: false, keywordCards: false, broll: false, sfx: false, music: "none" },
  },
];

export const STYLE_IDS = STYLES.map((s) => s.id);
export const getStyle = (id: string | undefined): StyleDef => STYLES.find((s) => s.id === id) ?? STYLES.find((s) => s.id === "clarity")!;

/** Older looks saved before styles existed. */
export const LEGACY_STYLE: Record<string, StyleId> = { classic: "clarity", bold: "impact", minimal: "minimal" };

export const MUSIC_CHOICES: { id: MusicMood | "none"; label: string }[] = [
  { id: "none", label: "No music" },
  { id: "calm", label: "Calm" },
  { id: "uplift", label: "Uplift" },
  { id: "pulse", label: "Pulse" },
  { id: "cinematic", label: "Cinematic" },
];

/** Fonts the browser preview needs (served from public/fonts). */
export const FONT_FACES: { family: string; file: string; weight: number; italic?: boolean }[] = [
  { family: "Anton", file: "Anton_400Regular.ttf", weight: 400 },
  { family: "Montserrat Black", file: "Montserrat_900Black.ttf", weight: 900 },
  { family: "Montserrat Black", file: "Montserrat_900Black_Italic.ttf", weight: 900, italic: true },
  { family: "Montserrat ExtraBold", file: "Montserrat_800ExtraBold.ttf", weight: 800 },
  { family: "Montserrat SemiBold", file: "Montserrat_600SemiBold.ttf", weight: 600 },
  { family: "Bebas Neue", file: "BebasNeue_400Regular.ttf", weight: 400 },
  { family: "Playfair Display", file: "PlayfairDisplay_700Bold.ttf", weight: 700 },
];


export function extrasFor(style: StyleId, prev?: Partial<StyleExtras>): StyleExtras {
  const d = getStyle(style).defaults;
  return { motion: d.motion, keywordCards: d.keywordCards, broll: d.broll, sfx: d.sfx, music: d.music, musicVolume: 0.5, brollMedia: prev?.brollMedia ?? [] };
}

/** Bring any saved look (including ones from before styles) up to date. */
export function normalizeOverlays(o: OverlayOptions): OverlayOptions {
  const raw = o.captions.style as string;
  const style: StyleId = (STYLE_IDS as string[]).includes(raw) ? (raw as StyleId) : (LEGACY_STYLE[raw] ?? "clarity");
  const base = extrasFor(style, o.extras);
  const extras: StyleExtras = o.extras ? { ...base, ...o.extras } : base;
  return { ...o, captions: { ...o.captions, style }, extras };
}
