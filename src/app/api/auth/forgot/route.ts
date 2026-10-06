import { NextResponse } from "next/server";
import { createResetToken, normEmail, throttle } from "@/lib/auth/server";
import { sendResetEmail } from "@/lib/auth/reset-email";

export const dynamic = "force-dynamic";

/**
 * Emails a reset link. Always answers the same way, so it can't be used to
 * find out which emails have accounts.
 */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { email?: string };
  const email = normEmail(String(b.email ?? ""));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!throttle(`forgot:${ip}`) || !throttle(`forgot:${email}`)) return NextResponse.json({ ok: false, error: "Too many requests. Try again in 15 minutes." }, { status: 429 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  try {
    const made = await createResetToken(email);
    if (made) await sendResetEmail(request, made.user, made.token);
  } catch (e) {
    console.error("[auth] reset email failed:", e);
  }
  return NextResponse.json({ ok: true });
}
