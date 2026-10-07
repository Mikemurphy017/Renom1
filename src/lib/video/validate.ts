import type { CaptionPosition, ProcessRequest, StyleExtras } from "./types";
import { LEGACY_STYLE, STYLE_IDS, normalizeOverlays } from "./styles";

/** Server-side checks for POST /api/video/process. Returns the request or an error string. */
const STYLES: string[] = [...STYLE_IDS, ...Object.keys(LEGACY_STYLE)];
const MUSIC = /^(none|calm|uplift|pulse|cinematic|media:img[a-f0-9]{18})$/;
const POSITIONS: CaptionPosition[] = ["top", "middle", "bottom"];
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isStr = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function validateProcessRequest(body: unknown): ProcessRequest | string {
  const b = body as Partial<ProcessRequest>;
  if (!b || typeof b !== "object") return "Invalid request";
  if (JSON.stringify(b).length > 200_000) return "Request too large";

  const errors: string[] = [];
  if (b.kind !== "analyze" && b.kind !== "render") errors.push("kind must be analyze or render");
  if (typeof b.sourceId !== "string") errors.push("sourceId is required");
  if (b.aspect !== "9:16" && b.aspect !== "16:9") errors.push("aspect must be 9:16 or 16:9");

  const e = b.edit;
  if (!e || ![e.removeSilence, e.removeBadTakes, e.removeFillers, e.enhanceAudio].every(isBool)) errors.push("edit options are invalid");

  const o = b.overlays;
  if (!o || typeof o !== "object") errors.push("overlays are required");
  else {
    const c = o.captions;
    if (!c || !isBool(c.enabled) || !STYLES.includes(c.style as string) || !POSITIONS.includes(c.position) || typeof c.color !== "string" || !/^#[0-9a-f]{6}$/i.test(c.color))
      errors.push("caption options are invalid");
    const l = o.lowerThird;
    if (!l || !isBool(l.enabled) || !isStr(l.name, 120) || !isStr(l.credentials, 120) || !isStr(l.firm, 120)) errors.push("lower-third options are invalid");
    if (!isBool(o.keyPhrases)) errors.push("keyPhrases must be true or false");
    const end = o.endCard;
    if (!end || !isBool(end.enabled) || !isStr(end.headline, 160) || !isStr(end.cta, 160)) errors.push("end-card options are invalid");
    const x = o.extras as Partial<StyleExtras> | undefined;
    if (x !== undefined) {
      if (![x.motion, x.keywordCards, x.broll, x.sfx].every(isBool) || typeof x.music !== "string" || !MUSIC.test(x.music) || !isNum(x.musicVolume) || x.musicVolume < 0 || x.musicVolume > 1)
        errors.push("style extras are invalid");
      if (!Array.isArray(x.brollMedia) || x.brollMedia.length > 50 || !x.brollMedia.every((id) => typeof id === "string" && /^img[a-f0-9]{18}$/.test(id))) errors.push("b-roll media are invalid");
    }
  }

  if (b.script !== undefined && (!Array.isArray(b.script) || b.script.length > 200 || !b.script.every((l) => isStr(l, 2000)))) errors.push("script is invalid");

  if (b.cuts !== undefined) {
    if (!Array.isArray(b.cuts) || b.cuts.length > 1000) errors.push("cuts are invalid");
    else if (!b.cuts.every((c) => c && isNum(c.start) && isNum(c.end) && c.start >= 0 && c.end > c.start && c.end <= 4 * 3600)) errors.push("each cut needs 0 ≤ start < end");
  }
  if (b.kind === "render" && !Array.isArray(b.cuts)) errors.push("cuts are required to render");
  if (b.resolution !== undefined && b.resolution !== "1080p" && b.resolution !== "2160p") errors.push("resolution must be 1080p or 2160p");

  if (errors.length) return errors.join("; ");
  return {
    kind: b.kind!,
    sourceId: b.sourceId!,
    aspect: b.aspect!,
    edit: { removeSilence: e!.removeSilence, removeBadTakes: e!.removeBadTakes, removeFillers: e!.removeFillers, enhanceAudio: e!.enhanceAudio },
    overlays: normalizeOverlays({
      captions: { ...o!.captions },
      lowerThird: { ...o!.lowerThird },
      keyPhrases: o!.keyPhrases,
      endCard: { ...o!.endCard },
      extras: o!.extras ? { ...o!.extras, brollMedia: [...o!.extras.brollMedia] } : (undefined as unknown as StyleExtras),
    }),
    script: b.script,
    cuts: b.cuts?.map((c) => ({ start: c.start, end: c.end })),
    resolution: b.resolution,
  };
}
