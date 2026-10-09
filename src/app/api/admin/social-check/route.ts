import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { SocialError, checkAccount } from "@/lib/social/ayrshare";

export const dynamic = "force-dynamic";

/** Checks the studio's Ayrshare key, from the admin dashboard. */
export async function POST(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ ok: true, detail: await checkAccount() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof SocialError ? e.message : "Something went wrong." }, { status: e instanceof SocialError ? e.status : 500 });
  }
}
