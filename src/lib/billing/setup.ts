import { getJSON, putJSON } from "@/lib/storage/objects";
import { seal, secretsConfigured, unseal } from "@/lib/secrets";
import { PAYMENT_LINKS, PLANS, TRIAL_DAYS, planForPrice, type BillingInterval, type PlanId } from "@/lib/pricing";
import { stripe, stripeConfigured } from "./server";

/**
 * One-click Stripe setup from the admin portal (the app can reach Stripe; the
 * admin shouldn't have to click through the dashboard). It checks and, on
 * request, fixes:
 * - the four payment links: a TRIAL_DAYS-day trial, card always collected,
 *   and back to /billing after paying;
 * - the webhook endpoint (created if missing; its signing secret is kept
 *   sealed in storage, so STRIPE_WEBHOOK_SECRET isn't needed);
 * - the customer portal (change plan between the four prices, update card,
 *   invoices, cancel at period end).
 */

const EVENTS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
const STORE = "meta/stripesetup.json";

interface Stored {
  webhookId?: string;
  webhookSecret?: string;
}

/** The webhook signing secret saved when setup created the endpoint. */
export async function storedWebhookSecret(): Promise<string | null> {
  const s = await getJSON<Stored>(STORE).catch(() => null);
  return s?.webhookSecret ? unseal(s.webhookSecret) : null;
}

interface StripeLink {
  id: string;
  url: string;
  active: boolean;
  after_completion?: { type: string; redirect?: { url: string } };
  payment_method_collection?: string;
  subscription_data?: { trial_period_days?: number | null } | null;
}

export interface LinkCheck {
  plan: PlanId;
  interval: BillingInterval;
  url: string;
  found: boolean;
  id?: string;
  /** The price matches the plan's (from its line item). */
  priceOk?: boolean;
  priceText?: string;
  trialDays?: number | null;
  card?: string;
  redirect?: string | null;
  ok: boolean;
}

export interface SetupStatus {
  configured: boolean;
  live?: boolean;
  account?: string;
  links: LinkCheck[];
  webhook: { ok: boolean; url: string; id?: string; detail: string };
  portal: { ok: boolean; detail: string };
  error?: string;
}

const returnUrl = (origin: string) => `${origin}/billing?checkout=done&session={CHECKOUT_SESSION_ID}`;
const hookUrl = (origin: string) => `${origin}/api/billing/webhook`;

async function allLinks(): Promise<StripeLink[]> {
  const out: StripeLink[] = [];
  let after: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await stripe<{ data: StripeLink[]; has_more: boolean }>("GET", "/payment_links", { limit: 100, ...(after ? { starting_after: after } : {}) });
    out.push(...page.data);
    if (!page.has_more || !page.data.length) break;
    after = page.data.at(-1)!.id;
  }
  return out;
}

async function linkPrice(id: string) {
  const items = await stripe<{ data: { price: { id: string; product: string; unit_amount: number | null; recurring: { interval: string } | null } }[] }>("GET", `/payment_links/${id}/line_items`, { limit: 5 });
  return items.data[0]?.price ?? null;
}

export async function setupStatus(origin: string): Promise<SetupStatus> {
  const empty: SetupStatus = { configured: stripeConfigured(), links: [], webhook: { ok: false, url: hookUrl(origin), detail: "" }, portal: { ok: false, detail: "" } };
  if (!stripeConfigured()) return { ...empty, error: "STRIPE_SECRET_KEY isn’t set." };
  try {
    const acct = await stripe<{ id: string; settings?: { dashboard?: { display_name?: string } }; business_profile?: { name?: string } }>("GET", "/account");
    const links = await allLinks();
    const checks: LinkCheck[] = [];
    for (const plan of PLANS) {
      for (const interval of ["month", "year"] as BillingInterval[]) {
        const url = PAYMENT_LINKS[plan.id][interval];
        const l = links.find((x) => x.url === url);
        if (!l) {
          checks.push({ plan: plan.id, interval, url, found: false, ok: false });
          continue;
        }
        const price = await linkPrice(l.id).catch(() => null);
        const match = price ? planForPrice(price.unit_amount, price.recurring?.interval) : null;
        const priceOk = !!match && match.plan === plan.id && match.interval === interval;
        const trialDays = l.subscription_data?.trial_period_days ?? null;
        const redirect = l.after_completion?.type === "redirect" ? (l.after_completion.redirect?.url ?? null) : null;
        checks.push({
          plan: plan.id,
          interval,
          url,
          found: true,
          id: l.id,
          priceOk,
          priceText: price?.unit_amount ? `$${(price.unit_amount / 100).toLocaleString("en-US")}/${price.recurring?.interval ?? "one-time"}` : "unknown",
          trialDays,
          card: l.payment_method_collection,
          redirect,
          ok: l.active && priceOk && trialDays === TRIAL_DAYS && l.payment_method_collection === "always" && redirect === returnUrl(origin),
        });
      }
    }
    const hooks = await stripe<{ data: { id: string; url: string; status: string; enabled_events: string[] }[] }>("GET", "/webhook_endpoints", { limit: 100 });
    const hook = hooks.data.find((h) => h.url === hookUrl(origin));
    const stored = await storedWebhookSecret();
    const hookEvents = hook && (hook.enabled_events.includes("*") || EVENTS.every((e) => hook.enabled_events.includes(e)));
    const webhook = !hook
      ? { ok: false, url: hookUrl(origin), detail: "Not set up yet." }
      : !hookEvents
        ? { ok: false, url: hookUrl(origin), id: hook.id, detail: "Set up, but missing some events." }
        : !process.env.STRIPE_WEBHOOK_SECRET && !stored
          ? { ok: false, url: hookUrl(origin), id: hook.id, detail: "Set up in Stripe, but Renom doesn’t have its signing secret. Run setup to replace it, or set STRIPE_WEBHOOK_SECRET." }
          : { ok: hook.status === "enabled", url: hookUrl(origin), id: hook.id, detail: hook.status === "enabled" ? "Receiving events." : `Status: ${hook.status}.` };
    const portals = await stripe<{ data: { id: string; active: boolean; is_default: boolean; features: { subscription_update?: { enabled: boolean } } }[] }>("GET", "/billing_portal/configurations", { limit: 10 });
    const portal = portals.data.find((p) => p.active && p.is_default);
    return {
      configured: true,
      live: !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test"),
      account: acct.settings?.dashboard?.display_name || acct.business_profile?.name || acct.id,
      links: checks,
      webhook,
      portal: portal ? { ok: !!portal.features.subscription_update?.enabled, detail: portal.features.subscription_update?.enabled ? "On: plan changes, card updates, invoices and cancelling." : "On, but plan changes are off." } : { ok: false, detail: "Not set up yet." },
    };
  } catch (e) {
    return { ...empty, error: (e as Error).message };
  }
}

/** Fixes whatever setupStatus found wrong. Returns what it did, step by step. */
export async function runSetup(origin: string): Promise<{ done: string[]; failed: string[] }> {
  const done: string[] = [];
  const failed: string[] = [];
  const st = await setupStatus(origin);
  if (st.error) return { done, failed: [st.error] };

  // Payment links: trial, card, and back to Renom after paying.
  for (const l of st.links) {
    const name = `${PLANS.find((p) => p.id === l.plan)!.name} ${l.interval === "year" ? "annual" : "monthly"} link`;
    if (!l.found || !l.id) {
      failed.push(`${name}: not found in this Stripe account (${l.url}).`);
      continue;
    }
    if (!l.priceOk) failed.push(`${name}: its price is ${l.priceText}, which doesn’t match the plan. Fix the price in Stripe; Renom recognises plans by price.`);
    if (l.ok) {
      done.push(`${name}: already set up.`);
      continue;
    }
    try {
      await stripe("POST", `/payment_links/${l.id}`, {
        after_completion: { type: "redirect", redirect: { url: returnUrl(origin) } },
        payment_method_collection: "always",
        subscription_data: { trial_period_days: TRIAL_DAYS },
      });
      done.push(`${name}: ${TRIAL_DAYS}-day trial, card required, returns to Renom after paying.`);
    } catch (e) {
      failed.push(`${name}: ${(e as Error).message}`);
    }
  }

  // Webhook: create it (or replace one whose secret Renom doesn't have).
  if (!st.webhook.ok && !process.env.STRIPE_WEBHOOK_SECRET && !secretsConfigured()) failed.push("Webhook: set SECRETS_KEY on the server first (it keeps the webhook’s signing secret safe), then run setup again.");
  else if (!st.webhook.ok) {
    try {
      if (st.webhook.id && !process.env.STRIPE_WEBHOOK_SECRET) await stripe("POST", `/webhook_endpoints/${st.webhook.id}`, { disabled: true });
      const hook = await stripe<{ id: string; secret: string }>("POST", "/webhook_endpoints", { url: hookUrl(origin), enabled_events: EVENTS, description: "Renom billing" });
      await putJSON(STORE, { webhookId: hook.id, webhookSecret: seal(hook.secret) } satisfies Stored);
      done.push(`Webhook: created at ${hookUrl(origin)}, so Renom hears about trials, payments and cancellations.`);
    } catch (e) {
      failed.push(`Webhook: ${(e as Error).message}`);
    }
  } else done.push("Webhook: already set up.");

  // Customer portal: switch between the four prices, update card, invoices, cancel at period end.
  if (!st.portal.ok) {
    try {
      const prices = new Map<string, string[]>();
      for (const l of st.links.filter((x) => x.id && x.priceOk)) {
        const p = await linkPrice(l.id!);
        if (p) prices.set(p.product, [...(prices.get(p.product) ?? []), p.id]);
      }
      await stripe("POST", "/billing_portal/configurations", {
        business_profile: { headline: "Manage your Renom plan" },
        default_return_url: `${origin}/billing`,
        features: {
          customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "unused", "other"] } },
          ...(prices.size ? { subscription_update: { enabled: true, default_allowed_updates: ["price"], proration_behavior: "create_prorations", products: [...prices].map(([product, ids]) => ({ product, prices: ids })) } } : {}),
        },
      });
      done.push("Customer portal: on (change plan, update card, invoices, cancel at the end of the period).");
    } catch (e) {
      failed.push(`Customer portal: ${(e as Error).message}`);
    }
  } else done.push("Customer portal: already set up.");

  return { done, failed };
}
