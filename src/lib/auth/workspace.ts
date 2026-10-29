import { EMPTY_PROFILE } from "@/lib/profile";
import type { AdvisorProfile, CoverPhotos } from "@/lib/types";
import { AuthError, loadState, saveState } from "./server";

/**
 * A client's workspace as the admin sets it up: their profile (who they are,
 * who they talk to, how they sound, photos, compliance) and approval settings,
 * written into the same saved studio the app loads when they sign in.
 */

export interface WorkspaceSetup {
  profile: AdvisorProfile;
  requireApproval: boolean;
  reviewer: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);
const MEDIA_URL = /^\/api\/media\/[a-z0-9]{6,40}$/;
const COVER: CoverPhotos[] = ["ai", "real", "none"];

/** Only the fields the setup form edits, checked and bounded. */
export function cleanProfile(raw: unknown, base: AdvisorProfile = EMPTY_PROFILE): AdvisorProfile {
  const p = (raw ?? {}) as Partial<AdvisorProfile>;
  const t = (p.tone ?? {}) as Partial<AdvisorProfile["tone"]>;
  const headshots = Array.isArray(p.headshots)
    ? p.headshots
        .filter((h) => h && typeof h.id === "string" && typeof h.url === "string" && MEDIA_URL.test(h.url))
        .slice(0, 6)
        .map((h) => ({ id: h.id.slice(0, 40), label: str(h.label, 80) || "Headshot", pose: "center" as const, url: h.url }))
    : base.headshots;
  const disclosureText = str((p.disclosures ?? [])[0]?.text, 4000);
  const disclosures = disclosureText
    ? base.disclosures.length && base.disclosures[0].text === disclosureText
      ? base.disclosures
      : [{ id: `d${Date.now()}`, version: base.disclosures.length ? `v${base.disclosures.length + 1}.0` : "v1.0", label: "Social video disclosure", text: disclosureText, updatedAt: new Date().toISOString(), updatedBy: "Set up by your admin", active: true }, ...base.disclosures.map((d) => ({ ...d, active: false }))]
    : base.disclosures;
  const calendar = str(p.calendarUrl, 300);
  return {
    ...base,
    name: str(p.name, 120),
    credentials: str(p.credentials, 80),
    firm: str(p.firm, 120),
    title: str(p.title, 120),
    crd: str(p.crd, 20),
    email: str(p.email, 200),
    city: str(p.city, 120),
    bio: str(p.bio, 2000),
    niche: str(p.niche, 300),
    idealClient: str(p.idealClient, 1000),
    tone: { formalConversational: num(t.formalConversational, 0, 100, base.tone.formalConversational), cautiousBold: num(t.cautiousBold, 0, 100, base.tone.cautiousBold) },
    opinions: Array.isArray(p.opinions) ? p.opinions.map((o) => str(o, 300)).filter(Boolean).slice(0, 12) : base.opinions,
    sampleWriting: str(p.sampleWriting, 6000),
    brandColors: Array.isArray(p.brandColors) ? p.brandColors.filter((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6) : base.brandColors,
    headshots,
    disclosures,
    calendarUrl: calendar ? (/^https?:\/\//i.test(calendar) ? calendar : `https://${calendar}`) : undefined,
    coverPhotos: COVER.includes(p.coverPhotos as CoverPhotos) ? p.coverPhotos : base.coverPhotos,
  };
}

type Saved = { version?: number; onboarded?: boolean; videos?: unknown[]; reviews?: unknown[]; requireApproval?: boolean; reviewer?: string; profile?: AdvisorProfile; team?: unknown[] };

export async function readWorkspace(userId: string): Promise<WorkspaceSetup & { onboarded: boolean; videos: number }> {
  const saved = await loadState(userId);
  const st = (saved?.state ?? {}) as Saved;
  return {
    profile: { ...EMPTY_PROFILE, ...(st.profile ?? {}) },
    requireApproval: !!st.requireApproval,
    reviewer: st.reviewer ?? "",
    onboarded: !!st.onboarded,
    videos: Array.isArray(st.videos) ? st.videos.length : 0,
  };
}

/** Writes the setup into the client's studio, keeping their videos and everything else. Marks it ready, so they skip the welcome questions. */
export async function writeWorkspace(userId: string, input: { profile?: unknown; requireApproval?: unknown; reviewer?: unknown }) {
  const saved = await loadState(userId);
  const st = (saved?.state ?? {}) as Saved;
  const profile = cleanProfile(input.profile, { ...EMPTY_PROFILE, ...(st.profile ?? {}) });
  if (!profile.name) throw new AuthError("Enter the client’s name.");
  const reviewer = str(input.reviewer, 200);
  await saveState(userId, {
    state: {
      version: 1,
      videos: [],
      reviews: [],
      team: [],
      ...st,
      onboarded: true,
      profile,
      requireApproval: input.requireApproval === true && !!reviewer,
      reviewer,
    },
    drafts: saved?.drafts ?? null,
  });
  return profile;
}

/** Where the client signs in: the address the admin is using (the app's own domain), unless APP_URL says otherwise. */
export function signInUrl(request: Request) {
  const set = process.env.APP_URL?.trim();
  if (set) return `${set.replace(/\/+$/, "")}/signin`;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${host ? `${proto}://${host}` : new URL(request.url).origin}/signin`;
}
