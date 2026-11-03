import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { billingState, syncCheckout } from "@/lib/billing/server";

export const dynamic = "force-dynamic";

/** The signed-in account's plan, trial and what it can do. ?session= right after Checkout syncs it first. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const session = new URL(request.url).searchParams.get("session");
  try {
    if (session) await syncCheckout(user, session);
  } catch (e) {
    console.warn("[billing] checkout sync:", (e as Error).message);
  }
  return NextResponse.json({ ok: true, billing: await billingState(user) }, { headers: { "Cache-Control": "no-store" } });
}
