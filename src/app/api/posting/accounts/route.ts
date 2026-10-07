import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { getBufferStatus } from "@/lib/buffer/server";
import { channelMap } from "@/lib/posting/server";

export const dynamic = "force-dynamic";

/** The social accounts the team posts to for this advisor: names only, never anyone else's. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const mine = (await channelMap())[user.id] ?? [];
  if (!mine.length) return NextResponse.json({ ok: true, accounts: [] });
  const status = await getBufferStatus().catch(() => null);
  const channels = status && "channels" in status ? status.channels : [];
  const accounts = channels.filter((c) => mine.includes(c.id)).map((c) => ({ name: c.displayName || c.name, service: c.service, avatar: c.avatar }));
  return NextResponse.json({ ok: true, accounts }, { headers: { "Cache-Control": "no-store" } });
}
