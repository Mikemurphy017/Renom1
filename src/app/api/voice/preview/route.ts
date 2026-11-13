import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { isPro, proOnly } from "@/lib/billing/tier";
import { VoiceError, speak } from "@/lib/voice/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A short line in the advisor's AI voice, to hear how it sounds. Body: { text } (up to 300 characters). */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!(await isPro(user))) return proOnly("AI voice");
  const b = (await request.json().catch(() => ({}))) as { text?: string };
  const text = String(b.text ?? "").trim().slice(0, 300) || "Hi, I’m your financial advisor. Here’s one thing most people miss about their retirement plan.";
  try {
    const audio = await speak(user, text);
    return new Response(audio as BodyInit, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VoiceError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[voice] preview", e);
    return NextResponse.json({ ok: false, error: "Couldn’t make the preview." }, { status: 500 });
  }
}
