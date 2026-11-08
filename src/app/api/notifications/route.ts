import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { listNotices, markNotices } from "@/lib/notify/server";

export const dynamic = "force-dynamic";

/** The signed-in advisor's notifications, newest first, and how many are unread. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await listNotices(user.id)) }, { headers: { "Cache-Control": "no-store" } });
}

/** Mark notifications read or unread. Body: { read: boolean, ids?: string[] } (no ids: all of them). */
export async function PATCH(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => null)) as { read?: unknown; ids?: unknown } | null;
  if (typeof b?.read !== "boolean") return NextResponse.json({ ok: false, error: "read must be true or false" }, { status: 400 });
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string" && /^n[a-f0-9]{12}$/.test(x)).slice(0, 100) : undefined;
  return NextResponse.json({ ok: true, ...(await markNotices(user.id, b.read, ids)) });
}
