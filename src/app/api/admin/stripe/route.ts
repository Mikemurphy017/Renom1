import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { signInUrl } from "@/lib/auth/workspace";
import { runSetup, setupStatus } from "@/lib/billing/setup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const originOf = (request: Request) => signInUrl(request).replace(/\/signin$/, "");

/** How Stripe is set up for Renom: payment links, webhook, customer portal. */
export async function GET(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true, status: await setupStatus(originOf(request)) }, { headers: { "Cache-Control": "no-store" } });
}

/** Fixes what's missing (links, webhook, portal). */
export async function POST(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const result = await runSetup(originOf(request));
  return NextResponse.json({ ok: true, ...result, status: await setupStatus(originOf(request)) });
}
