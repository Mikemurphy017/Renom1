import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { checkoutUrl, billingFail } from "@/lib/billing/server";
import { signInUrl } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

/** Starts Stripe Checkout for a plan (card required, trial included). Body: { plan, interval }. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { plan?: string; interval?: string };
  try {
    const origin = signInUrl(request).replace(/\/signin$/, "");
    const url = await checkoutUrl(user, b.plan === "starter" ? "starter" : "pro", b.interval === "month" ? "month" : "year", origin);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return billingFail(e);
  }
}
