import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { isPro, proOnly } from "@/lib/billing/tier";
import { VoiceError, cloneVoice, deleteVoice, readVoice, voiceConfigured } from "@/lib/voice/server";

export const dynamic = "force-dynamic";
export const maxDuration = 200;

const AUDIO = /^audio\/(webm|ogg|mpeg|mp3|mp4|x-m4a|m4a|aac|wav|x-wav|wave)$/;
const MAX_FILES = 4;
const MAX_MB = 20;

const fail = (e: unknown) => (e instanceof VoiceError ? NextResponse.json({ ok: false, error: e.message }, { status: e.status }) : (console.error("[voice]", e), NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 })));

/** Whether AI voice is available, and whether this advisor has one. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const rec = await readVoice(user.id);
  return NextResponse.json({ ok: true, configured: voiceConfigured(), voice: rec ? { createdAt: rec.createdAt, sampleSeconds: rec.sampleSeconds ?? null } : null });
}

/** Make (or remake) the advisor's AI voice. Multipart: files (1–4 recordings), consent=yes, seconds. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!(await isPro(user))) return proOnly("AI voice");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn’t read the recording." }, { status: 400 });
  }
  if (form.get("consent") !== "yes") return NextResponse.json({ ok: false, error: "Confirm that this is your voice and that you agree to it being cloned." }, { status: 400 });
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_FILES);
  if (!files.length) return NextResponse.json({ ok: false, error: "Add a recording of your voice." }, { status: 400 });
  for (const f of files) {
    const type = f.type.split(";")[0].trim().toLowerCase();
    if (!AUDIO.test(type)) return NextResponse.json({ ok: false, error: "Use an audio recording (MP3, M4A, WAV or a recording made here)." }, { status: 415 });
    if (f.size > MAX_MB * 1024 * 1024) return NextResponse.json({ ok: false, error: `Each recording can be up to ${MAX_MB} MB.` }, { status: 413 });
  }
  try {
    const samples = await Promise.all(files.map(async (f, i) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type.split(";")[0], name: f.name || `sample-${i + 1}.webm` })));
    const seconds = Number(form.get("seconds")) || undefined;
    const rec = await cloneVoice(user, samples, seconds);
    return NextResponse.json({ ok: true, voice: { createdAt: rec.createdAt, sampleSeconds: rec.sampleSeconds ?? null } });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    await deleteVoice(user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
