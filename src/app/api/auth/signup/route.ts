import { NextResponse } from "next/server";
import { AuthError, createSession, createUser, sessionCookie, throttle } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { email?: string; password?: string; name?: string; invite?: string };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!throttle(`signup:${ip}`)) return NextResponse.json({ ok: false, error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  try {
    const user = await createUser({ email: String(b.email ?? ""), password: String(b.password ?? ""), name: String(b.name ?? ""), invite: b.invite });
    const token = await createSession(user);
    return NextResponse.json({ ok: true, user }, { headers: { "Set-Cookie": sessionCookie(token, request) } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[auth] sign-up failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn’t create the account. Please try again." }, { status: 500 });
  }
}
