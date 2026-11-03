import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { checkoutUrl, billingFail } from "@/lib/billing/server";

export const dynamic = "force-dynamic";

/** The Stripe Payment Link for a plan (card and trial are set on the link), tagged with this account. Body: { plan, interval }. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { plan?: string; interval?: string };
  try {
    const url = await checkoutUrl(user, b.plan === "starter" ? "starter" : "pro", b.interval === "month" ? "month" : "year");
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return billingFail(e);
  }
}
