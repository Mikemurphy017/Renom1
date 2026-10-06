import { NextResponse } from "next/server";
import { AuthError, changePassword, currentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { current?: string; next?: string };
  try {
    await changePassword(user, String(b.current ?? ""), String(b.next ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: "Couldn’t change the password." }, { status: 500 });
  }
}
