import { NextResponse } from "next/server";
import { currentUser, ensureIndexed, isAdmin, loadState, saveState } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/** The signed-in advisor's studio: profile, videos, reviews and work in progress. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const [saved] = await Promise.all([loadState(user.id), ensureIndexed(user).catch(() => {})]);
  return NextResponse.json({ user: { ...user, admin: isAdmin(user) }, state: saved?.state ?? null, drafts: saved?.drafts ?? null, updatedAt: saved?.updatedAt ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: { state?: unknown; drafts?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.state || typeof body.state !== "object") return NextResponse.json({ error: "state is required" }, { status: 400 });
  await saveState(user.id, { state: body.state, drafts: body.drafts ?? null });
  return NextResponse.json({ ok: true });
}
