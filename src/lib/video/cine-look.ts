/**
 * The cinematic look for real footage: a colour grade, film grain, a vignette,
 * a slow push-in and soft-focus edges. Applied by Renom's own renderer to the
 * advisor's take (no AI, the face and voice are untouched). Pure: the renderer
 * and the live preview both read it.
 */

export type CineGrade = "teal-amber" | "warm" | "cool" | "film";

export interface CineLook {
  /** Master switch; the parts below only apply when it's on. */
  enabled: boolean;
  grade: CineGrade | "none";
  grain: boolean;
  vignette: boolean;
  pushIn: boolean;
  /** Soft focus towards the edges, keeping the centre (the face) sharp. */
  softFocus: boolean;
}

export const CINE_GRADES: { id: CineGrade; label: string; hint: string }[] = [
  { id: "teal-amber", label: "Teal & amber", hint: "Cool shadows, warm skin: the classic film look" },
  { id: "warm", label: "Golden", hint: "Warm and inviting, like late-afternoon light" },
  { id: "cool", label: "Cool", hint: "Crisp and modern, slightly blue" },
  { id: "film", label: "Film", hint: "Softer contrast and gentle colour, like film stock" },
];

/** Everything on: what "Make it cinematic" switches to. */
export const CINE_DEFAULT: CineLook = { enabled: true, grade: "teal-amber", grain: true, vignette: true, pushIn: true, softFocus: true };

export const cineOn = (c?: CineLook | null): c is CineLook => !!c?.enabled;

/** How much the frame tightens over the whole video: subtle on purpose. */
export const PUSH_IN = 0.06;

/**
 * ffmpeg filters for the grade. Curves are lookup tables, so they cost little
 * per frame (colorbalance doubled the render time); eq adds contrast and
 * saturation the same way.
 */
export function gradeFilter(g: CineLook["grade"]): string {
  switch (g) {
    case "teal-amber":
      // Teal in the shadows, warmth on skin and highlights.
      return "curves=r='0/0 0.25/0.22 0.75/0.80 1/1':g='0/0 0.25/0.245 0.75/0.765 1/1':b='0/0.04 0.25/0.29 0.75/0.69 1/0.93',eq=contrast=1.06:saturation=1.05";
    case "warm":
      return "curves=r='0/0 0.5/0.53 1/1':g='0/0 0.5/0.51 1/1':b='0/0 0.5/0.46 1/0.94',eq=contrast=1.05:saturation=1.06";
    case "cool":
      return "curves=r='0/0 0.5/0.48 1/0.97':b='0/0.02 0.5/0.54 1/1',eq=contrast=1.06:saturation=0.94";
    case "film":
      return "curves=all='0/0.05 0.5/0.5 1/0.95':r='0/0 0.5/0.51 1/1':b='0/0 0.5/0.48 1/0.97',eq=contrast=1.03:saturation=0.86";
    default:
      return "";
  }
}

/** The finishing filters that sit over everything but the captions: grade, vignette, grain. */
export function finishFilters(c: CineLook): string[] {
  const out: string[] = [];
  const g = gradeFilter(c.grade);
  if (g) out.push(g);
  if (c.vignette) out.push("vignette=angle=PI/5:mode=forward");
  // Temporal, uniform grain: moves like film, light enough not to fight the encoder.
  if (c.grain) out.push("noise=alls=6:allf=t+u");
  return out;
}

/**
 * The soft-focus mask: white (blurred) at the edges, clear in an ellipse around
 * where the face sits. Generated once per render as a still image.
 */
export function focusMaskExpr(vertical: boolean) {
  // Centre and radii as fractions of the frame; the face sits a little above the middle.
  const [cx, cy, rx, ry] = vertical ? [0.5, 0.4, 0.46, 0.34] : [0.5, 0.42, 0.3, 0.46];
  const d = `hypot((X/W-${cx})/${rx},(Y/H-${cy})/${ry})`;
  // 0 inside the ellipse, rising smoothly to 255 a little beyond it.
  return `255*clip((${d}-0.85)/0.6,0,1)`;
}

/** Live-preview approximation in CSS (the render is the real thing). */
export function previewFilter(c: CineLook): string {
  switch (c.grade) {
    case "teal-amber":
      return "contrast(1.08) saturate(1.06)";
    case "warm":
      return "contrast(1.05) saturate(1.1) sepia(0.12)";
    case "cool":
      return "contrast(1.06) saturate(0.94) hue-rotate(-6deg)";
    case "film":
      return "contrast(0.96) saturate(0.86) sepia(0.06) brightness(1.02)";
    default:
      return "";
  }
}
/** A tint laid over the preview for the grades a CSS filter can't make (soft-light). */
export function previewTint(c: CineLook): string | null {
  if (c.grade === "teal-amber") return "linear-gradient(180deg, rgba(0,110,120,.22), rgba(255,150,60,.16))";
  if (c.grade === "cool") return "linear-gradient(180deg, rgba(40,90,160,.18), rgba(40,90,160,.08))";
  return null;
}

export function isCineLook(x: unknown): x is CineLook {
  const c = x as Partial<CineLook> | null;
  return (
    !!c &&
    typeof c === "object" &&
    [c.enabled, c.grain, c.vignette, c.pushIn, c.softFocus].every((v) => typeof v === "boolean") &&
    (c.grade === "none" || CINE_GRADES.some((g) => g.id === c.grade))
  );
}
