import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { setChannelsFor } from "@/lib/posting/server";

export const dynamic = "force-dynamic";

/** Which Buffer channels post for an advisor. */
export async function POST(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => ({}))) as { userId?: string; channelIds?: unknown };
  if (typeof b.userId !== "string" || !/^u[a-f0-9]{18}$/.test(b.userId)) return NextResponse.json({ ok: false, error: "Bad advisor." }, { status: 400 });
  const ids = Array.isArray(b.channelIds) ? b.channelIds.filter((x): x is string => typeof x === "string" && /^[a-f\d]{24}$/i.test(x)).slice(0, 50) : [];
  await setChannelsFor(b.userId, ids);
  return NextResponse.json({ ok: true });
}
