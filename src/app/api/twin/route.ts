import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { isPro, proOnly } from "@/lib/billing/tier";
import { baseUrl } from "@/lib/email";
import { TwinError } from "@/lib/twin/heygen";
import { CONSENT_TEXT, TwinUserError, addTemplateLooks, newConsentLink, refresh, removeLook, removeTwin, renameLook, setDefaultLook, setPhotos, setVideo, setVoice } from "@/lib/twin/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_AUDIO_MB = 25;
const fail = (e: unknown) =>
  e instanceof TwinUserError || e instanceof TwinError ? NextResponse.json({ ok: false, error: e.message }, { status: e.status }) : (console.error("[twin]", e), NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 }));
const back = () => `${baseUrl()}/settings#ai-twin`;

/** The advisor's AI twin: where each part stands (and moves it along). */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const pro = await isPro(user);
  try {
    return NextResponse.json({ ok: true, pro, consentText: CONSENT_TEXT, twin: await refresh(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Multipart (the voice): audio, seconds, consent=yes.
 * JSON: { action: "video", uploadId, consent } | { action: "photos", mediaIds, consent } | { action: "consent-link" } | { action: "default", lookId }
 *  | { action: "template-looks", templateId, from?, aspect? }
 *  | { action: "rename-look", lookId, name } | { action: "remove-look", lookId }.
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!(await isPro(user))) return proOnly("Your AI twin");
  try {
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      const f = form.get("audio");
      if (!(f instanceof Blob) || !f.size) throw new TwinUserError("Add a recording of your voice.");
      if (f.size > MAX_AUDIO_MB * 1024 * 1024) throw new TwinUserError(`The recording can be up to ${MAX_AUDIO_MB} MB.`, 413);
      const twin = await setVoice(user, { bytes: new Uint8Array(await f.arrayBuffer()), name: (f as File).name || "voice.webm" }, Number(form.get("seconds")) || undefined, form.get("consent"));
      return NextResponse.json({ ok: true, twin });
    }
    const b = (await request.json().catch(() => null)) as { action?: string; uploadId?: unknown; mediaIds?: unknown; consent?: unknown; lookId?: unknown; name?: unknown; from?: unknown; aspect?: unknown; templateId?: unknown } | null;
    if (b?.action === "video") return NextResponse.json({ ok: true, twin: await setVideo(user, String(b.uploadId ?? ""), back(), b.consent) });
    if (b?.action === "photos") return NextResponse.json({ ok: true, twin: await setPhotos(user, b.mediaIds, b.consent) });
    if (b?.action === "consent-link") return NextResponse.json({ ok: true, url: await newConsentLink(user, back()), twin: await refresh(user) });
    if (b?.action === "default") return NextResponse.json({ ok: true, twin: await setDefaultLook(user, String(b.lookId ?? "")) });
    if (b?.action === "template-looks") return NextResponse.json({ ok: true, twin: await addTemplateLooks(user, b) });
    if (b?.action === "rename-look") return NextResponse.json({ ok: true, twin: await renameLook(user, String(b.lookId ?? ""), b.name) });
    if (b?.action === "remove-look") return NextResponse.json({ ok: true, twin: await removeLook(user, String(b.lookId ?? "")) });
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}

/** Deletes the twin: voice, trained video and looks. */
export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    await removeTwin(user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
