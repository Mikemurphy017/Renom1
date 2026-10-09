import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { appUrl } from "@/lib/email";
import { SocialError, linkUrl } from "@/lib/social/ayrshare";

export const dynamic = "force-dynamic";

/** A one-time link to the page where the advisor connects their social accounts. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { back?: unknown };
  // Only ever send them back to a page of this app.
  const back = typeof b.back === "string" && /^\/[A-Za-z0-9/_?=&.-]{0,200}$/.test(b.back) && !b.back.startsWith("//") ? b.back : "/settings#publishing";
  try {
    return NextResponse.json({ ok: true, url: await linkUrl(user, `${appUrl(request)}${back}`) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof SocialError ? e.message : "Something went wrong." }, { status: e instanceof SocialError ? e.status : 500 });
  }
}
