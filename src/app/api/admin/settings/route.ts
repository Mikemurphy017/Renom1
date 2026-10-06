import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { updateSettings } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Site switches, e.g. whether anyone can sign up. */
export async function POST(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => ({}))) as { openSignup?: unknown };
  if (typeof b.openSignup !== "boolean") return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
  return NextResponse.json({ ok: true, settings: await updateSettings({ openSignup: b.openSignup }) });
}
