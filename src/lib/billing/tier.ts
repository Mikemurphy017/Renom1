import { NextResponse } from "next/server";
import type { User } from "@/lib/auth/server";
import type { PlanId } from "@/lib/pricing";
import { billingState } from "./server";

/**
 * Which plan's features an account gets: the plan the admin granted, else the
 * subscription's plan, else Pro for accounts that don't need a plan (admins,
 * clients set up by the admin, early-access accounts). Null: no plan.
 */
export async function planTier(user: User): Promise<PlanId | null> {
  if (user.grantedPlan) return user.grantedPlan;
  const b = await billingState(user);
  if (!b.required) return "pro";
  return b.active ? (b.plan ?? "starter") : null;
}

export const isPro = async (user: User) => (await planTier(user)) === "pro";

/** A 403 for a Pro feature on a Starter account. */
export const proOnly = (what: string) => NextResponse.json({ ok: false, error: `${what} ${what.endsWith("s") ? "are" : "is"} part of Pro. Upgrade from your billing page to use ${what.endsWith("s") ? "them" : "it"}.`, pro: true }, { status: 403 });
