import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getJSON, putJSON } from "@/lib/storage/objects";
import { isAdmin, type User } from "@/lib/auth/server";
import { PAYMENT_LINKS, PLANS, TRIAL_VIDEOS, getPlan, planForPrice, type BillingInterval, type PlanId } from "@/lib/pricing";

/**
 * Subscriptions through Stripe (server-only, STRIPE_SECRET_KEY never leaves
 * the server). Checkout is a Stripe Payment Link per plan and billing
 * (PAYMENT_LINKS), opened with client_reference_id = our user id; the card,
 * the TRIAL_DAYS-day trial and the after-payment redirect are set on the links
 * in Stripe. On top of that, the trial here is TRIAL_VIDEOS finished videos
 * (after them, the advisor can start their plan early). Stripe is the source
 * of truth; the webhook keeps a copy per account in billing/<user id>.json,
 * plus a Stripe customer → user index (billingcust/…), since payment-link
 * subscriptions carry none of our metadata.
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
  /** A card is saved for the subscription (false: a trial started without one). */
  cardOnFile?: boolean;
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
  /** A trial started without a card: add one to use the studio. */
  needsCard?: boolean;
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
/** Our user ids (u + hex) fit storage keys; anything else from Stripe is ignored. */
const okUserId = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9]{6,40}$/.test(id);
export const readBilling = async (userId: string) => (await getJSON<BillingRecord>(recordKey(userId))) ?? {};
async function writeBilling(userId: string, patch: Partial<BillingRecord>) {
  const next = { ...(await readBilling(userId)), ...patch, updatedAt: new Date().toISOString() };
  await putJSON(recordKey(userId), next);
  return next;
}

/** Stripe customer → our user. Stripe ids don't fit storage keys, so the key is a hash of the id. */
const customerKey = (customerId: string) => `billingcust/${createHash("sha256").update(customerId).digest("hex").slice(0, 40)}.json`;
async function linkCustomer(customerId: unknown, userId: string) {
  if (typeof customerId !== "string" || !customerId) return;
  const key = customerKey(customerId);
  if ((await getJSON<{ userId?: string }>(key))?.userId !== userId) await putJSON(key, { userId, customerId });
}
async function userForCustomer(customerId: unknown): Promise<string | undefined> {
  if (typeof customerId !== "string" || !customerId) return undefined;
  const id = (await getJSON<{ userId?: string }>(customerKey(customerId)))?.userId;
  return okUserId(id) ? id : undefined;
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

export async function stripe<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
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

// ── state ──

export async function billingState(user: User & { billingExempt?: boolean }): Promise<BillingState> {
  const r = await readBilling(user.id);
  const exempt: BillingState["exempt"] = !stripeConfigured() ? "off" : isAdmin(user) ? "admin" : user.billingExempt ? "client" : Date.parse(user.createdAt) < BILLING_FROM() ? "early" : undefined;
  const status = r.status ?? null;
  // A trial only counts once there's a card on file to charge when it ends.
  const needsCard = status === "trialing" && r.cardOnFile === false;
  const live = (status === "trialing" && !needsCard) || status === "active" || status === "past_due";
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
    needsCard: !exempt && needsCard,
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

/** The Stripe Payment Link for this plan and billing (STRIPE_LINK_<PLAN>_<INTERVAL> overrides the built-in one). */
function paymentLink(plan: PlanId, interval: BillingInterval) {
  return process.env[`STRIPE_LINK_${plan.toUpperCase()}_${interval.toUpperCase()}`]?.trim() || PAYMENT_LINKS[plan][interval];
}

/**
 * Where to send the account to pay: the plan's Payment Link, tagged with our
 * user id (comes back as the session's client_reference_id) and the email
 * filled in. Needs no Stripe key; the trial and redirect are set on the link.
 */
export async function checkoutUrl(user: User, plan: PlanId, interval: BillingInterval): Promise<string> {
  if (!PLANS.some((p) => p.id === plan) || (interval !== "month" && interval !== "year")) throw new BillingError("Unknown plan.");
  const r = await readBilling(user.id);
  if (r.status && ["trialing", "active", "past_due"].includes(r.status)) throw new BillingError("You already have a plan. Change it from the billing page.", 409);
  const url = new URL(paymentLink(plan, interval));
  url.searchParams.set("client_reference_id", user.id);
  if (user.email) url.searchParams.set("prefilled_email", user.email);
  return url.toString();
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
  default_payment_method?: string | null;
  metadata?: Record<string, string>;
  items?: { data: { current_period_end?: number; price: { lookup_key: string | null; unit_amount?: number | null; recurring?: { interval: string } | null } }[] };
}

async function saveSubscription(userId: string, sub: StripeSub) {
  const item = sub.items?.data[0];
  // Payment links: the price's amount and interval. Then our older lookup-keyed prices, then metadata.
  const byPrice = planForPrice(item?.price.unit_amount, item?.price.recurring?.interval);
  const look = /^renom_(starter|pro)_(month|year)$/.exec(item?.price.lookup_key ?? "");
  const plan = (byPrice?.plan ?? look?.[1] ?? sub.metadata?.plan) as PlanId | undefined;
  const interval = (byPrice?.interval ?? look?.[2] ?? item?.price.recurring?.interval ?? sub.metadata?.interval) as BillingInterval | undefined;
  await linkCustomer(sub.customer, userId);
  return writeBilling(userId, {
    cardOnFile: await hasCard(sub),
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

/** Whether there's a card to charge: on the subscription, or the customer's default. */
async function hasCard(sub: StripeSub): Promise<boolean> {
  if (sub.default_payment_method) return true;
  try {
    const c = await stripe<{ invoice_settings?: { default_payment_method?: string | null }; default_source?: string | null }>("GET", `/customers/${sub.customer}`);
    if (c.invoice_settings?.default_payment_method || c.default_source) return true;
    const pms = await stripe<{ data: unknown[] }>("GET", "/payment_methods", { customer: sub.customer, type: "card", limit: 1 });
    return pms.data.length > 0;
  } catch {
    // Can't tell right now: don't lock someone out over it.
    return true;
  }
}

/** A Stripe page to save a card (setup mode), for a trial that started without one. */
export async function addCardUrl(user: User, origin: string): Promise<string> {
  const r = await readBilling(user.id);
  if (!r.customerId || !r.subscriptionId) throw new BillingError("There’s no trial to add a card to. Choose a plan first.", 404);
  const s = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "setup",
    customer: r.customerId,
    currency: "usd",
    payment_method_types: ["card"],
    client_reference_id: user.id,
    metadata: { userId: user.id, subscriptionId: r.subscriptionId },
    success_url: `${origin}/billing?checkout=done&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/billing`,
  });
  return s.url;
}

/** A card saved in setup mode becomes the subscription's (and the customer's) default. */
async function applySetup(session: { setup_intent?: unknown; customer?: unknown; metadata?: Record<string, string> | null }, userId: string) {
  const intent = await stripe<{ payment_method: string | null }>("GET", `/setup_intents/${session.setup_intent as string}`);
  const subId = session.metadata?.subscriptionId ?? (await readBilling(userId)).subscriptionId;
  if (!intent.payment_method || !subId) return;
  await stripe("POST", `/customers/${session.customer as string}`, { invoice_settings: { default_payment_method: intent.payment_method } });
  await saveSubscription(userId, await stripe<StripeSub>("POST", `/subscriptions/${subId}`, { default_payment_method: intent.payment_method }));
}

/** After Checkout (or a Payment Link) returns: read the session so the account is ready before the webhook arrives. */
export async function syncCheckout(user: User, sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !stripeConfigured()) return;
  const s = await stripe<{ client_reference_id: string | null; subscription: string | null; customer: string | null; mode?: string; setup_intent?: string | null; metadata?: Record<string, string> | null }>("GET", `/checkout/sessions/${sessionId}`);
  if (s.client_reference_id !== user.id) return;
  await linkCustomer(s.customer, user.id);
  if (s.mode === "setup" && s.setup_intent) return applySetup(s, user.id);
  if (s.subscription) await saveSubscription(user.id, await stripe<StripeSub>("GET", `/subscriptions/${s.subscription}`));
}

/** Checks Stripe's signature on a webhook (Stripe-Signature: t=…,v1=…), within 5 minutes. */
export function verifyWebhook(payload: string, header: string | null, stored?: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || stored?.trim();
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
    // client_reference_id is our user id (Payment Links get it from the URL checkoutUrl builds).
    const userId = (o.client_reference_id as string | null) || (o.metadata as Record<string, string> | undefined)?.userId;
    if (!okUserId(userId)) {
      if (o.subscription) console.warn(`[billing] checkout ${o.id as string} has no Renom user (opened without client_reference_id?)`);
      return;
    }
    await linkCustomer(o.customer, userId);
    if (o.mode === "setup" && o.setup_intent) return applySetup(o as Parameters<typeof applySetup>[0], userId);
    if (o.subscription) await saveSubscription(userId, await stripe<StripeSub>("GET", `/subscriptions/${o.subscription as string}`));
    return;
  }
  if (event.type.startsWith("customer.subscription.")) {
    const sub = o as unknown as StripeSub;
    // Our own metadata if it's there; payment-link subscriptions are found by customer.
    // (A subscription event before checkout.session.completed finds nobody yet; that event saves it.)
    const meta = sub.metadata?.userId;
    const userId = okUserId(meta) ? meta : await userForCustomer(sub.customer);
    if (userId) await saveSubscription(userId, sub);
  }
}

/** A JSON error for the billing routes: the message when it's ours, a plain one otherwise. */
export function billingFail(e: unknown) {
  if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  console.error("[billing]", e);
  return NextResponse.json({ ok: false, error: "Something went wrong with billing. Please try again." }, { status: 500 });
}
