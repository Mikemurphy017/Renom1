import { NextResponse } from "next/server";
import { AuthError, checkResetToken, createSession, recordSignIn, resetPassword, sessionCookie, throttle } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Is this reset link still good? */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = await checkResetToken(token).catch(() => null);
  return NextResponse.json(ok ? { ok: true, email: ok.email } : { ok: false }, { headers: { "Cache-Control": "no-store" } });
}

/** Sets the new password, signs out every other device and signs this one in. */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!throttle(`reset:${ip}`)) return NextResponse.json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  try {
    const user = await resetPassword(String(b.token ?? ""), String(b.password ?? ""));
    const token = await createSession(user);
    await recordSignIn(user).catch(() => {});
    return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token, request) } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[auth] reset failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn’t reset the password. Please try again." }, { status: 500 });
  }
}
