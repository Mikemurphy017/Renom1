import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { billingState, startNow, billingFail } from "@/lib/billing/server";

export const dynamic = "force-dynamic";

/** Ends the trial now and starts the paid plan. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    await startNow(user);
    return NextResponse.json({ ok: true, billing: await billingState(user) });
  } catch (e) {
    return billingFail(e);
  }
}
