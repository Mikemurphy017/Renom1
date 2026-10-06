/**
 * White-label brand config. One place for the product name, logo and the two
 * brand colors; a reseller rebrands with env vars, no code changes.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so rebuild after changing them.
 * Unset values fall back to Renom and its palette.
 */

const env = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
const hex = (v: string | undefined) => {
  const s = env(v);
  return s && /^#[0-9a-f]{6}$/i.test(s) ? s : undefined;
};

export interface Brand {
  name: string;
  tagline: string;
  description: string;
  /** Optional logo image (absolute URL or a path under /public). Replaces the drawn mark. */
  logoUrl?: string;
  /** Drawn mark: background tile and letter color. */
  mark: { background: string; foreground: string };
  colors: {
    /** Buttons, focus rings, highlights (Renom's brass). Unset = keep the stylesheet's palette. */
    primary?: string;
    /** Primary in dark mode; derived from primary when unset. */
    primaryDark?: string;
    /** Text on primary. */
    primaryForeground?: string;
  };
  /** Default highlight color for captions when the advisor hasn't picked one. */
  captionColor: string;
}

const primary = hex(process.env.NEXT_PUBLIC_BRAND_PRIMARY);

export const BRAND: Brand = {
  name: env(process.env.NEXT_PUBLIC_BRAND_NAME) ?? "Renom",
  tagline: env(process.env.NEXT_PUBLIC_BRAND_TAGLINE) ?? "Video studio for financial advisors",
  description: env(process.env.NEXT_PUBLIC_BRAND_DESCRIPTION) ?? "Go from idea to published, compliance-approved video in one place.",
  logoUrl: env(process.env.NEXT_PUBLIC_BRAND_LOGO_URL),
  mark: {
    background: hex(process.env.NEXT_PUBLIC_BRAND_MARK_BG) ?? "#0B1F3A",
    foreground: hex(process.env.NEXT_PUBLIC_BRAND_MARK_FG) ?? "#D2B07A",
  },
  colors: {
    primary,
    primaryDark: hex(process.env.NEXT_PUBLIC_BRAND_PRIMARY_DARK),
    primaryForeground: hex(process.env.NEXT_PUBLIC_BRAND_PRIMARY_FOREGROUND),
  },
  captionColor: primary ?? "#E8CFA4",
};

/** True when we are running under the default Renom brand. */
export const isDefaultBrand = BRAND.name === "Renom";

/**
 * CSS that overrides the primary/brass tokens in globals.css.
 * Empty when no brand colors are set, so the default palette is untouched.
 */
export function brandCss(b: Brand = BRAND): string {
  const { primary: p, primaryDark, primaryForeground } = b.colors;
  if (!p) return "";
  const dark = primaryDark ?? `color-mix(in oklab, ${p} 82%, white)`;
  const light = [
    `--primary:${p}`,
    `--primary-hover:color-mix(in oklab, ${p} 86%, black)`,
    `--ring:${p}`,
    `--brass:${p}`,
    `--brass-soft:color-mix(in oklab, ${p} 15%, white)`,
    `--chart-2:${p}`,
    primaryForeground && `--primary-foreground:${primaryForeground}`,
  ];
  const darkVars = [
    `--primary:${dark}`,
    `--primary-hover:color-mix(in oklab, ${dark} 88%, white)`,
    `--ring:${dark}`,
    `--brass-soft:color-mix(in oklab, ${dark} 16%, #0c1e37)`,
    `--chart-2:${dark}`,
  ];
  // html:root / html.dark outrank the stylesheet's :root / .dark regardless of load order.
  return `html:root{${light.filter(Boolean).join(";")}}html.dark{${darkVars.join(";")}}`;
}
