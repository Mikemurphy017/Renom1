/**
 * Cinematic talking-head videos: the settings, the two prompts, the script
 * rules and the job's states. Pure and dependency-free (the tests import this
 * file directly), safe for the browser and the server.
 *
 * The pipeline is two generations: a cinematic still of the advisor in the
 * chosen setting (from their headshot), then that still animated into a video
 * of them speaking the script.
 */

// ── Settings ──

export interface SettingPreset {
  id: string;
  name: string;
  /** Where they are, continuing "wearing {wardrobe}, …". */
  description: string;
  lighting: string;
  /** Two or three words, for "The person in the {short} …". */
  short: string;
  /** What moves behind them in the video. */
  backgroundMotion: string;
}

/**
 * The seed library. To add a setting, add an entry here: the camera, lens and
 * grain language is added by the templates below, so every video reads as one
 * brand.
 */
export const SETTINGS: SettingPreset[] = [
  {
    id: "corner-office",
    name: "Corner office at dusk",
    description: "standing in a high-floor executive corner office at dusk. Behind them, floor-to-ceiling windows reveal a city skyline with warm sunset glow and soft bokeh city lights",
    lighting: "Motivated key light from the window side, gentle rim light on hair and shoulder, deep natural shadows, teal-and-amber color grade",
    short: "corner office",
    backgroundMotion: "City lights twinkle softly in the background bokeh",
  },
  {
    id: "library",
    name: "Wood-paneled library",
    description: "standing in a wood-paneled private library. Behind them, floor-to-ceiling shelves of leather-bound books, a brass reading lamp and a rolling ladder fall into soft focus",
    lighting: "Warm practical light from the reading lamp as the key, soft window fill from the side, rich walnut tones, deep natural shadows, warm amber color grade with cool shadow detail",
    short: "library",
    backgroundMotion: "The lamp's warm glow shifts very slightly and dust motes drift in the light",
  },
  {
    id: "conference-room",
    name: "Glass conference room",
    description: "standing at the head of a glass-walled conference room on a high floor. Behind them, a long walnut table, leather chairs and a daylight city view through the glass fall into soft focus",
    lighting: "Soft daylight key from the glass wall, subtle edge light from overhead practicals, clean neutral tones with a cool steel-and-warm-wood color grade",
    short: "conference room",
    backgroundMotion: "Reflections drift slowly across the glass and distant traffic moves far below",
  },
  {
    id: "home-office",
    name: "Modern home office",
    description: "standing in a refined modern home office. Behind them, a clean oak desk, a few framed prints, a tall plant and a window with late-afternoon light fall into soft focus",
    lighting: "Soft window key light from one side, warm bounce fill, gentle shadows, natural skin tones, warm neutral color grade",
    short: "home office",
    backgroundMotion: "Leaves of the plant move almost imperceptibly and the window light shifts gently",
  },
  {
    id: "club-lounge",
    name: "Private club lounge",
    description: "standing in a private members' club lounge in the evening. Behind them, deep leather armchairs, dark wood paneling, a marble fireplace and low brass lamps fall into soft focus",
    lighting: "Low warm key light from a brass lamp, firelight flicker as a soft rim, deep moody shadows, rich amber-and-oxblood color grade",
    short: "club lounge",
    backgroundMotion: "Firelight flickers softly in the background bokeh",
  },
  {
    id: "rooftop-terrace",
    name: "Rooftop terrace at golden hour",
    description: "standing on a rooftop terrace at golden hour. Behind them, a glass balustrade, planters and a wide city skyline glowing in low sun fall into soft focus",
    lighting: "Low golden sun as a warm backlight and rim, soft bounced key on the face, long gentle shadows, golden-and-teal color grade",
    short: "rooftop terrace",
    backgroundMotion: "A light breeze moves the plants and the sun glints softly off distant windows",
  },
  {
    id: "coastal-office",
    name: "Coastal office with ocean view",
    description: "standing in a bright coastal office. Behind them, wide windows look out over the ocean and a pale horizon, with a light oak desk and linen textures in soft focus",
    lighting: "Soft, bright ocean daylight as the key, gentle fill from pale walls, airy highlights, clean blue-and-sand color grade",
    short: "coastal office",
    backgroundMotion: "Waves roll slowly in the distance and sheer curtains move slightly",
  },
  {
    id: "wealth-lobby",
    name: "Wealth-management lobby",
    description: "standing in a warm, upscale wealth-management firm lobby. Behind them, a stone reception desk, brushed-brass details, walnut slat walls and soft pendant lights fall into soft focus",
    lighting: "Warm pendant practicals as motivated key light, soft ambient fill, subtle rim from a side window, polished warm-neutral color grade",
    short: "firm lobby",
    backgroundMotion: "Pendant lights glow softly and a figure passes far in the background, out of focus",
  },
];

export const CUSTOM_SETTING_ID = "custom";

/** A free-text setting, given the same lighting and grade language as the presets. */
export function customSetting(text: string): SettingPreset {
  const t = clean(text).replace(/[.]+$/, "");
  const place = /^(standing|sitting|seated|in |on |at )/i.test(t) ? t : `standing in ${t}`;
  return {
    id: CUSTOM_SETTING_ID,
    name: "Custom setting",
    description: `${place}. The background falls into soft focus`,
    lighting: "Motivated key light from the brightest source in the scene, gentle rim light on hair and shoulder, deep natural shadows, a cohesive cinematic color grade",
    short: "scene",
    backgroundMotion: "The background moves subtly and naturally, in soft focus",
  };
}

export function resolveSetting(id: string, custom?: string): SettingPreset | null {
  if (id === CUSTOM_SETTING_ID) return clean(custom ?? "").length >= 8 ? customSetting(custom!) : null;
  return SETTINGS.find((s) => s.id === id) ?? null;
}

// ── Inputs ──

export type CinematicAspect = "9:16" | "16:9";

export const VOICES = [
  { id: "male-us", label: "Male, American", description: "confident, warm American male voice" },
  { id: "female-us", label: "Female, American", description: "confident, warm American female voice" },
  { id: "male-uk", label: "Male, British", description: "confident, warm British male voice" },
  { id: "female-uk", label: "Female, British", description: "confident, warm British female voice" },
] as const;
export type VoiceId = (typeof VOICES)[number]["id"];
export const voiceDescription = (id: string) => VOICES.find((v) => v.id === id)?.description ?? VOICES[0].description;

export const DEFAULT_WARDROBE = "a tailored navy blazer and a white open-collar shirt";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
/** Straight double quotes inside the script would end the quoted line in the prompt. */
const quoteSafe = (s: string) => clean(s).replace(/"/g, "”");

// ── The two prompts ──

/** Step 1: the cinematic still, from the headshot. */
export function stillPrompt(o: { wardrobe: string; setting: SettingPreset }) {
  const wardrobe = clean(o.wardrobe) || DEFAULT_WARDROBE;
  return `Cinematic film still, ultra-photorealistic. The exact same person from the reference photo (identical face, hairline, facial hair, eye color), wearing ${wardrobe}, ${o.setting.description}. ${o.setting.lighting}. Natural skin texture with visible pores and fine detail, no smoothing, no plastic look. Shot on ARRI Alexa with a 50mm anamorphic lens at T2, shallow depth of field, subtle film grain, slight anamorphic flare. Medium close-up from mid-chest up, looking into the lens with a calm, confident expression, mouth closed.`;
}

/** Step 2: the talking video, from the approved still. */
export function videoPrompt(o: { setting: SettingPreset; voice: string; script: string }) {
  return `Cinematic, photorealistic film footage. The person in the ${o.setting.short} looks into the lens and speaks in a natural, ${clean(o.voice)} with realistic lip sync, natural blinking, subtle head movement, and restrained hand gestures, like a polished brand film. They say: "${quoteSafe(o.script)}" Very slow, subtle dolly-in camera push. Preserve the shallow depth of field, anamorphic look, color grade, and film grain. ${o.setting.backgroundMotion}. Quiet room tone, no music, no captions.`;
}

// ── Script length ──

/** Natural delivery, measured on the validated clips. */
export const WORDS_PER_SECOND = 2.5;
/** Headroom so the last word isn't cut off. */
const TAIL_SECONDS = 2;

export const countWords = (script: string) => (clean(script).match(/\S+/g) ?? []).length;
export const estimateSeconds = (words: number) => Math.round((words / WORDS_PER_SECOND) * 10) / 10;

/** The most words that fit a clip of `maxSeconds` with room to finish (32 for a 15-second clip). */
export const maxWordsFor = (maxSeconds: number) => Math.floor((maxSeconds - TAIL_SECONDS) * WORDS_PER_SECOND);

/** How long a clip to ask for: the spoken length plus headroom, within the model's range. */
export function clipSeconds(words: number, minSeconds: number, maxSeconds: number) {
  return Math.min(maxSeconds, Math.max(minSeconds, Math.ceil(words / WORDS_PER_SECOND) + TAIL_SECONDS));
}

export const MIN_WORDS = 5;

export function validateScript(script: string, maxSeconds: number): { ok: true; words: number; seconds: number } | { ok: false; words: number; error: string } {
  const words = countWords(script);
  const max = maxWordsFor(maxSeconds);
  if (words < MIN_WORDS) return { ok: false, words, error: "Write at least a sentence for them to say." };
  if (words > max) return { ok: false, words, error: `That’s ${words} words. Keep it to ${max} or fewer (about ${Math.round(maxSeconds - TAIL_SECONDS)} seconds) so the last line isn’t cut off.` };
  return { ok: true, words, seconds: estimateSeconds(words) };
}

// ── Job states ──

/**
 * uploading → scene → approval → filming → ready, with failed reachable from
 * any working state. The advisor approves the still before the video (the
 * expensive part) is made, and can ask for a new still instead.
 */
export type CinematicStatus = "uploading" | "scene" | "approval" | "filming" | "ready" | "failed";

export const STATUS_LABEL: Record<CinematicStatus, string> = {
  uploading: "Uploading",
  scene: "Creating your scene",
  approval: "Awaiting your approval",
  filming: "Filming",
  ready: "Ready",
  failed: "Failed",
};

export type CinematicEvent = "uploaded" | "still_ready" | "approve" | "regenerate" | "video_ready" | "fail" | "retry";

const TRANSITIONS: Record<CinematicStatus, Partial<Record<CinematicEvent, CinematicStatus>>> = {
  uploading: { uploaded: "scene", fail: "failed" },
  scene: { still_ready: "approval", fail: "failed" },
  approval: { approve: "filming", regenerate: "scene" },
  filming: { video_ready: "ready", fail: "failed" },
  ready: {},
  failed: {},
};

/** The next status, or null when the event doesn't apply in this one. */
export function nextStatus(from: CinematicStatus, event: CinematicEvent, failedAt?: "scene" | "filming"): CinematicStatus | null {
  // A retry goes back to the step that failed: a new still, or the video again from the approved still.
  if (from === "failed" && event === "retry") return failedAt === "filming" ? "filming" : "scene";
  return TRANSITIONS[from][event] ?? null;
}

export const isWorking = (s: CinematicStatus) => s === "uploading" || s === "scene" || s === "filming";

// ── Cost ──

/**
 * Higgsfield's estimate as one number (USD). Some models answer with a figure,
 * others with their rate per second of video at each resolution.
 */
export function priceFrom(r: { usd?: string | number; pricing_description?: string }, input: Record<string, unknown>): number | null {
  const n = Number(r.usd);
  if (r.usd !== undefined && r.usd !== "" && Number.isFinite(n)) return n;
  // "…USD per video second: 480p: $0.1177; 720p: $0.2647; 1080p: $0.6518…"
  const res = String(input.resolution ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const secs = Number(input.duration);
  if (!res || !r.pricing_description || !/per video second/i.test(r.pricing_description) || !Number.isFinite(secs)) return null;
  const m = new RegExp(`(?:^|[\\s;:])${res}:\\s*\\$([0-9]+(?:\\.[0-9]+)?)`, "i").exec(r.pricing_description);
  return m ? Math.round(Number(m[1]) * secs * 1000) / 1000 : null;
}
