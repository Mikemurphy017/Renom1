import { NextResponse } from "next/server";
import { handleEvent, verifyWebhook } from "@/lib/billing/server";
import { storedWebhookSecret } from "@/lib/billing/setup";

export const dynamic = "force-dynamic";

/** Stripe's events (checkout finished, subscription changed or cancelled), signed with STRIPE_WEBHOOK_SECRET. */
export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyWebhook(payload, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ? null : await storedWebhookSecret())) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await handleEvent(JSON.parse(payload));
  } catch (e) {
    console.error("[billing] webhook failed:", e);
    // Stripe retries on a 5xx.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
