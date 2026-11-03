import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getJSON, putJSON } from "@/lib/storage/objects";
import { isAdmin, type User } from "@/lib/auth/server";
import { PLANS, TRIAL_DAYS, TRIAL_VIDEOS, getPlan, type BillingInterval, type PlanId } from "@/lib/pricing";

/**
 * Subscriptions through Stripe (server-only, STRIPE_SECRET_KEY never leaves
 * the server). A card is taken up front at Checkout; the trial is TRIAL_DAYS
 * days and TRIAL_VIDEOS finished videos, whichever comes first (after the
 * videos, the advisor can start their plan early). Stripe is the source of
 * truth; the webhook keeps a copy per account in billing/<user id>.json.
 *
 * Who doesn't need a plan: admins, clients the admin set up (billed
 * separately), and accounts made before billing started (BILLING_REQUIRED_FROM,
 * early access was free). With no STRIPE_SECRET_KEY set, nobody does.
 */

export interface BillingRecord {
  customerId?: string;
  subscriptionId?: string;
  /** Stripe's subscription status: trialing, active, past_due, canceled, unpaid, incomplete… */
  status?: string;
  plan?: PlanId;
  interval?: BillingInterval;
  trialEnd?: number;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  /** Takes rendered during the trial (source ids), so a re-render of the same take doesn't count twice. */
  trialRenders?: string[];
  /** A trial has been used (no second trial on a new checkout). */
  hadTrial?: boolean;
  updatedAt?: string;
}

export interface BillingState {
  /** Stripe is set up and this account needs a plan. */
  required: boolean;
  /** Can use the studio (has a plan, a trial, or doesn't need one). */
  active: boolean;
  status: string | null;
  plan: PlanId | null;
  interval: BillingInterval | null;
  trialEnd: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialing: boolean;
  trialVideosUsed: number;
  trialVideos: number;
  /** Why not required (for the billing page). */
  exempt?: "admin" | "client" | "early" | "off";
}

const SECRET = () => process.env.STRIPE_SECRET_KEY?.trim() ?? "";
export const stripeConfigured = () => !!SECRET();
/** Accounts made before this didn't sign up with a card (early access). */
const BILLING_FROM = () => Date.parse(process.env.BILLING_REQUIRED_FROM?.trim() || "2026-11-03T12:00:00Z");

export class BillingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const recordKey = (userId: string) => `billing/${userId}.json`;
export const readBilling = async (userId: string) => (await getJSON<BillingRecord>(recordKey(userId))) ?? {};
async function writeBilling(userId: string, patch: Partial<BillingRecord>) {
  const next = { ...(await readBilling(userId)), ...patch, updatedAt: new Date().toISOString() };
  await putJSON(recordKey(userId), next);
  return next;
}

// ── Stripe REST, form-encoded ──

function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  if (!stripeConfigured()) throw new BillingError("Billing isn’t set up yet.", 503);
  const qs = method === "GET" && body ? `?${form(body).toString()}` : "";
  let res: Response;
  try {
    res = await fetch(`${(process.env.STRIPE_API_URL?.trim() || "https://api.stripe.com").replace(/\/+$/, "")}/v1${path}${qs}`, {
      method,
      headers: { Authorization: `Bearer ${SECRET()}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: method === "POST" && body ? form(body).toString() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new BillingError("Couldn’t reach Stripe. Try again in a moment.", 502);
  }
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error(`[billing] Stripe ${res.status} ${path}: ${j.error?.message}`);
    throw new BillingError(j.error?.message || `Stripe returned an error (${res.status}).`, res.status >= 500 ? 502 : 400);
  }
  return j;
}

/** The Stripe price for a plan and interval, made the first time it's needed (found again by lookup key). */
const priceCache = new Map<string, string>();
async function priceFor(plan: PlanId, interval: BillingInterval): Promise<string> {
  const key = `renom_${plan}_${interval}`;
  const hit = priceCache.get(key);
  if (hit) return hit;
  const p = getPlan(plan)!;
  const amount = (interval === "year" ? p.annual : p.monthly) * 100;
  const found = await stripe<{ data: { id: string; unit_amount: number }[] }>("GET", "/prices", { lookup_keys: [key], active: true, limit: 1 });
  let id = found.data[0]?.unit_amount === amount ? found.data[0].id : "";
  if (!id) {
    // A new price (or the amount changed): the lookup key moves to it.
    const product = await stripe<{ id: string }>("POST", "/products", { name: `Renom ${p.name}`, metadata: { plan } });
    id = (await stripe<{ id: string }>("POST", "/prices", { product: product.id, currency: "usd", unit_amount: amount, recurring: { interval }, lookup_key: key, transfer_lookup_key: true, metadata: { plan, interval } })).id;
  }
  priceCache.set(key, id);
  return id;
}

// ── state ──

export async function billingState(user: User & { billingExempt?: boolean }): Promise<BillingState> {
  const r = await readBilling(user.id);
  const exempt: BillingState["exempt"] = !stripeConfigured() ? "off" : isAdmin(user) ? "admin" : user.billingExempt ? "client" : Date.parse(user.createdAt) < BILLING_FROM() ? "early" : undefined;
  const status = r.status ?? null;
  const live = status === "trialing" || status === "active" || status === "past_due";
  const trialing = status === "trialing";
  return {
    required: !exempt,
    active: !!exempt || live,
    status,
    plan: r.plan ?? null,
    interval: r.interval ?? null,
    trialEnd: r.trialEnd ? new Date(r.trialEnd * 1000).toISOString() : null,
    periodEnd: r.periodEnd ? new Date(r.periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!r.cancelAtPeriodEnd,
    trialing,
    trialVideosUsed: r.trialRenders?.length ?? 0,
    trialVideos: TRIAL_VIDEOS,
    exempt,
  };
}

/**
 * Before a final render: may this account render this take? During the trial,
 * each new take counts toward TRIAL_VIDEOS (re-rendering the same take is free).
 */
export async function checkRender(user: User & { billingExempt?: boolean }, sourceId: string): Promise<void> {
  const st = await billingState(user);
  if (!st.required) return;
  if (!st.active) throw new BillingError("Choose a plan to finish videos. Your studio and drafts are saved.", 402);
  if (!st.trialing) return;
  const r = await readBilling(user.id);
  const used = r.trialRenders ?? [];
  if (used.includes(sourceId)) return;
  if (used.length >= TRIAL_VIDEOS) throw new BillingError(`Your trial includes ${TRIAL_VIDEOS} finished videos. Start your plan now to keep going (Settings → Billing).`, 402);
}

/** After a render starts: count the take toward the trial. */
export async function countRender(user: User, sourceId: string) {
  const st = await billingState(user);
  if (!st.required || !st.trialing) return;
  const r = await readBilling(user.id);
  if (!(r.trialRenders ?? []).includes(sourceId)) await writeBilling(user.id, { trialRenders: [...(r.trialRenders ?? []), sourceId] });
}

// ── checkout, portal, start now ──

export async function checkoutUrl(user: User, plan: PlanId, interval: BillingInterval, origin: string): Promise<string> {
  if (!PLANS.some((p) => p.id === plan)) throw new BillingError("Unknown plan.");
  const r = await readBilling(user.id);
  if (r.status && ["trialing", "active", "past_due"].includes(r.status)) throw new BillingError("You already have a plan. Change it from the billing page.", 409);
  const price = await priceFor(plan, interval);
  const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    ...(r.customerId ? { customer: r.customerId } : { customer_email: user.email }),
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: { ...(r.hadTrial ? {} : { trial_period_days: TRIAL_DAYS }), metadata: { userId: user.id, plan, interval } },
    metadata: { userId: user.id, plan, interval },
    success_url: `${origin}/billing?checkout=done&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing?plan=${plan}&billing=${interval}`,
  });
  return session.url;
}

export async function portalUrl(user: User, origin: string): Promise<string> {
  const r = await readBilling(user.id);
  if (!r.customerId) throw new BillingError("There’s no billing account yet. Choose a plan first.", 404);
  return (await stripe<{ url: string }>("POST", "/billing_portal/sessions", { customer: r.customerId, return_url: `${origin}/billing` })).url;
}

/** End the trial now and start the paid plan (card is charged). */
export async function startNow(user: User) {
  const r = await readBilling(user.id);
  if (!r.subscriptionId || r.status !== "trialing") throw new BillingError("Your plan is already running.", 409);
  const sub = await stripe<StripeSub>("POST", `/subscriptions/${r.subscriptionId}`, { trial_end: "now", proration_behavior: "none" });
  return saveSubscription(user.id, sub);
}

// ── keeping in step with Stripe ──

interface StripeSub {
  id: string;
  customer: string;
  status: string;
  trial_end: number | null;
  current_period_end?: number;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string>;
  items?: { data: { current_period_end?: number; price: { lookup_key: string | null; recurring?: { interval: string } } }[] };
}

async function saveSubscription(userId: string, sub: StripeSub) {
  const item = sub.items?.data[0];
  const look = /^renom_(starter|pro)_(month|year)$/.exec(item?.price.lookup_key ?? "");
  const plan = (look?.[1] ?? sub.metadata?.plan) as PlanId | undefined;
  const interval = (look?.[2] ?? item?.price.recurring?.interval ?? sub.metadata?.interval) as BillingInterval | undefined;
  return writeBilling(userId, {
    customerId: sub.customer,
    subscriptionId: sub.id,
    status: sub.status,
    plan: getPlan(plan) ? plan : undefined,
    interval: interval === "month" || interval === "year" ? interval : undefined,
    trialEnd: sub.trial_end ?? undefined,
    periodEnd: item?.current_period_end ?? sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    ...(sub.status === "trialing" || sub.trial_end ? { hadTrial: true } : {}),
  });
}

/** After Checkout returns: read the session so the account is ready before the webhook arrives. */
export async function syncCheckout(user: User, sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  const s = await stripe<{ client_reference_id: string | null; subscription: string | null; customer: string | null }>("GET", `/checkout/sessions/${sessionId}`);
  if (s.client_reference_id !== user.id || !s.subscription) return;
  await saveSubscription(user.id, await stripe<StripeSub>("GET", `/subscriptions/${s.subscription}`));
}

/** Checks Stripe's signature on a webhook (Stripe-Signature: t=…,v1=…), within 5 minutes. */
export function verifyWebhook(payload: string, header: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const got = p.slice(3);
      return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
    });
}

export async function handleEvent(event: { type: string; data: { object: Record<string, unknown> } }) {
  const o = event.data.object;
  if (event.type === "checkout.session.completed") {
    const userId = (o.client_reference_id as string) || (o.metadata as Record<string, string> | undefined)?.userId;
    if (userId && o.subscription) await saveSubscription(userId, await stripe<StripeSub>("GET", `/subscriptions/${o.subscription as string}`));
    return;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const sub = o as unknown as StripeSub;
    const userId = sub.metadata?.userId;
    if (userId) await saveSubscription(userId, sub);
  }
}

/** A JSON error for the billing routes: the message when it's ours, a plain one otherwise. */
export function billingFail(e: unknown) {
  if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  console.error("[billing]", e);
  return NextResponse.json({ ok: false, error: "Something went wrong with billing. Please try again." }, { status: 500 });
}
