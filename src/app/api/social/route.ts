import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { SocialError, disconnect, socialStatus } from "@/lib/social/server";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => NextResponse.json({ ok: false, error: e instanceof SocialError ? e.message : "Something went wrong." }, { status: e instanceof SocialError ? e.status : 500 });

/** The advisor's own Buffer: connected or not, and their channels (never anyone else's). */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const fresh = new URL(request.url).searchParams.has("fresh");
    return NextResponse.json({ ok: true, ...(await socialStatus(user, fresh)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/** Disconnect the advisor's Buffer from Renom. */
export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    await disconnect(user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
