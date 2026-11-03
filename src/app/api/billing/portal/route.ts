import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { portalUrl, billingFail } from "@/lib/billing/server";
import { signInUrl } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

/** Stripe's billing portal: change plan or card, see invoices, cancel. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, url: await portalUrl(user, signInUrl(request).replace(/\/signin$/, "")) });
  } catch (e) {
    return billingFail(e);
  }
}
