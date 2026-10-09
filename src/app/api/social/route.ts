import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { SocialError, socialStatus, unlink } from "@/lib/social/ayrshare";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => NextResponse.json({ ok: false, error: e instanceof SocialError ? e.message : "Something went wrong." }, { status: e instanceof SocialError ? e.status : 500 });

/** Which of the advisor's social accounts are connected. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await socialStatus(user)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/** Disconnect one network (?network=linkedin). */
export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const network = new URL(request.url).searchParams.get("network") ?? "";
  if (!/^[a-z]{2,20}$/.test(network)) return NextResponse.json({ ok: false, error: "Invalid network." }, { status: 400 });
  try {
    await unlink(user, network);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
