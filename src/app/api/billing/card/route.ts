import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { addCardUrl, billingFail } from "@/lib/billing/server";
import { signInUrl } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

/** A Stripe page to save a card for a trial that started without one. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, url: await addCardUrl(user, signInUrl(request).replace(/\/signin$/, "")) });
  } catch (e) {
    return billingFail(e);
  }
}
