import { NextResponse } from "next/server";
import { AuthError, createSession, normEmail, recordSignIn, sessionCookie, throttle, verifyPassword } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = normEmail(String(b.email ?? ""));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!throttle(`signin:${ip}:${email}`)) return NextResponse.json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  try {
    const user = email && b.password ? await verifyPassword(email, String(b.password)) : null;
    if (!user) return NextResponse.json({ ok: false, error: "That email and password don’t match." }, { status: 401 });
    const token = await createSession(user);
    await recordSignIn(user).catch(() => {});
    return NextResponse.json({ ok: true, user }, { headers: { "Set-Cookie": sessionCookie(token, request) } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[auth] sign-in failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn’t sign you in. Please try again." }, { status: 500 });
  }
}
